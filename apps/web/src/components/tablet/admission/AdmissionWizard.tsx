"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMISSION_EXPLANATIONS_VERSION, type HandedDocumentId } from "@/content/admission/explications";
import { planAdmissionDocument, planRefusalDocument } from "@/lib/services/admission-document-service";
import {
  admissionFieldValues,
  admissionPdfFileName,
  aidProblems,
  contactProblems,
  EMPTY_AID,
  EMPTY_CONTACT,
  EMPTY_IDENTITY,
  defaultDuration,
  defaultReproposeOn,
  refusalProblems,
  dipcEntryValues,
  durationProblems,
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
  type AdmissionOutcome,
  type AdmissionRefusal,
  type AdmissionRecord,
  type DipcDuration,
  type AdmissionSigner,
} from "@/lib/services/admission-service";
import { TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { SignaturePad } from "../SignaturePad";
import { AdmissionExplainStep } from "./AdmissionExplainStep";
import { AdmissionIdentityStep } from "./AdmissionIdentityStep";
import { AdmissionPreview } from "./AdmissionPreview";
import { AdmissionProjectStep } from "./AdmissionProjectStep";
import { AdmissionRefusalPanel } from "./AdmissionRefusalPanel";
import { sha256Hex } from "./use-admissions";
import { prepareDipcForTablet } from "@/lib/services/dipc-tablet-preparation";

export type TabletDipc = { versionId: string; versionNumber: number; validatedOn: string; text: string; sha256: string };

const STEPS = ["La personne", "Le projet", "Le contrat", "À expliquer", "Signatures"] as const;
const STEP = { PERSON: 0, PROJECT: 1, CONTRACT: 2, EXPLAIN: 3, SIGN: 4 } as const;
const STEP_TITLES = ["Qui accueillons-nous ?", "Ce que prévoit le contrat", "Relisez le contrat ensemble", "À expliquer à la personne", "Signatures"];

function contactOrNull(contact: AdmissionContact): AdmissionContact | null {
  return contact.kind ? contact : null;
}

export function AdmissionWizard({ structureName, staffName, dipc, person, onRecorded, onCancel }: {
  structureName: string;
  staffName: string;
  dipc: TabletDipc;
  person: { personId: string; lastName: string; firstName: string } | null;
  onRecorded: (record: AdmissionRecord, pdf: Blob) => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [refusing, setRefusing] = useState(false);
  const [refusal, setRefusal] = useState<AdmissionRefusal>(() => ({ reason: "", reproposeOn: defaultReproposeOn(new Date()) }));
  const [refusalError, setRefusalError] = useState<string | null>(null);
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

  // La copie du DIPEC pour la tablette : dérivée du texte validé, jamais rangée.
  const prepared = useMemo(() => prepareDipcForTablet(dipc.text), [dipc.text]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [duration, setDuration] = useState<DipcDuration>(() => defaultDuration(prepared.durationChoice));

  const linked = contactOrNull(contact);
  const entries = useMemo(() => dipcEntryValues(prepared, texts, checks, duration), [prepared, texts, checks, duration]);
  const merged = useMemo(
    () => mergeDipcBlocks(prepared.blocks, admissionFieldValues({ structureName, identity, aid, contact: linked, staffName, signedOn: new Date() }), entries),
    [prepared, structureName, identity, aid, linked, staffName, entries]
  );
  const docInput = { structureName, identity, aid, contact: linked, dipc: { ...dipc, blocks: merged.blocks }, explained, handed, explanationsVersion: ADMISSION_EXPLANATIONS_VERSION, staffName };
  const signers = requiredSigners(linked);

  function stepProblems(index: number): string[] {
    const today = new Date();
    if (index === STEP.PERSON) return [...identityProblems(identity, today), ...aidProblems(aid), ...contactProblems(linked)];
    if (index === STEP.PROJECT) return durationProblems(prepared.durationChoice, duration);
    if (index === STEP.CONTRACT) return merged.unknownFields.length > 0 ? [`Le DIPEC contient un champ inconnu (${merged.unknownFields.join(", ")}). Prévenez EODA : on ne fait pas signer ce contrat.`] : [];
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
      const pdf = new Blob([(await renderAdmissionPdf({ blocks, signatures: images, footer: `DIPEC — ${structureName} — ${name}`, title: `DIPEC — ${name}`, signedAt })) as BlobPart], { type: "application/pdf" });
      await onRecorded(await recordOf(signedAt, "SIGNE", null, signers, pdf), pdf);
    } catch {
      setSignError("Le contrat n'a pas pu être fabriqué. Vérifiez les signatures, puis recommencez la signature.");
    } finally {
      setBusy(false);
    }
  }

  // Ce que la tablette garde, contrat signé ou refus : la même fiche, la même trace.
  async function recordOf(at: Date, outcome: AdmissionOutcome, refusalData: AdmissionRefusal | null, recordSigners: AdmissionSigner[], pdf: Blob): Promise<AdmissionRecord> {
    return {
      version: 1,
      id: window.crypto.randomUUID(),
      personId: person?.personId ?? window.crypto.randomUUID(),
      identity,
      aid,
      contact: linked,
      explanationsVersion: ADMISSION_EXPLANATIONS_VERSION,
      explained,
      handed,
      signers: recordSigners,
      signedAt: at.toISOString(),
      staffName,
      dipc: { versionId: dipc.versionId, versionNumber: dipc.versionNumber, validatedOn: dipc.validatedOn, sha256: dipc.sha256 },
      pdfFileName: admissionPdfFileName(structureName, identity, at, outcome),
      // L'empreinte porte sur les octets mêmes qui sont rangés et envoyés.
      pdfSha256: await sha256Hex(await pdf.arrayBuffer()),
      outcome,
      refusal: refusalData,
    };
  }

  // La personne ne souhaite pas signer (HAS 1.7.3 / 1.7.4) : son refus est respecté
  // et TRACÉ, avec la date à laquelle le contrat lui sera reproposé.
  async function recordRefusal() {
    const found = refusalProblems(refusal, new Date());
    if (found.length > 0) return setRefusalError(found.join(" "));
    setBusy(true);
    setRefusalError(null);
    try {
      const recordedAt = new Date();
      const blocks = planRefusalDocument({ ...docInput, dipc, recordedAt, reason: refusal.reason, reproposeOn: refusal.reproposeOn });
      const { renderAdmissionPdf } = await import("@/lib/services/admission-pdf");
      const name = fullName(identity);
      const bytes = await renderAdmissionPdf({ blocks, signatures: {}, footer: `Refus du DIPEC — ${structureName} — ${name}`, title: `Refus du DIPEC — ${name}`, signedAt: recordedAt });
      const pdf = new Blob([bytes as BlobPart], { type: "application/pdf" });
      await onRecorded(await recordOf(recordedAt, "REFUS", { reason: refusal.reason.trim(), reproposeOn: refusal.reproposeOn }, [], pdf), pdf);
    } catch {
      setRefusalError("L'attestation n'a pas pu être fabriquée. Recommencez.");
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
        {refusing ? "La personne ne souhaite pas signer" : STEP_TITLES[step]}
      </h1>

      {refusing ? (
        <AdmissionRefusalPanel
          personName={fullName(identity)}
          refusal={refusal}
          onRefusal={setRefusal}
          error={refusalError}
          busy={busy}
          onConfirm={() => void recordRefusal()}
          onBack={() => {
            setRefusing(false);
            setRefusalError(null);
          }}
        />
      ) : (
      <>
      {step === STEP.PERSON && <AdmissionIdentityStep identity={identity} aid={aid} contact={contact} onIdentity={setIdentity} onAid={setAid} onContact={setContact} />}

      {step === STEP.PROJECT && (
        <AdmissionProjectStep
          freeFields={prepared.freeFields}
          checkFields={prepared.checkFields}
          durationChoice={prepared.durationChoice}
          duration={duration}
          onDuration={setDuration}
          texts={texts}
          checks={checks}
          onText={(id, value) => setTexts((all) => ({ ...all, [id]: value }))}
          onCheck={(id, value) => setChecks((all) => ({ ...all, [id]: value }))}
        />
      )}

      {step === STEP.CONTRACT && (
        <div className="flex max-w-[900px] flex-col gap-3">
          <p className="text-[19px]">Le DIPEC validé par EODA (version {dipc.versionNumber}), rempli avec la fiche de la personne. Faites-le défiler avec elle.</p>
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
      {/* Le refus se propose une fois le contrat présenté : avant, il n'y a rien à refuser. */}
      {step >= STEP.CONTRACT && (
        <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => setRefusing(true)} disabled={busy}>
          La personne ne souhaite pas signer
        </button>
      )}
      </>
      )}
    </section>
  );
}
