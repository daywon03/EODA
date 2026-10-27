"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, FileText, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { fullName, type AdmissionRecord } from "@/lib/services/admission-service";
import { DEPARTEMENT_FORM, departementFormFileName, departementFormGaps, planDepartementForm } from "@/lib/services/departement-form-service";
import {
  CHANGE_FORM,
  changeFormFileName,
  changeFormProblems,
  defaultActiveServices,
  planChangeForm,
  type ActiveService,
  type NewServiceMode,
  type StoppedService,
} from "@/lib/services/departement-change-form-service";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { SignaturePad } from "../SignaturePad";
import { ChangeSituationFields } from "./ChangeSituationFields";
import { downloadBlob, sha256Hex, shareFilesOrDownload, type DepartementFormKind } from "./use-admissions";

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRES DU DÉPARTEMENT (93) remplis depuis la fiche (27/10/2026) :
//   - « déclaration initiale » : la personne met en œuvre son plan d'aide pour la
//     première fois ;
//   - « changement de situation » : arrêt d'un service, nouveau service, heures.
// Tout se fait dans le navigateur : le PDF officiel vierge est chargé, rempli, rangé
// sur la tablette, puis envoyé AVEC le contrat — le Département exige les deux.
// Les déclarations sur l'honneur se cochent par la personne, jamais d'office.
// ─────────────────────────────────────────────────────────────────────────────

function Tick({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className={cn("flex min-h-[68px] w-full items-center gap-3.5 rounded-xl border-2 px-3.5 py-2 text-left text-[19px]", on ? "border-ok-text bg-ok-soft" : "border-line bg-card")}>
      <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2", on ? "border-ok-text bg-green-fill" : "border-muted bg-card")}>
        {on && <Check className="h-5 w-5" aria-hidden="true" />}
      </span>
      <span>{children}</span>
    </button>
  );
}

const KINDS: { value: DepartementFormKind; label: string; hint: string }[] = [
  { value: "INITIALE", label: "Déclaration initiale", hint: "Première mise en œuvre du plan d'aide" },
  { value: "CHANGEMENT", label: "Changement de situation", hint: "Arrêt d'un service, nouveau service, heures" },
];

// D'où vient la signature du formulaire : celle du contrat (par défaut), une nouvelle
// sur la tablette, ou le papier.
type SignatureSource = "CONTRAT" | "TABLETTE" | "PAPIER";

