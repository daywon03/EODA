"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMISSION_EXPLANATIONS_VERSION, type HandedDocumentId } from "@/content/admission/explications";
import { planAdmissionDocument } from "@/lib/services/admission-document-service";
import {
  admissionFieldValues,
  admissionPdfFileName,
  aidProblems,
  contactProblems,
  EMPTY_AID,
  EMPTY_CONTACT,
  EMPTY_IDENTITY,
  dipcEntryValues,
  fullName,
  identityProblems,
  mergeDipcBlocks,
  missingExplanations,
  missingHandedDocuments,
  requiredSigners,
  signerName,
  signingProblems,
  SIGNER_LABELS,
  type AdmissionContact,
  type AdmissionRecord,
  type AdmissionSigner,
} from "@/lib/services/admission-service";
import { TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { SignaturePad } from "../SignaturePad";
import { AdmissionExplainStep } from "./AdmissionExplainStep";
import { AdmissionIdentityStep } from "./AdmissionIdentityStep";
import { AdmissionPreview } from "./AdmissionPreview";
import { AdmissionProjectStep } from "./AdmissionProjectStep";
import { sha256Hex } from "./use-admissions";
import { prepareDipcForTablet } from "@/lib/services/dipc-tablet-preparation";

export type TabletDipc = { versionId: string; versionNumber: number; validatedOn: string; text: string; sha256: string };

const STEPS = ["La personne", "Le projet", "Le contrat", "À expliquer", "Signatures"] as const;
const STEP = { PERSON: 0, PROJECT: 1, CONTRACT: 2, EXPLAIN: 3, SIGN: 4 } as const;

function contactOrNull(contact: AdmissionContact): AdmissionContact | null {
  return contact.kind ? contact : null;
}

export function AdmissionWizard({ structureName, staffName, dipc, person, onSigned, onCancel }: {
  structureName: string;
  staffName: string;
  dipc: TabletDipc;
  person: { personId: string; lastName: string; firstName: string } | null;
  onSigned: (record: AdmissionRecord, pdf: Blob) => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState({ ...EMPTY_IDENTITY, birthName: person?.lastName ?? "", firstName: person?.firstName ?? "" });
  const [aid, setAid] = useState(EMPTY_AID);
  const [contact, setContact] = useState<AdmissionContact>(EMPTY_CONTACT);
  const [explained, setExplained] = useState<Record<string, string>>({});
  const [handed, setHanded] = useState<Partial<Record<HandedDocumentId, string>>>({});
  const [signatures, setSignatures] = useState<Partial<Record<AdmissionSigner, string>>>({});
  // Les manques ne s'affichent qu'après un premier essai, puis se recalculent à
  // chaque geste : un message qui reste affiché après correction fait douter.
  const [checked, setChecked] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // La copie du DIPC pour la tablette : dérivée du texte validé, jamais rangée.
  const prepared = useMemo(() => prepareDipcForTablet(dipc.text), [dipc.text]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const linked = contactOrNull(contact);
  const entries = useMemo(() => dipcEntryValues(prepared, texts, checks), [prepared, texts, checks]);
  const merged = useMemo(
    () => mergeDipcBlocks(prepared.blocks, admissionFieldValues({ structureName, identity, aid, contact: linked, staffName, signedOn: new Date() }), entries),
    [prepared, structureName, identity, aid, linked, staffName, entries]
  );
  const docInput = { structureName, identity, aid, contact: linked, dipc: { ...dipc, blocks: merged.blocks }, explained, handed, explanationsVersion: ADMISSION_EXPLANATIONS_VERSION, staffName };
  const signers = requiredSigners(linked);

  function stepProblems(index: number): string[] {
    const today = new Date();
    if (index === STEP.PERSON) return [...identityProblems(identity, today), ...aidProblems(aid), ...contactProblems(linked)];
    if (index === STEP.PROJECT) return [];
    if (index === STEP.CONTRACT) return merged.unknownFields.length > 0 ? [`Le DIPC contient un champ inconnu (${merged.unknownFields.join(", ")}). Prévenez EODA : on ne fait pas signer ce contrat.`] : [];
    if (index === STEP.EXPLAIN) {
      const points = missingExplanations(explained);
      const docs = missingHandedDocuments(handed);
      return [...(points.length > 0 ? [`Encore ${points.length} point${points.length > 1 ? "s" : ""} à expliquer.`] : []), ...(docs.length > 0 ? [`Pas encore remis : ${docs.join(", ")}.`] : [])];
    }
    return signingProblems({ identity, aid, contact: linked, explained, handed, signatures, unknownDipcFields: merged.unknownFields }, today);
  }

  function go(next: number) {
    setChecked(false);
    setSignError(null);
    setStep(next);
    window.scrollTo(0, 0);
  }

  function next() {
    if (stepProblems(step).length > 0) return setChecked(true);
    if (step < STEPS.length - 1) return go(step + 1);
    void sign();
  }

  const problems = [...(checked ? stepProblems(step) : []), ...(signError ? [signError] : [])];

  async function sign() {
    setBusy(true);
    try {
      const signedAt = new Date();
      const values = admissionFieldValues({ structureName, identity, aid, contact: linked, staffName, signedOn: signedAt });
      const filled = mergeDipcBlocks(prepared.blocks, values, entries).blocks;
      const blocks = planAdmissionDocument({ ...docInput, dipc: { ...dipc, blocks: filled }, signedAt });
      // Chargé ici seulement : la bibliothèque PDF ne pèse pas sur l'ouverture.
      const { renderAdmissionPdf, pngDataUrlToBytes } = await import("@/lib/services/admission-pdf");
      const images: Partial<Record<AdmissionSigner, Uint8Array>> = {};
      for (const signer of signers) {
        const bytes = pngDataUrlToBytes(signatures[signer] ?? "");
        if (!bytes) throw new Error("signature");
        images[signer] = bytes;
      }
      const name = fullName(identity);
      const pdf = new Blob([(await renderAdmissionPdf({ blocks, signatures: images, footer: `DIPC — ${structureName} — ${name}`, title: `DIPC — ${name}`, signedAt })) as BlobPart], { type: "application/pdf" });
      const record: AdmissionRecord = {
        version: 1,
        id: window.crypto.randomUUID(),
        personId: person?.personId ?? window.crypto.randomUUID(),
        identity,
        aid,
        contact: linked,
        explanationsVersion: ADMISSION_EXPLANATIONS_VERSION,
        explained,
        handed,
        signers,
        signedAt: signedAt.toISOString(),
        staffName,
        dipc: { versionId: dipc.versionId, versionNumber: dipc.versionNumber, validatedOn: dipc.validatedOn, sha256: dipc.sha256 },
        pdfFileName: admissionPdfFileName(structureName, identity, signedAt),
        // L'empreinte porte sur les octets mêmes qui sont rangés et envoyés.
        pdfSha256: await sha256Hex(await pdf.arrayBuffer()),
      };
      await onSigned(record, pdf);
    } catch {
      setSignError("Le contrat n'a pas pu être fabriqué. Vérifiez les signatures, puis recommencez la signature.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admission-titre" className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={cn("flex h-12 items-center gap-2 rounded-full border-2 px-4 text-[17px]", i === step ? "border-ink bg-ink-fill font-bold text-on-ink" : i < step ? "border-line bg-soft" : "border-line bg-card")}>
            {i < step ? <Check className="h-4 w-4" aria-label="fait" /> : <span className="tabular-nums">{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      <h1 id="admission-titre" className="text-[34px] font-bold leading-tight">
        {step === STEP.PERSON && "Qui accueillons-nous ?"}
        {step === STEP.PROJECT && "Ce que prévoit le contrat"}
        {step === STEP.CONTRACT && "Relisez le contrat ensemble"}
        {step === STEP.EXPLAIN && "À expliquer à la personne"}
        {step === STEP.SIGN && "Signatures"}
      </h1>

      {step === STEP.PERSON && <AdmissionIdentityStep identity={identity} aid={aid} contact={contact} onIdentity={setIdentity} onAid={setAid} onContact={setContact} />}

      {step === STEP.PROJECT && (
        <AdmissionProjectStep
          freeFields={prepared.freeFields}
          checkFields={prepared.checkFields}
          texts={texts}
          checks={checks}
          onText={(id, value) => setTexts((all) => ({ ...all, [id]: value }))}
          onCheck={(id, value) => setChecks((all) => ({ ...all, [id]: value }))}
        />
      )}

      {step === STEP.CONTRACT && (
        <div className="flex max-w-[900px] flex-col gap-3">
          <p className="text-[19px]">Le DIPC validé par EODA (version {dipc.versionNumber}), rempli avec la fiche de la personne. Faites-le défiler avec elle.</p>
          {merged.emptyFields.length > 0 && (
            <p className="text-[18px] text-ink2">
              {merged.emptyFields.length} ligne{merged.emptyFields.length > 1 ? "s restent" : " reste"} à compléter à la main (« ………………… ») : revenez à la fiche ou au projet si vous avez l&apos;information.
            </p>
          )}
          <AdmissionPreview blocks={planAdmissionDocument({ ...docInput, signedAt: null })} />
        </div>
      )}

      {step === STEP.EXPLAIN && <AdmissionExplainStep explained={explained} handed={handed} onExplained={setExplained} onHanded={setHanded} />}

      {step === STEP.SIGN && (
        <div className="flex max-w-[860px] flex-col gap-6">
          <p className="text-[19px]">Chacun signe dans son cadre. Le contrat ne peut plus être modifié après la signature.</p>
          {signers.map((signer) => (
            <div key={signer} className="flex flex-col gap-2">
              <p className="text-[21px] font-bold">
                {SIGNER_LABELS[signer]} — {signerName(signer, identity, linked, staffName) || "nom à compléter"}
              </p>
              <SignaturePad label={SIGNER_LABELS[signer]} onChange={(png) => setSignatures((all) => ({ ...all, [signer]: png ?? undefined }))} />
            </div>
          ))}
        </div>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border-2 border-danger-text px-4 py-3 text-[19px] font-bold text-danger-text">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="button" className={TABLET_SECONDARY} onClick={() => (step === STEP.PERSON ? onCancel() : go(step - 1))} disabled={busy}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {step === STEP.PERSON ? "Annuler" : "Retour"}
        </button>
        <button type="button" className={cn(TABLET_PRIMARY, "flex-1")} onClick={next} disabled={busy} aria-busy={busy}>
          {busy
            ? "Fabrication du contrat…"
            : step === STEP.PERSON
              ? "Remplir le projet"
              : step === STEP.PROJECT
                ? "Voir le contrat"
                : step === STEP.CONTRACT
                  ? "Nous l'avons relu"
                  : step === STEP.EXPLAIN
                    ? "Passer aux signatures"
                    : "Signer le contrat"}
        </button>
      </div>
    </section>
  );
}
