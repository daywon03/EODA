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
  fullName,
  identityProblems,
  mergeDipcText,
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
import { sha256Hex } from "./use-admissions";

export type TabletDipc = { versionId: string; versionNumber: number; validatedOn: string; text: string; sha256: string };

const STEPS = ["La personne", "Le contrat", "À expliquer", "Signatures"] as const;

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

  const linked = contactOrNull(contact);
  const merged = useMemo(
    () => mergeDipcText(dipc.text, admissionFieldValues({ structureName, identity, aid, contact: linked, staffName, signedOn: new Date() })),
    [dipc.text, structureName, identity, aid, linked, staffName]
  );
  const docInput = { structureName, identity, aid, contact: linked, dipc: { ...dipc, text: merged.text }, explained, handed, explanationsVersion: ADMISSION_EXPLANATIONS_VERSION, staffName };
  const signers = requiredSigners(linked);

  function stepProblems(index: number): string[] {
    const today = new Date();
    if (index === 0) return [...identityProblems(identity, today), ...aidProblems(aid), ...contactProblems(linked)];
    if (index === 1) return merged.unknownFields.length > 0 ? [`Le DIPC contient un champ inconnu (${merged.unknownFields.join(", ")}). Prévenez EODA : on ne fait pas signer ce contrat.`] : [];
    if (index === 2) {
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
      const text = mergeDipcText(dipc.text, values).text;
      const blocks = planAdmissionDocument({ ...docInput, dipc: { ...dipc, text }, signedAt });
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
        {step === 0 && "Qui accueillons-nous ?"}
        {step === 1 && "Relisez le contrat ensemble"}
        {step === 2 && "À expliquer à la personne"}
        {step === 3 && "Signatures"}
      </h1>

      {step === 0 && <AdmissionIdentityStep identity={identity} aid={aid} contact={contact} onIdentity={setIdentity} onAid={setAid} onContact={setContact} />}

      {step === 1 && (
        <div className="flex max-w-[900px] flex-col gap-3">
          <p className="text-[19px]">Le DIPC validé par EODA (version {dipc.versionNumber}), rempli avec la fiche de la personne. Faites-le défiler avec elle.</p>
          {merged.emptyFields.length > 0 && <p className="text-[18px] text-ink2">Des lignes restent à compléter à la main : ajoutez les informations dans la fiche si vous les avez.</p>}
          <AdmissionPreview blocks={planAdmissionDocument({ ...docInput, signedAt: null })} />
        </div>
      )}

      {step === 2 && <AdmissionExplainStep explained={explained} handed={handed} onExplained={setExplained} onHanded={setHanded} />}

      {step === 3 && (
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
        <button type="button" className={TABLET_SECONDARY} onClick={() => (step === 0 ? onCancel() : go(step - 1))} disabled={busy}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {step === 0 ? "Annuler" : "Retour"}
        </button>
        <button type="button" className={cn(TABLET_PRIMARY, "flex-1")} onClick={next} disabled={busy} aria-busy={busy}>
          {busy ? "Fabrication du contrat…" : step === 0 ? "Voir le contrat" : step === 1 ? "Nous l'avons relu" : step === 2 ? "Passer aux signatures" : "Signer le contrat"}
        </button>
      </div>
    </section>
  );
}