export function DepartementFormPanel({ record, structure, contractFiles, contractSignature, onSaved, onBack }: {
  record: AdmissionRecord;
  structure: { name: string; address: string };
  // Le contrat qui part avec le formulaire (le Département exige les deux).
  contractFiles: () => Promise<{ fileName: string; blob: Blob }[]>;
  // La signature donnée sur le contrat par la personne (ou son tuteur), si la tablette la garde.
  contractSignature: () => Promise<Blob | null>;
  onSaved: (pdf: Blob, kind: DepartementFormKind) => Promise<boolean>;
  onBack: () => void;
}) {
  const [kind, setKind] = useState<DepartementFormKind>("INITIALE");
  const [certifies, setCertifies] = useState(false);
  const [replaces, setReplaces] = useState(false);
  const [accepts, setAccepts] = useState(false);
  const [source, setSource] = useState<SignatureSource>("TABLETTE");
  const [kept, setKept] = useState<{ blob: Blob; url: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const onPaper = source === "PAPIER";

  // La signature du contrat, reprise d'office quand la tablette l'a gardée.
  useEffect(() => {
    let url: string | null = null;
    void contractSignature().then((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setKept({ blob, url });
      setSource("CONTRAT");
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [contractSignature]);
  const [stopped, setStopped] = useState<StoppedService[]>([]);
  const [newService, setNewService] = useState<NewServiceMode>("");
  const [hoursChange, setHoursChange] = useState(false);
  const [services, setServices] = useState<ActiveService[]>(() => defaultActiveServices(record, structure, new Date()));
  const [form, setForm] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isChange = kind === "CHANGEMENT";
  const spec = isChange ? CHANGE_FORM : DEPARTEMENT_FORM;
  const gaps = departementFormGaps(record).filter((gap) => !isChange || !gap.includes("début d'intervention"));
  const fileName = isChange ? changeFormFileName(structure.name, record, new Date()) : departementFormFileName(structure.name, record, new Date());
  const signer = record.contact?.kind === "TUTEUR" ? "Le tuteur" : "La personne";

  function chooseKind(next: DepartementFormKind) {
    setKind(next);
    setForm(null);
    setMessage(null);
  }

  async function build() {
    const problems = isChange ? changeFormProblems({ stopped, newService, hoursChange, services }) : [];
    if (problems.length > 0) return setMessage(problems.join(" "));
    if (source === "TABLETTE" && !signature) return setMessage(`${signer} doit signer dans le cadre, ou choisissez « signer sur papier ».`);
    setBusy(true);
    setMessage(null);
    try {
      const official = new Uint8Array(await (await fetch(spec.path)).arrayBuffer());
      const { fillOfficialForm } = await import("@/lib/services/departement-form-pdf");
      const { pngDataUrlToBytes } = await import("@/lib/services/admission-pdf");
      const common = { record, certifies, acceptsTransmission: accepts, signedOn: new Date(), withSignature: !onPaper };
      const items = isChange
        ? planChangeForm({ ...common, stopped, newService, hoursChange, services: newService || hoursChange ? services : [], replacesPrevious: replaces })
        : planDepartementForm({ ...common, structure });
      const bytes = await fillOfficialForm({
        officialPdf: official,
        officialSha256: spec.sha256,
        actualSha256: await sha256Hex(official),
        items,
        signaturePng: source === "PAPIER" ? null : source === "CONTRAT" && kept ? new Uint8Array(await kept.blob.arrayBuffer()) : pngDataUrlToBytes(signature ?? ""),
      });
      const pdf = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setForm(pdf);
      const stored = await onSaved(pdf, kind);
      setMessage(stored ? "Formulaire prêt." : "Formulaire prêt. La tablette n'a pas pu le garder : envoyez-le ou téléchargez-le maintenant.");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "OfficialFormMismatchError" ? error.message : "Le formulaire n'a pas pu être fabriqué. Vérifiez la connexion, puis recommencez.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!form) return;
    const files = [{ fileName, blob: form }, ...(await contractFiles())];
    const result = await shareFilesOrDownload(files, `${spec.title} — ${fullName(record.identity)}`);
    setMessage(
      result === "shared"
        ? `Envoyé. Le Département attend les deux pièces à ${DEPARTEMENT_FORM.sendTo}.`
        : result === "downloaded"
          ? `Téléchargé. À envoyer avec le contrat à ${DEPARTEMENT_FORM.sendTo}.`
          : null
    );
  }

  return (
    <section aria-labelledby="formulaire-titre" className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={onBack}>
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        Retour
      </button>
      <div>
        <h1 id="formulaire-titre" className="text-[32px] font-bold leading-tight">Formulaire du Département</h1>
        <p className="mt-1 text-[19px]">{spec.title} · {fullName(record.identity)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Quel formulaire ?">
        {KINDS.map((k) => (
          <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => chooseKind(k.value)} className={cn("flex min-h-[72px] flex-col justify-center rounded-xl border-2 px-4 py-2 text-left", kind === k.value ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
            <span className="text-[20px] font-bold">{k.label}</span>
            <span className="text-[17px]">{k.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-[19px]">
        Rempli avec la fiche de la personne. Il part au Département <span className="font-bold">avec le contrat</span>, à {DEPARTEMENT_FORM.sendTo}.
      </p>
      {gaps.length > 0 && (
        <p className="rounded-xl bg-soft px-4 py-3 text-[18px]">
          Pas dans la fiche, donc à compléter à la main sur le formulaire : {gaps.join(", ")}.
        </p>
      )}

      {!form && (
        <>
          {isChange && (
            <ChangeSituationFields
              stopped={stopped}
              newService={newService}
              hoursChange={hoursChange}
              services={services}
              onStopped={setStopped}
              onNewService={setNewService}
              onHoursChange={setHoursChange}
              onServices={setServices}
            />
          )}
          <section aria-labelledby="formulaire-declaration" className="flex flex-col gap-2.5">
            <h2 id="formulaire-declaration" className="text-[24px] font-bold">Déclaration sur l&apos;honneur</h2>
            <p className="text-[18px] text-ink2">Lisez chaque phrase {signer === "Le tuteur" ? "au tuteur" : "à la personne"}, et cochez seulement si elle est d&apos;accord.</p>
            <Tick on={certifies} onToggle={() => setCertifies(!certifies)}>
              Je certifie sur l&apos;honneur l&apos;exactitude des renseignements et je m&apos;engage à signaler tout changement au Conseil départemental.
            </Tick>
            {isChange && (
              <Tick on={replaces} onToggle={() => setReplaces(!replaces)}>
                Je confirme que ces informations annulent et remplacent toute information transmise avant, sur les services et leurs heures.
              </Tick>
            )}
            <Tick on={accepts} onToggle={() => setAccepts(!accepts)}>
              J&apos;accepte que le service transmette ces informations au Conseil départemental de la Seine-Saint-Denis.
            </Tick>
          </section>
          <section aria-labelledby="formulaire-signature" className="flex flex-col gap-2.5">
            <h2 id="formulaire-signature" className="text-[24px] font-bold">Signature</h2>
            {kept && (
              <Tick on={source === "CONTRAT"} onToggle={() => setSource(source === "CONTRAT" ? "TABLETTE" : "CONTRAT")}>
                <span className="flex flex-col gap-2">
                  Reprendre la signature donnée sur le contrat ({signer === "Le tuteur" ? "le tuteur" : "la personne"})
                  {/* eslint-disable-next-line @next/next/no-img-element -- image locale (blob:), jamais optimisée par le serveur */}
                  <img src={kept.url} alt={`Signature de ${signer === "Le tuteur" ? "du tuteur" : "la personne"} sur le contrat`} className="h-16 w-auto self-start rounded border border-line bg-white" />
                </span>
              </Tick>
            )}
            <Tick on={onPaper} onToggle={() => setSource(onPaper ? (kept ? "CONTRAT" : "TABLETTE") : "PAPIER")}>
              Signer sur papier, une fois le formulaire imprimé
            </Tick>
            {source === "TABLETTE" && <SignaturePad key={kind} label={`${signer} — formulaire du Département`} onChange={setSignature} />}
          </section>
          <button type="button" className={TABLET_PRIMARY} onClick={() => void build()} disabled={busy} aria-busy={busy}>
            <FileText className="h-6 w-6" aria-hidden="true" />
            {busy ? "Fabrication du formulaire…" : "Fabriquer le formulaire"}
          </button>
        </>
      )}

      {form && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className={TABLET_PRIMARY} onClick={() => void send()}>
            <Send className="h-6 w-6" aria-hidden="true" />
            Envoyer (formulaire + contrat)
          </button>
          <button type="button" className={TABLET_SECONDARY} onClick={() => downloadBlob(fileName, form)}>
            <Download className="h-6 w-6" aria-hidden="true" />
            Télécharger le formulaire
          </button>
        </div>
      )}
      {message && <p role="status" className="text-[19px] font-bold">{message}</p>}
    </section>
  );
}
