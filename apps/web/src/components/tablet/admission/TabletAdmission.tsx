"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileUp, Search, Send, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addPeople, cleanName, describeRosterImport, displayName, searchRoster, type RosterPerson } from "@/lib/services/survey-roster-service";
import {
  admissionArchiveFileName,
  buildAdmissionsCsv,
  displayLastName,
  frenchDay,
  fullName,
  isAdmissionDueForReview,
  latestAdmissionFor,
  type AdmissionRecord,
} from "@/lib/services/admission-service";
import { buildStoredZip } from "@/lib/services/zip-store";
import { TABLET_INPUT, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { RosterImportPanel } from "../survey/RosterImportPanel";
import { newPersonId, useSurveyRoster } from "../survey/use-survey-roster";
import { AdmissionWizard, type TabletDipc } from "./AdmissionWizard";
import { downloadBlob, sha256Hex, shareOrDownload, useAdmissions } from "./use-admissions";

// ─────────────────────────────────────────────────────────────────────────────
// ACCUEIL ET DIPC SUR LA TABLETTE (26/10/2026).
//
// liste des personnes (la MÊME que l'enquête) → accueillir → fiche une fois →
// contrat relu → points HAS expliqués → signatures → PDF gardé sur la tablette,
// envoyé à la personne, exporté vers Ximi ou le serveur de la structure.
// Rien ne part au serveur d'EODA (admission-service).
// ─────────────────────────────────────────────────────────────────────────────

type DipcText = Omit<TabletDipc, "sha256">;
type Screen = { kind: "home" } | { kind: "wizard"; person: RosterPerson | null } | { kind: "signed"; record: AdmissionRecord; stored: boolean };

function status(record: AdmissionRecord | null, today: Date): { label: string; tone: string } {
  if (!record) return { label: "DIPC à faire signer", tone: "border-dashed border-ink2 bg-card" };
  if (isAdmissionDueForReview(record, today)) return { label: `Signé le ${frenchDay(record.signedAt.slice(0, 10))} · à revoir`, tone: "border-amber-fill bg-highlight" };
  return { label: `Signé le ${frenchDay(record.signedAt.slice(0, 10))}`, tone: "border-ok-text bg-ok-soft" };
}

export function TabletAdmission({ establishmentId, structureName, staffName, dipc }: { establishmentId: string; structureName: string; staffName: string; dipc: DipcText }) {
  const { roster, update, loaded: rosterLoaded, storageWorks: rosterWorks } = useSurveyRoster(establishmentId);
  const { records, loaded, storageWorks, save, pdfOf } = useAdmissions(establishmentId);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [lastPdf, setLastPdf] = useState<Blob | null>(null);
  const [dipcSha, setDipcSha] = useState<string | null>(null);
  const today = new Date();

  useEffect(() => {
    void sha256Hex(new TextEncoder().encode(dipc.text)).then(setDipcSha);
  }, [dipc.text]);

  function go(next: Screen) {
    setScreen(next);
    setFlash(null);
    window.scrollTo(0, 0);
  }

  async function onSigned(record: AdmissionRecord, pdf: Blob) {
    // La personne rejoint la liste (enquête comprise) : son nom n'est saisi qu'une fois.
    if (!roster.people.some((p) => p.id === record.personId)) {
      update(addPeople(roster, [{ lastName: displayLastName(record.identity), firstName: cleanName(record.identity.firstName) }], () => record.personId));
    }
    setLastPdf(pdf);
    const stored = await save(record, pdf);
    go({ kind: "signed", record, stored });
  }

  async function openPdf(record: AdmissionRecord, mode: "share" | "download") {
    const pdf = (screen.kind === "signed" && screen.record.id === record.id ? lastPdf : null) ?? (await pdfOf(record.id));
    if (!pdf) return setFlash("Ce contrat n'est plus sur la tablette. Cherchez-le dans votre export (Ximi ou serveur).");
    if (mode === "download") return downloadBlob(record.pdfFileName, pdf);
    const result = await shareOrDownload(record.pdfFileName, pdf, `Contrat — ${fullName(record.identity)}`);
    setFlash(result === "shared" ? "Contrat envoyé." : result === "downloaded" ? "Contrat téléchargé sur la tablette." : null);
  }

  async function exportAll() {
    const files: { name: string; data: Uint8Array; modifiedAt: Date }[] = [];
    for (const record of records) {
      const pdf = await pdfOf(record.id);
      if (pdf) files.push({ name: record.pdfFileName, data: new Uint8Array(await pdf.arrayBuffer()), modifiedAt: new Date(record.signedAt) });
    }
    files.push({ name: "index-des-contrats.csv", data: new TextEncoder().encode(buildAdmissionsCsv(records)), modifiedAt: today });
    downloadBlob(admissionArchiveFileName(structureName, today), new Blob([buildStoredZip(files) as BlobPart], { type: "application/zip" }));
    setFlash(`${files.length - 1} contrat${files.length > 2 ? "s" : ""} exporté${files.length > 2 ? "s" : ""}, avec leur index. Rangez le fichier dans Ximi ou sur le serveur de la structure.`);
  }

  if (!loaded || !rosterLoaded || !dipcSha) return <p role="status">Chargement…</p>;

  if (screen.kind === "wizard") {
    return (
      <AdmissionWizard
        structureName={structureName}
        staffName={staffName}
        dipc={{ ...dipc, sha256: dipcSha }}
        person={screen.person && { personId: screen.person.id, lastName: screen.person.lastName, firstName: screen.person.firstName }}
        onSigned={onSigned}
        onCancel={() => go({ kind: "home" })}
      />
    );
  }

  if (screen.kind === "signed") {
    const { record, stored } = screen;
    return (
      <section role="status" className="mx-auto mt-6 flex max-w-[760px] flex-col items-center gap-5 text-center">
        <CheckCircle2 className="h-24 w-24 text-ok-text" aria-hidden="true" />
        <h1 className="text-[34px] font-bold">Contrat signé</h1>
        <p className="text-[20px]">{fullName(record.identity)} · le {frenchDay(record.signedAt.slice(0, 10))}</p>
        {!stored && (
          <p role="alert" className="rounded-xl border-2 border-danger-text px-4 py-3 font-bold text-danger-text">
            La tablette n&apos;a pas pu garder ce contrat. Téléchargez-le MAINTENANT, sinon il sera perdu.
          </p>
        )}
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <button type="button" className={TABLET_PRIMARY} onClick={() => void openPdf(record, "share")}>
            <Send className="h-6 w-6" aria-hidden="true" />
            Envoyer à la personne
          </button>
          <button type="button" className={TABLET_SECONDARY} onClick={() => void openPdf(record, "download")}>
            <Download className="h-6 w-6" aria-hidden="true" />
            Télécharger le PDF
          </button>
        </div>
        <Link href={`/tablette/enquete?personne=${encodeURIComponent(record.personId)}`} className={cn(TABLET_SECONDARY, "w-full")}>
          Plus tard : l&apos;enquête de satisfaction de cette personne
        </Link>
        {flash && <p className="text-[18px]">{flash}</p>}
        <button type="button" className={cn(TABLET_SECONDARY, "w-full")} onClick={() => go({ kind: "home" })}>
          Retour à la liste
        </button>
      </section>
    );
  }

  const shown = searchRoster(roster, query);
  return (
    <section aria-labelledby="admission-liste" className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <h1 id="admission-liste" className="text-[34px] font-bold leading-tight">Accueil et contrat (DIPC)</h1>

      {(!storageWorks || !rosterWorks) && (
        <p role="alert" className="rounded-xl border-2 border-danger-text px-4 py-3 font-bold text-danger-text">
          Cette tablette ne peut rien garder (navigation privée ?). Chaque contrat devra être téléchargé dès sa signature.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className={TABLET_PRIMARY} onClick={() => go({ kind: "wizard", person: null })}>
          <UserPlus className="h-6 w-6" aria-hidden="true" />
          Accueillir une nouvelle personne
        </button>
        <button type="button" className={TABLET_SECONDARY} onClick={() => setImporting(true)}>
          <FileUp className="h-6 w-6" aria-hidden="true" />
          Importer la liste (Ximi, Excel)
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <p className="text-[19px]">
          <span className="font-bold">{records.length} contrat{records.length > 1 ? "s" : ""}</span> signé{records.length > 1 ? "s" : ""} sur cette tablette.
          La tablette n&apos;est pas un coffre : exportez régulièrement vers Ximi ou le serveur de la structure.
        </p>
        <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => void exportAll()} disabled={records.length === 0}>
          <Download className="h-6 w-6" aria-hidden="true" />
          Exporter tous les contrats
        </button>
        {flash && <p className="text-[18px]">{flash}</p>}
      </div>

      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-6 w-6 text-ink2" aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom" aria-label="Rechercher une personne" className={cn(TABLET_INPUT, "pl-12")} />
      </label>

      <ul className="flex flex-col gap-2.5">
        {shown.map((person) => {
          const record = latestAdmissionFor(records, person.id);
          const state = status(record, today);
          return (
            <li key={person.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4">
              <span className="min-w-[12rem] flex-1 text-[21px] font-bold">{displayName(person)}</span>
              <span className={cn("rounded-full border-2 px-3 py-1 text-[16px] font-bold", state.tone)}>{state.label}</span>
              {record && (
                <button type="button" className={TABLET_SECONDARY} onClick={() => void openPdf(record, "share")}>
                  Envoyer
                </button>
              )}
              <button type="button" className={TABLET_SECONDARY} onClick={() => go({ kind: "wizard", person })}>
                {record ? "Nouveau contrat" : "Faire signer"}
              </button>
            </li>
          );
        })}
        {roster.people.length === 0 && <li className="text-[19px] text-ink2">Aucune personne sur cette tablette. Importez la liste ou accueillez une nouvelle personne.</li>}
      </ul>

      {importing && (
        <RosterImportPanel
          roster={roster}
          onClose={() => setImporting(false)}
          onImport={(plan) => {
            update(addPeople(roster, plan.people, newPersonId));
            setImporting(false);
            setFlash(describeRosterImport(plan));
          }}
        />
      )}
    </section>
  );
}
