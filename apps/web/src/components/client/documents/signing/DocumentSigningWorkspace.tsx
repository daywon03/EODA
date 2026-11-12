"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, RotateCw } from "lucide-react";
import { saveSignedDocument, type DocumentSigningContext } from "@/lib/actions/document-signature";
import {
  defaultZoneMarks,
  findPdfSignatureZones,
  manualPdfZone,
  matchRenderedParagraph,
  normalizeLine,
  shortLabel,
  signedCopyPath,
  signedFilename,
  type PdfRect,
  type SignatureMark,
} from "@/lib/services/document-signature-service";
import type { DocxPackage } from "@/lib/services/dipec-word-service";
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { SignaturePad } from "@/components/tablet/SignaturePad";
import dynamic from "next/dynamic";
import { bytesToObjectUrl, dataUrlToBytes, renderPdfPages, stampPdf, type RenderedPdfPage } from "./pdf-signing-client";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// « SIGNER LE DOCUMENT » — option B de la maquette du 12/11/2026 : le document à gauche,
// les étapes à droite. Les cases sont repérées par leurs libellés
// (`document-signature-service`) ; un PDF se signe aussi ailleurs d'un clic, un Word en
// fin de document. Tout se fabrique ici ; le serveur ne reçoit que la copie signée.
//
// Les outils Word, le tampon et l'aperçu Word se chargent à la demande : la page tient
// ainsi son budget de JavaScript (`check:bundle`).
// ─────────────────────────────────────────────────────────────────────────────

const DocxPreview = dynamic(() => import("@/components/structure/DocxPreview").then((m) => m.DocxPreview), { ssr: false });

type Zone = { id: string; kind: SignatureMark; label: string; page?: number; rect?: PdfRect; paragraph?: number | null };
// `texts` : le texte de chaque paragraphe du corps, pour retrouver la ligne touchée.
type Loaded = { kind: "DOCX"; bytes: Uint8Array; pkg: DocxPackage; texts: string[] } | { kind: "PDF"; bytes: Uint8Array; pages: RenderedPdfPage[]; pageCount: number };
type Built = { bytes: Uint8Array; pages: RenderedPdfPage[] | null };

const MARK_LABELS: Record<SignatureMark, string> = { SIGNATURE: "Ma signature", TAMPON: "Le tampon" };
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PAGE_WIDTH_PX = 900;
const originalUrl = (versionId: string) => `/api/documents/${encodeURIComponent(versionId)}/original`;

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
function zoneStyle(rect: PdfRect, page: RenderedPdfPage): React.CSSProperties {
  return {
    left: pct(rect.x / page.width),
    top: pct(1 - (rect.y + rect.height) / page.height),
    width: pct(rect.width / page.width),
    height: pct(rect.height / page.height),
  };
}

