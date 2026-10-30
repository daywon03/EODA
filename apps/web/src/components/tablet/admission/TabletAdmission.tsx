"use client";

import { useEffect, useState } from "react";
import { awarenessSheetIsWord, DEPARTEMENT_CONTRAT_CODE, DEPARTEMENT_TAMPON_CODE, type TabletAwarenessSheet } from "@/lib/services/awareness-sheet-links";
import Link from "next/link";
import { CheckCircle2, Download, FileText, FileUp, FolderOpen, Search, Send, UserPlus } from "lucide-react";
import { departementFormFileName, departementFormSigner } from "@/lib/services/departement-form-service";
import { trustedPersonName } from "@/lib/services/trusted-person-service";
import { loadTabletDipecWord, loadTabletRecapWord, type TabletDipecWord, type TabletRecapWord } from "./dipec-word-client";
import { changeFormFileName } from "@/lib/services/departement-change-form-service";
import { DepartementFormPanel } from "./DepartementFormPanel";
import { cn } from "@/lib/utils";
import { addPeople, cleanName, describeRosterImport, displayName, searchRoster, type RosterPerson } from "@/lib/services/survey-roster-service";
import {
  ADMISSION_EXPORT_ROOT,
  admissionArchiveFileName,
  admissionExportPath,
  admissionFolders,
  admissionState,
  buildAdmissionsCsv,
  sortAdmissions,
  displayLastName,
  frenchDay,
  fullName,
  latestAdmissionFor,
  type AdmissionRecord,
  type AdmissionState,
} from "@/lib/services/admission-service";
import { buildStoredZip } from "@/lib/services/zip-store";
import { TABLET_INPUT, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { RosterImportPanel } from "../survey/RosterImportPanel";
import { newPersonId, useSurveyRoster } from "../survey/use-survey-roster";
import { AdmissionWizard, type AdmissionExtras, type TabletDipc } from "./AdmissionWizard";
import { devisKey, downloadBlob, formKey, recapKey, sha256Hex, shareFilesOrDownload, signatureKey, useAdmissions, wordKey } from "./use-admissions";
import { PersonDossier } from "./PersonDossier";
import { tabletCan } from "@/lib/services/tablet-role-service";
import type { TabletRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// ACCUEIL ET DIPEC SUR LA TABLETTE (26/10/2026).
//
// liste des personnes (la MÊME que l'enquête) → accueillir → fiche une fois →
// contrat relu → points HAS expliqués → signatures → PDF gardé sur la tablette,
// envoyé à la personne, exporté vers Ximi ou le serveur de la structure.
// Rien ne part au serveur d'EODA (admission-service).
// ─────────────────────────────────────────────────────────────────────────────

type DipcText = Omit<TabletDipc, "sha256"> & { hasWord: boolean };
type Screen =
  | { kind: "home" }
  | { kind: "wizard"; person: RosterPerson | null }
  | { kind: "signed"; record: AdmissionRecord; stored: boolean }
  | { kind: "form"; record: AdmissionRecord; back: Screen }
  // Le dossier d'une personne (administrateur) : tous ses fichiers, rangés (30/10/2026).
  | { kind: "dossier"; personId: string; name: string };

// L'état se lit dans le service (admissionState) ; ici, seulement sa couleur.
const STATE_TONES: Record<AdmissionState, string> = {
  A_FAIRE: "border-dashed border-ink2 bg-card",
  SIGNE: "border-ok-text bg-ok-soft",
  A_REVOIR: "border-amber-fill bg-highlight",
  REFUS: "border-ink2 bg-soft",
  A_REPROPOSER: "border-amber-fill bg-highlight",
};

export function TabletAdmission({ establishmentId, structureName, structureAddress, staffName, dipc, sheets, tabletRole }: {
  establishmentId: string;
  // Ce que ce salarié peut faire (30/10/2026) : l'intervenant accueille et fait signer ;
  // l'administrateur voit aussi les contrats déjà faits, les dossiers, exporte.
  tabletRole: TabletRole;
  sheets: Readonly<Record<string, TabletAwarenessSheet>>;
  structureName: string;
  structureAddress: string;
  staffName: string;
  dipc: DipcText;
}) {
  const { roster, update, loaded: rosterLoaded, storageWorks: rosterWorks } = useSurveyRoster(establishmentId);
  const { records, loaded, storageWorks, save, saveForm, pdfOf } = useAdmissions(establishmentId);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: string; pdf: Blob; word: Blob | null; recap: Blob | null } | null>(null);
  const [dipcSha, setDipcSha] = useState<string | null>(null);
  // Le Word d'origine du DIPEC (27/10/2026) : le contrat signé sera CE document,
  // rempli. `undefined` : en cours de chargement ; `null` : copie en texte.
  const [word, setWord] = useState<TabletDipecWord | null | undefined>(dipc.hasWord ? undefined : null);
  const today = new Date();
  const canPast = tabletCan(tabletRole, "PAST_CONTRACTS");
  const canExport = tabletCan(tabletRole, "EXPORT");
  const canRoster = tabletCan(tabletRole, "ROSTER");

  useEffect(() => {
    if (!dipc.hasWord) return;
    void loadTabletDipecWord(dipc.versionId).then(setWord);
  }, [dipc.hasWord, dipc.versionId]);

  // Le contrat récapitulatif pour le Département (30/10/2026), s'il est validé et Word.
  const recapSheet = sheets[DEPARTEMENT_CONTRAT_CODE];
  const recapVersionId = recapSheet && awarenessSheetIsWord(recapSheet.originalFilename) ? recapSheet.versionId : null;
  const [recap, setRecap] = useState<TabletRecapWord | null>(null);
  useEffect(() => {
    if (!recapVersionId) return;
    void loadTabletRecapWord(recapVersionId).then(setRecap);
  }, [recapVersionId]);

  // L'empreinte du DIPEC présenté : celle du Word d'EODA, sinon celle du texte.
  useEffect(() => {
    if (word === undefined) return;
    if (word) setDipcSha(word.sha256);
    else void sha256Hex(new TextEncoder().encode(dipc.text)).then(setDipcSha);
  }, [word, dipc.text]);

  function go(next: Screen) {
    setScreen(next);
    setFlash(null);
    window.scrollTo(0, 0);
  }

  // Contrat signé ou refus : la même fiche, rangée de la même façon.
  async function onRecorded(record: AdmissionRecord, pdf: Blob, extras: AdmissionExtras) {
    // La personne rejoint la liste (enquête comprise) : son nom n'est saisi qu'une fois.
    if (!roster.people.some((p) => p.id === record.personId)) {
      update(addPeople(roster, [{ lastName: displayLastName(record.identity), firstName: cleanName(record.identity.firstName) }], () => record.personId));
    }
    setLast({ id: record.id, pdf, word: extras.word, recap: extras.recap });
    const stored = await save(record, pdf, extras);
    go({ kind: "signed", record, stored });
  }

  // Le contrat Word signé (quand il existe) PUIS l'attestation PDF : ce qui part
  // ensemble, à la personne comme au Département. Le dernier signé est gardé en
  // mémoire, au cas où la tablette n'aurait pas pu le ranger.
  async function contractFiles(record: AdmissionRecord): Promise<{ fileName: string; blob: Blob }[]> {
    const fresh = last?.id === record.id ? last : null;
    const pdf = fresh?.pdf ?? (await pdfOf(record.id));
    const wordBlob = record.word ? (fresh?.word ?? (await pdfOf(wordKey(record.id)))) : null;
    return [...(record.word && wordBlob ? [{ fileName: record.word.fileName, blob: wordBlob }] : []), ...(pdf ? [{ fileName: record.pdfFileName, blob: pdf }] : [])];
  }

  // Ce qui part au Département avec le formulaire : le contrat récapitulatif signé
  // (30/10/2026) quand la structure en a un, sinon le contrat (Word + attestation).
  async function recapFile(record: AdmissionRecord): Promise<{ fileName: string; blob: Blob } | null> {
    if (!record.recap) return null;
    const blob = (last?.id === record.id ? last.recap : null) ?? (await pdfOf(recapKey(record.id)));
    return blob ? { fileName: record.recap.fileName, blob } : null;
  }

  async function departementFiles(record: AdmissionRecord): Promise<{ fileName: string; blob: Blob }[]> {
    const recapContract = await recapFile(record);
    return recapContract ? [recapContract] : contractFiles(record);
  }

  async function openPdf(record: AdmissionRecord, mode: "share" | "download") {
    const files = await contractFiles(record);
    const what = record.outcome === "REFUS" ? "L'attestation de refus" : "Le contrat";
    if (files.length === 0) return setFlash(`${what} n'est plus sur la tablette. Cherchez-le dans votre export (Ximi ou serveur).`);
    if (mode === "download") return files.forEach((f) => downloadBlob(f.fileName, f.blob));
    const result = await shareFilesOrDownload(files, `${record.outcome === "REFUS" ? "Refus du DIPEC" : "Contrat"} — ${fullName(record.identity)}`);
    setFlash(result === "shared" ? `${what} est envoyé.` : result === "downloaded" ? `${what} est téléchargé sur la tablette.` : null);
  }

  // Personne de confiance absente : la tablette lui envoie le contrat (annexe 3.2 à
  // cosigner) par la feuille de partage — sa propre messagerie, jamais le serveur.
  async function sendToTrustedPerson(record: AdmissionRecord) {
    const files = await contractFiles(record);
    if (files.length === 0) return setFlash("Le contrat n'est plus sur la tablette. Cherchez-le dans votre export (Ximi ou serveur).");
    const email = record.trustedPerson?.email ?? "";
    const result = await shareFilesOrDownload(files, `Désignation de la personne de confiance — à cosigner (annexe 3.2) — ${fullName(record.identity)}`);
    setFlash(
      result === "shared"
        ? `Envoyé. Adresse de ${trustedPersonName(record.trustedPerson)} : ${email}. Elle cosigne l'annexe 3.2 et vous la renvoie.`
        : result === "downloaded"
          ? `Téléchargé. À envoyer à ${email} : elle cosigne l'annexe 3.2 et vous la renvoie.`
          : null
    );
  }

  // TOUS les fichiers d'un enregistrement : contrat (Word + attestation), contrat
  // récapitulatif, formulaires du Département, devis d'origine (30/10/2026) — ce que
  // range le dossier de la personne.
  async function recordFiles(record: AdmissionRecord): Promise<{ fileName: string; blob: Blob }[]> {
    const files = await contractFiles(record);
    const recapContract = await recapFile(record);
    if (recapContract) files.push(recapContract);
    const form = await pdfOf(formKey(record.id, "INITIALE"));
    if (form) files.push({ fileName: departementFormFileName(structureName, record, new Date(record.signedAt)), blob: form });
    const change = await pdfOf(formKey(record.id, "CHANGEMENT"));
    if (change) files.push({ fileName: changeFormFileName(structureName, record, new Date(record.signedAt)), blob: change });
    const devisFile = record.devis ? await pdfOf(devisKey(record.id)) : null;
    if (record.devis && devisFile) files.push({ fileName: record.devis.fileName, blob: devisFile });
    return files;
  }

  // Un dossier par personne (30/10/2026) : DIPEC/<NOM-Prenom>/…, l'index à la racine.
  async function zipOf(selection: readonly AdmissionRecord[], withIndex: boolean): Promise<Blob> {
    const folders = admissionFolders(records);
    const files: { name: string; data: Uint8Array; modifiedAt: Date }[] = [];
    for (const record of selection) {
      const folder = folders.get(record.personId) ?? "Personne";
      for (const file of await recordFiles(record)) {
        files.push({ name: admissionExportPath(folder, file.fileName), data: new Uint8Array(await file.blob.arrayBuffer()), modifiedAt: new Date(record.signedAt) });
      }
    }
    if (withIndex) files.push({ name: `${ADMISSION_EXPORT_ROOT}/index-des-contrats.csv`, data: new TextEncoder().encode(buildAdmissionsCsv(selection)), modifiedAt: today });
    return new Blob([buildStoredZip(files) as BlobPart], { type: "application/zip" });
  }

  async function exportAll() {
    downloadBlob(admissionArchiveFileName(structureName, today), await zipOf(records, true));
    const people = admissionFolders(records).size;
    setFlash(`${people} dossier${people > 1 ? "s" : ""} exporté${people > 1 ? "s" : ""}, un par personne (contrats, refus, formulaires, devis), avec l'index. Rangez le fichier dans Ximi ou sur le serveur de la structure.`);
  }

  if (!loaded || !rosterLoaded || !dipcSha || word === undefined) return <p role="status">Chargement du contrat…</p>;

  if (screen.kind === "dossier") {
    return (
      <PersonDossier
        name={screen.name}
        records={sortAdmissions(records.filter((r) => r.personId === screen.personId))}
        recordFiles={recordFiles}
        zip={(selection) => zipOf(selection, false)}
        zipName={`${admissionFolders(records).get(screen.personId) ?? "Personne"}.zip`}
        onBack={() => go({ kind: "home" })}
      />
    );
  }

  if (screen.kind === "form") {
    const { record, back } = screen;
    return (
      <DepartementFormPanel
        record={record}
        structure={{ name: structureName, address: structureAddress }}
        contractFiles={() => departementFiles(record)}
        withRecap={record.recap !== null}
        stampVersionId={sheets[DEPARTEMENT_TAMPON_CODE]?.versionId ?? null}
        contractSignature={() => pdfOf(signatureKey(record.id, departementFormSigner(record)))}
        onSaved={(pdf, kind) => saveForm(record.id, pdf, kind)}
        savedForm={(kind) => pdfOf(formKey(record.id, kind))}
        onBack={() => go(back)}
      />
    );
  }

  if (screen.kind === "wizard") {
    return (
      <AdmissionWizard
        structureName={structureName}
        staffName={staffName}
        dipc={{ versionId: dipc.versionId, versionNumber: dipc.versionNumber, validatedOn: dipc.validatedOn, text: dipc.text, sha256: dipcSha }}
        word={word}
        recap={recap}
        sheets={sheets}
        person={screen.person && { personId: screen.person.id, lastName: screen.person.lastName, firstName: screen.person.firstName }}
        onRecorded={onRecorded}
        onCancel={() => go({ kind: "home" })}
      />
    );
  }

  if (screen.kind === "signed") {
    const { record, stored } = screen;
    if (record.outcome === "REFUS") {
      return (
        <section role="status" className="mx-auto mt-6 flex max-w-[760px] flex-col items-center gap-5 text-center">
          <h1 className="text-[34px] font-bold">Refus enregistré</h1>
          <p className="text-[20px]">
            {fullName(record.identity)} ne souhaite pas signer. C&apos;est noté dans son dossier. Le contrat lui sera reproposé le{" "}
            <span className="font-bold">{frenchDay(record.refusal?.reproposeOn ?? "")}</span>.
          </p>
          {!stored && (
            <p role="alert" className="rounded-xl border-2 border-danger-text px-4 py-3 font-bold text-danger-text">
              La tablette n&apos;a pas pu garder cette attestation. Téléchargez-la MAINTENANT, sinon elle sera perdue.
            </p>
          )}
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <button type="button" className={TABLET_PRIMARY} onClick={() => void openPdf(record, "share")}>
              <Send className="h-6 w-6" aria-hidden="true" />
              Remettre l&apos;attestation
            </button>
            <button type="button" className={TABLET_SECONDARY} onClick={() => void openPdf(record, "download")}>
              <Download className="h-6 w-6" aria-hidden="true" />
              Télécharger le PDF
            </button>
          </div>
          {flash && <p className="text-[18px]">{flash}</p>}
          <button type="button" className={cn(TABLET_SECONDARY, "w-full")} onClick={() => go({ kind: "home" })}>
            Retour à la liste
          </button>
        </section>
      );
    }
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
            {record.word ? "Télécharger (Word + attestation)" : "Télécharger le PDF"}
          </button>
        </div>
        {record.trustedPerson?.presence === "ABSENTE" && (
          <button type="button" className={cn(TABLET_SECONDARY, "w-full")} onClick={() => void sendToTrustedPerson(record)}>
            <Send className="h-6 w-6" aria-hidden="true" />
            Envoyer à la personne de confiance ({record.trustedPerson.email}) pour cosigner
          </button>
        )}
        <button type="button" className={cn(TABLET_SECONDARY, "w-full")} onClick={() => go({ kind: "form", record, back: screen })}>
          <FileText className="h-6 w-6" aria-hidden="true" />
          Formulaire du Département (APA, PCH, aide-ménagère)
        </button>
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
      <h1 id="admission-liste" className="text-[34px] font-bold leading-tight">Accueil et contrat (DIPEC)</h1>

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
        {canRoster && (
          <button type="button" className={TABLET_SECONDARY} onClick={() => setImporting(true)}>
            <FileUp className="h-6 w-6" aria-hidden="true" />
            Importer la liste (Ximi, Excel)
          </button>
        )}
      </div>

      {/* 30/10/2026 : un intervenant ne revoit pas les contrats déjà faits (rôle tablette).
          On le DIT, plutôt que de laisser des boutons disparaître sans explication. */}
      {!canPast && records.length > 0 && (
        <p className="rounded-xl bg-soft px-4 py-3 text-[18px]">
          Les contrats déjà signés (dossier, envoi, formulaire du Département) s&apos;ouvrent avec un code <span className="font-bold">Administrateur</span>. La direction donne ce rôle dans le portail : Personnes, puis Tablettes et codes des intervenants.
        </p>
      )}

      {canExport && (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <p className="text-[19px]">
          <span className="font-bold">{records.length} contrat{records.length > 1 ? "s" : ""}</span> signé{records.length > 1 ? "s" : ""} sur cette tablette.
          La tablette n&apos;est pas un coffre : exportez régulièrement vers Ximi ou le serveur de la structure.
        </p>
        <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => void exportAll()} disabled={records.length === 0}>
          <Download className="h-6 w-6" aria-hidden="true" />
          Exporter tous les contrats (un dossier par personne)
        </button>
        {flash && <p className="text-[18px]">{flash}</p>}
      </div>
      )}

      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-6 w-6 text-ink2" aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom" aria-label="Rechercher une personne" className={cn(TABLET_INPUT, "pl-12")} />
      </label>

      <ul className="flex flex-col gap-2.5">
        {shown.map((person) => {
          const record = latestAdmissionFor(records, person.id);
          const state = admissionState(record, today);
          const tone = STATE_TONES[state.state];
          return (
            <li key={person.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4">
              <span className="min-w-[12rem] flex-1 text-[21px] font-bold">{displayName(person)}</span>
              <span className={cn("rounded-full border-2 px-3 py-1 text-[16px] font-bold", tone)}>{state.label}</span>
              {record?.trustedPerson?.presence === "ABSENTE" && <span className="text-[16px] text-ink2">Personne de confiance : cosignature à recueillir</span>}
              {record && canPast && (
                <>
                  <button type="button" className={TABLET_SECONDARY} onClick={() => go({ kind: "dossier", personId: person.id, name: displayName(person) })}>
                    <FolderOpen className="h-5 w-5" aria-hidden="true" />
                    Dossier
                  </button>
                  <button type="button" className={TABLET_SECONDARY} onClick={() => void openPdf(record, "share")}>
                    Envoyer
                  </button>
                  {record.outcome === "SIGNE" && (
                    <button type="button" className={TABLET_SECONDARY} onClick={() => go({ kind: "form", record, back: { kind: "home" } })}>
                      Formulaire 93
                    </button>
                  )}
                </>
              )}
              <button type="button" className={TABLET_SECONDARY} onClick={() => go({ kind: "wizard", person })}>
                {!record ? "Faire signer" : record.outcome === "REFUS" ? "Reproposer le contrat" : "Nouveau contrat"}
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
