import { createHash } from "node:crypto";
import { RECEPTION_DOCUMENTS, type ReceptionDocument } from "@/content/enquete/reception";
import type { ChecklistTick, RepresentativeKind, SignerRole } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// DOSSIER DE PREUVE DE SIGNATURE — service PUR (lot C, 09 §8).
//
// Une signature dessinée seule n'est qu'une image. Ce qui la rend recevable est le
// dossier qui l'entoure : empreinte SHA-256 du document rendu, horodatage, identité
// du signataire et de l'intervenant témoin, appareil enregistré, et les points « à
// dire » cochés un à un avec leur heure. Ce service décide si ce dossier est
// COMPLET et COHÉRENT ; il ne stocke rien.
//
// Biométrie : on n'accepte qu'une image PNG finale. Aucun tracé, aucune dynamique
// (vitesse, pression, ordre des points) n'entre ici — l'entrée n'a pas de champ pour.
// ─────────────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_SIGNATURE_IMAGE_BYTES = 300_000;
// Une image plus petite qu'un PNG vide de 1 × 1 n'est pas une signature.
const MIN_SIGNATURE_IMAGE_BYTES = 67;

export function sha256Hex(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function isPngImage(content: Buffer): boolean {
  return content.length >= PNG_SIGNATURE.length && content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

export type SignatureEvidenceInput = {
  beneficiaryFullName: string;
  representative: { kind: RepresentativeKind; fullName: string } | null;
  signerRole: SignerRole;
  signerName: string;
  witnessStaffMemberId: string | null;
  deviceEnrollmentId: string | null;
  renderedDocument: Buffer;
  signatureImage: Buffer;
  presentedDocuments: readonly ReceptionDocument["kind"][];
  ticks: readonly ChecklistTick[];
  signedAt: Date;
};

export type SignatureEvidenceDecision =
  | { ok: true; documentSha256: string; signatureImageSha256: string; checklist: ChecklistTick[] }
  | { ok: false; problems: string[] };

function normalizeName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
}

export function missingChecklistPoints(
  presented: readonly ReceptionDocument["kind"][],
  ticks: readonly ChecklistTick[]
): string[] {
  const ticked = new Set(ticks.map((tick) => `${tick.documentKind}:${tick.pointId}`));
  return RECEPTION_DOCUMENTS.filter((doc) => presented.includes(doc.kind)).flatMap((doc) =>
    doc.points.filter((point) => !ticked.has(`${doc.kind}:${point.id}`)).map((point) => `${doc.label} — ${point.label}`)
  );
}

// Un tuteur ou un curateur signe pour la personne : la personne ne signe pas seule.
// Un proche peut signer s'il est désigné ; la personne peut toujours signer elle-même
// sans représentant.
export function signerProblems(input: Pick<SignatureEvidenceInput, "beneficiaryFullName" | "representative" | "signerRole" | "signerName">): string[] {
  const { representative, signerRole } = input;
  if (!input.signerName.trim()) return ["Le nom du signataire manque."];
  if (signerRole === "SERVICE") return ["La feuille de réception est signée par la personne ou son représentant, pas par le service."];
  if (signerRole === "PERSONNE") {
    if (representative && representative.kind !== "PROCHE") {
      return ["Une personne sous tutelle ou curatelle ne signe pas seule : c'est son représentant légal qui signe."];
    }
    return normalizeName(input.signerName) === normalizeName(input.beneficiaryFullName)
      ? []
      : ["Le nom du signataire ne correspond pas à la personne accompagnée."];
  }
  if (!representative) return ["Aucun représentant n'est enregistré pour cette personne."];
  return normalizeName(input.signerName) === normalizeName(representative.fullName)
    ? []
    : ["Le nom du signataire ne correspond pas au représentant enregistré."];
}

function tickProblems(ticks: readonly ChecklistTick[], signedAt: Date): string[] {
  return ticks.some((tick) => tick.tickedAt.getTime() > signedAt.getTime())
    ? ["Un point a été coché après la signature."]
    : [];
}

function imageProblems(image: Buffer): string[] {
  if (!isPngImage(image)) return ["La signature doit être une image PNG."];
  if (image.length < MIN_SIGNATURE_IMAGE_BYTES) return ["La signature est vide."];
  if (image.length > MAX_SIGNATURE_IMAGE_BYTES) return ["L'image de la signature est trop lourde."];
  return [];
}

export function buildSignatureEvidence(input: SignatureEvidenceInput): SignatureEvidenceDecision {
  const missing = missingChecklistPoints(input.presentedDocuments, input.ticks);
  const problems = [
    ...(input.presentedDocuments.length === 0 ? ["Aucun document n'a été présenté."] : []),
    ...(missing.length > 0 ? [`Points non cochés : ${missing.join(" ; ")}.`] : []),
    ...signerProblems(input),
    ...tickProblems(input.ticks, input.signedAt),
    ...imageProblems(input.signatureImage),
    ...(input.witnessStaffMemberId ? [] : ["L'intervenant témoin n'est pas identifié."]),
    ...(input.deviceEnrollmentId ? [] : ["La signature doit être faite sur un appareil enregistré."]),
    ...(input.renderedDocument.length === 0 ? ["Le document signé est vide."] : []),
  ];
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    documentSha256: sha256Hex(input.renderedDocument),
    signatureImageSha256: sha256Hex(input.signatureImage),
    checklist: [...input.ticks].sort((a, b) => a.tickedAt.getTime() - b.tickedAt.getTime()),
  };
}