async function loadDocument(context: DocumentSigningContext): Promise<Loaded> {
  const response = await fetch(originalUrl(context.versionId), { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Document illisible");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (context.kind === "DOCX") {
    const [{ openDocx }, { browserInflateRaw }, { wordParagraphTexts }] = await Promise.all([
      import("@/lib/services/dipec-word-service"),
      import("@/lib/services/zip-read"),
      import("@/lib/services/document-signature-word"),
    ]);
    const inflate = browserInflateRaw();
    if (!inflate) throw new Error("Navigateur trop ancien");
    const pkg = await openDocx(bytes, inflate);
    return { kind: "DOCX", bytes, pkg, texts: wordParagraphTexts(pkg.documentXml) };
  }
  return { kind: "PDF", bytes, ...(await renderPdfPages(bytes, PAGE_WIDTH_PX)) };
}

async function initialZones(loaded: Loaded): Promise<Zone[]> {
  if (loaded.kind === "PDF") return findPdfSignatureZones(loaded.pages);
  const { findWordSignatureZones } = await import("@/lib/services/document-signature-word");
  return findWordSignatureZones(loaded.pkg.documentXml);
}

export function DocumentSigningWorkspace({ context }: { context: DocumentSigningContext }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [marks, setMarks] = useState<Record<string, SignatureMark | null>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [stampSource, setStampSource] = useState<HTMLCanvasElement | null>(null);
  const [stampTurns, setStampTurns] = useState<number | null>(null);
  const [stamp, setStamp] = useState<{ png: Uint8Array; url: string } | null>(null);
  const [stampState, setStampState] = useState<"loading" | "ready" | "none">(context.tamponVersionId ? "loading" : "none");
  const [placing, setPlacing] = useState<SignatureMark | null>(null);
  const [built, setBuilt] = useState<Built | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    loadDocument(context)
      .then(async (doc) => {
        const found = await initialZones(doc);
        if (cancelled) return;
        setLoaded(doc);
        setZones(found);
        setMarks(defaultZoneMarks(found));
      })
      .catch(() => !cancelled && setLoadError("Le document n'a pas pu être ouvert. Rechargez la page ; si cela continue, écrivez à EODA."));
    return () => {
      cancelled = true;
    };
  }, [context]);

  useEffect(() => {
    if (!context.tamponVersionId) return;
    let cancelled = false;
    const url = originalUrl(context.tamponVersionId);
    void import("@/components/tablet/admission/stamp-client")
      .then(({ loadStampSourceFrom }) => loadStampSourceFrom(url))
      .then((source) => {
      if (cancelled) return;
      setStampSource(source);
      if (!source) setStampState("none");
    });
    return () => {
      cancelled = true;
    };
  }, [context.tamponVersionId]);

  useEffect(() => {
    if (!stampSource) return;
    let cancelled = false;
    void import("@/components/tablet/admission/stamp-client")
      .then(({ prepareStamp }) => prepareStamp(stampSource, stampTurns))
      .then((prepared) => {
      if (cancelled) return;
      if (!prepared) return setStampState("none");
      setStamp((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return { png: prepared.png, url: bytesToObjectUrl(prepared.png, "image/png") };
      });
      setStampTurns(prepared.turns);
      setStampState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [stampSource, stampTurns]);

  const chosen = useMemo(() => zones.filter((z) => marks[z.id]), [zones, marks]);

  function invalidate() {
    setBuilt(null);
    setError(null);
  }

  function setMark(id: string, mark: SignatureMark | null) {
    setMarks((m) => ({ ...m, [id]: mark }));
    invalidate();
  }

  function addZone(zone: Zone, mark: SignatureMark) {
    setZones((z) => [...z, zone]);
    setMarks((m) => ({ ...m, [zone.id]: mark }));
    invalidate();
  }

  function placeOnPage(event: React.MouseEvent<HTMLElement>, page: RenderedPdfPage) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    const zone = manualPdfZone({
      id: `m${Date.now()}`,
      page: page.page,
      pageWidth: page.width,
      pageHeight: page.height,
      fx: (event.clientX - box.left) / box.width,
      fy: (event.clientY - box.top) / box.height,
      kind: placing,
    });
    addZone(zone, placing);
    setPlacing(null);
  }

  // Word : la ligne touchée dans l'aperçu (corps seulement — ni en-tête ni pied de page),
  // retrouvée dans le document ; la marque se pose juste après elle.
  function placeInWord(event: React.MouseEvent<HTMLElement>) {
    if (!placing || loaded?.kind !== "DOCX") return;
    const target = event.target instanceof Element ? event.target.closest("article p") : null;
    if (!target) return;
    const lines = [...event.currentTarget.querySelectorAll("section.docx article p")];
    const paragraph = matchRenderedParagraph(loaded.texts, lines.map((l) => normalizeLine(l.textContent ?? "")), lines.indexOf(target));
    if (paragraph === null) {
      setError("Cette ligne n'a pas été retrouvée dans le document : touchez une ligne voisine ou choisissez-la dans la liste.");
      return;
    }
    placeAfterParagraph(paragraph, placing);
  }

  function placeAfterParagraph(paragraph: number | null, mark: SignatureMark) {
    if (loaded?.kind !== "DOCX") return;
    const text = paragraph === null ? "" : loaded.texts[paragraph] || [...loaded.texts.slice(0, paragraph)].reverse().find(Boolean) || "";
    const label = paragraph === null ? "Fin du document" : text ? `Après « ${shortLabel(text)} »` : "Au début du document";
    addZone({ id: `m${Date.now()}`, kind: mark, label, paragraph }, mark);
    setPlacing(null);
  }

  function pngFor(mark: SignatureMark): Uint8Array | null {
    if (mark === "SIGNATURE") return signature ? dataUrlToBytes(signature) : null;
    return stamp?.png ?? null;
  }

  async function build(): Promise<Built> {
    if (!loaded) throw new Error("Document non chargé");
    if (loaded.kind === "DOCX") {
      const placements = chosen.map((z) => ({ paragraph: z.paragraph ?? null, mark: marks[z.id]!, png: pngFor(marks[z.id]!)! }));
      const { signWordPackage } = await import("@/lib/services/document-signature-word");
      const bytes = signWordPackage(loaded.pkg, placements, new Date());
      return { bytes, pages: null };
    }
    const placements = chosen.map((z) => ({ page: z.page!, rect: z.rect!, png: pngFor(marks[z.id]!)! }));
    const bytes = await stampPdf(loaded.bytes, placements);
    return { bytes, pages: (await renderPdfPages(bytes, PAGE_WIDTH_PX)).pages };
  }

  function verify() {
    setError(null);
    if (chosen.length === 0) return setError("Choisissez au moins une case où poser votre signature ou le tampon.");
    if (chosen.some((z) => marks[z.id] === "SIGNATURE") && !signature) return setError("Dessinez d'abord votre signature (étape 1).");
    if (chosen.some((z) => marks[z.id] === "TAMPON") && !stamp) return setError("Aucun tampon n'est prêt : retirez-le des cases ou déposez votre tampon.");
    startTransition(async () => {
      try {
        setBuilt(await build());
      } catch {
        setError("La version signée n'a pas pu être fabriquée. Rechargez la page et recommencez.");
      }
    });
  }

  function save() {
    if (!built) return;
    const data = new FormData();
    data.set("establishmentId", context.establishmentId);
    data.set("documentTypeId", context.documentTypeId);
    data.set("versionId", context.versionId);
    data.set("marks", chosen.map((z) => marks[z.id]).join(","));
    data.set("file", new File([built.bytes as BlobPart], signedFilename(context.filename), { type: context.kind === "DOCX" ? DOCX_TYPE : "application/pdf" }));
    startTransition(async () => {
      const result = await saveSignedDocument(data);
      if ("error" in result) setError(result.error);
      else setSavedAt(result.signedAt);
    });
  }

  if (savedAt) {
    return (
      <section role="status" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
        <p className="flex items-center gap-2 text-xl font-bold text-ok-text">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          Document signé et enregistré.
        </p>
        <p className="text-base">EODA voit la version signée. Le document d&apos;origine est gardé tel quel.</p>
        <div className="flex flex-wrap gap-3">
          <a href={signedCopyPath(context.versionId)} className="inline-flex h-12 items-center rounded-[10px] bg-ink-fill px-5 font-bold text-on-ink">
            Télécharger la version signée
          </a>
          <Link href={CLIENT_DOCUMENTS_PATH} className="inline-flex h-12 items-center font-bold text-accent-text underline underline-offset-4">
            Retour à mes documents
          </Link>
        </div>
      </section>
    );
  }

  if (loadError) return <p role="alert" className="text-base text-danger-text">{loadError}</p>;
  if (!loaded) {
    return (
      <p role="status" className="flex items-center gap-2 text-base text-ink2">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Ouverture du document et recherche des cases de signature…
      </p>
    );
  }

  const pdfPages = built?.pages ?? (loaded.kind === "PDF" ? loaded.pages : null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* Le document */}
      <section aria-label="Le document" className="flex min-w-0 flex-col gap-4">
        {built && <p className="rounded-lg bg-highlight px-4 py-3 text-base font-bold">Voici la version signée : relisez chaque page avant d&apos;enregistrer.</p>}
        {placing && (
          <p role="status" className="rounded-lg bg-highlight px-4 py-3 text-base font-bold">
            {loaded.kind === "PDF" ? "Touchez la page à l'endroit où poser" : "Touchez la ligne après laquelle poser"}{" "}
            {placing === "SIGNATURE" ? "votre signature" : "le tampon"}.
          </p>
        )}
        {loaded.kind === "DOCX" ? (
          built ? (
            <DocxPreview key="signed" data={new Blob([built.bytes as BlobPart], { type: DOCX_TYPE })} title={`${context.documentLabel} — version signée`} onFailed={() => undefined} />
          ) : (
            <div
              onClick={placeInWord}
              className={cn(placing && "cursor-crosshair [&_article_p:hover]:bg-highlight [&_article_p:hover]:outline [&_article_p:hover]:outline-2 [&_article_p:hover]:outline-ambre")}
            >
              <DocxPreview key="original" url={originalUrl(context.versionId)} title={context.documentLabel} onFailed={() => undefined} />
            </div>
          )
        ) : (
          <>
            {loaded.kind === "PDF" && loaded.pageCount > loaded.pages.length && (
              <p className="text-base text-ink2">Seules les {loaded.pages.length} premières pages sont montrées et signables ici.</p>
            )}
            {pdfPages?.map((page) => (
              <div key={page.page} className="flex flex-col gap-1">
                <p className="text-sm text-ink2">Page {page.page}</p>
                <div
                  className={cn("relative w-full overflow-hidden rounded border border-line bg-white", placing && "cursor-crosshair")}
                  onClick={(event) => placeOnPage(event, page)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- page dessinée dans le navigateur (data:) */}
                  <img src={page.imageUrl} alt={`Page ${page.page} du document`} className="block w-full" />
                  {!built &&
                    zones
                      .filter((z) => z.page === page.page && z.rect)
                      .map((z) => (
                        <button
                          key={z.id}
                          type="button"
                          style={zoneStyle(z.rect!, page)}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMark(z.id, marks[z.id] ? null : z.kind);
                          }}
                          className={cn(
                            "absolute flex items-center justify-center rounded border-2 border-dashed text-sm font-bold",
                            marks[z.id] ? "border-ok-text bg-ok-soft/80 text-ok-text" : "border-ambre bg-highlight/60 text-ink"
                          )}
                        >
                          {marks[z.id] ? MARK_LABELS[marks[z.id]!] : "Case libre"}
                          <span className="sr-only"> — {z.label}, page {page.page}</span>
                        </button>
                      ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      {/* Les étapes */}
      <section aria-label="Les étapes" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-bold">1. Ma signature</h2>
          <SignaturePad label="Signature de la direction" onChange={(png) => {
              setSignature(png);
              invalidate();
            }} />
          <p className="text-sm text-ink2">Elle n&apos;est pas gardée : vous la dessinez à chaque document.</p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-bold">2. Le tampon</h2>
          {stampState === "loading" && <p className="text-base text-ink2">Préparation du tampon…</p>}
          {stampState === "none" && (
            <p className="text-base">
              Aucun tampon n&apos;est prêt. Déposez votre tampon dans « Mes documents », ligne « Tampon de la structure », puis revenez.
            </p>
          )}
          {stampState === "ready" && stamp && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- tampon détouré dans le navigateur (blob:) */}
              <img src={stamp.url} alt="Tampon de la structure" className="h-24 w-24 rounded border border-line bg-white object-contain" />
              <button
                type="button"
                onClick={() => {
                  setStampTurns(((stampTurns ?? 0) + 1) % 4);
                  invalidate();
                }}
                className="inline-flex h-12 items-center gap-2 rounded-[10px] border-2 border-line bg-card px-4 font-bold hover:bg-soft"
              >
                <RotateCw className="h-5 w-5" aria-hidden="true" /> Tourner
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-bold">3. Les cases</h2>
          {zones.length === 0 ? (
            <p className="text-base">
              Aucune case de signature n&apos;a été trouvée dans ce document.{" "}
              Choisissez vous-même où poser votre signature et le tampon.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {zones.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`zone-${z.id}`} className="min-w-0 flex-1 text-base">
                    {z.paragraph === null ? "Fin du document" : z.label}
                    {z.page ? <span className="text-ink2"> · page {z.page}</span> : null}
                  </label>
                  <select
                    id={`zone-${z.id}`}
                    value={marks[z.id] ?? ""}
                    onChange={(e) => setMark(z.id, (e.target.value || null) as SignatureMark | null)}
                    className="h-12 rounded-md border border-line bg-card px-2 text-base"
                  >
                    <option value="">Rien</option>
                    <option value="SIGNATURE">Ma signature</option>
                    <option value="TAMPON">Le tampon</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {(["SIGNATURE", "TAMPON"] as const).map((mark) => (
              <button
                key={mark}
                type="button"
                aria-pressed={placing === mark}
                disabled={built !== null}
                onClick={() => setPlacing(placing === mark ? null : mark)}
                className={cn(
                  "inline-flex h-12 items-center rounded-[10px] border-2 px-4 text-base font-bold hover:bg-soft",
                  placing === mark ? "border-accent-fill bg-highlight" : "border-line bg-card"
                )}
              >
                {mark === "SIGNATURE" ? "Choisir où signer" : "Choisir où tamponner"}
              </button>
            ))}
          </div>
          {placing && loaded.kind === "DOCX" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="place-after" className="text-base">
                Ou choisissez la ligne dans la liste :
              </label>
              <select
                id="place-after"
                value=""
                onChange={(e) => e.target.value && placeAfterParagraph(e.target.value === "end" ? null : Number(e.target.value), placing)}
                className="h-12 w-full rounded-md border border-line bg-card px-2 text-base"
              >
                <option value="">Poser après…</option>
                <option value="end">À la fin du document</option>
                {loaded.texts.map((text, paragraph) =>
                  text ? (
                    <option key={paragraph} value={paragraph}>
                      {shortLabel(text)}
                    </option>
                  ) : null
                )}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-bold">4. Vérifier et enregistrer</h2>
          <p className="text-sm text-ink2">Le document d&apos;origine est gardé. La version signée sera visible par EODA.</p>
          {!built ? (
            <button
              type="button"
              disabled={isPending}
              onClick={verify}
              className="inline-flex h-12 w-fit items-center gap-2 rounded-[10px] bg-ink-fill px-5 text-[17px] font-bold text-on-ink hover:bg-ink-fill/90"
            >
              {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              Voir la version signée
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={save}
                className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-ink-fill px-5 text-[17px] font-bold text-on-ink hover:bg-ink-fill/90"
              >
                {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                Signer et enregistrer
              </button>
              <button type="button" disabled={isPending} onClick={invalidate} className="h-12 text-base font-bold text-accent-text underline">
                Modifier
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="flex items-start gap-2 text-base text-danger-text">
              <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
