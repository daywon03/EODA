import { isValidationCurrent } from "./document-workflow-service";

// ─────────────────────────────────────────────────────────────────────────────
// QUEL DIPEC LA TABLETTE PRÉSENTE — service PUR (26/10/2026).
//
// « Prendre la nouvelle version du DIPEC fournie par EODA » : la tablette ne montre à
// signer qu'un DIPEC dont la validation est À JOUR (`isValidationCurrent`, la règle
// unique de « Validé » / « Relu par EODA » / « prouvé »). Parmi ses versions, celle
// d'EODA d'abord (le livrable, même règle que `selectDeliverables`) ; à défaut, la
// pièce de la structure que la consultante a jugée conforme telle quelle.
//
// Le texte remis est le texte du document (extrait du Word d'EODA), jamais une
// proposition de l'IA : `correctedDraftMarkdown` est un brouillon, pas ce qui a été
// validé.
// ─────────────────────────────────────────────────────────────────────────────

export const DIPC_DOCUMENT_TYPE_CODE = "L2002_DIPC";
export const TABLET_DIPC_MAX_CHARS = 300_000;

export type TabletDipcVersionFacts = {
  id: string;
  versionNumber: number;
  uploadedAt: Date;
  producedByCabinet: boolean;
  extractedText: string | null;
};

export type TabletDipcSource =
  | { status: "READY"; versionId: string; versionNumber: number; validatedOn: string; text: string }
  | { status: "ABSENT" | "NOT_VALIDATED" | "NO_TEXT" };

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function selectTabletDipc(
  document: { validatedAt: Date | null; versions: readonly TabletDipcVersionFacts[] } | null
): TabletDipcSource {
  if (!document || document.versions.length === 0) return { status: "ABSENT" };
  const byNumber = [...document.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const current = byNumber[0]!;
  const validated = isValidationCurrent({
    validatedAt: document.validatedAt,
    versionUploadedAt: current.uploadedAt,
    versionByCabinet: current.producedByCabinet,
  });
  if (!validated || !document.validatedAt) return { status: "NOT_VALIDATED" };
  const chosen = byNumber.find((v) => v.producedByCabinet) ?? current;
  const text = chosen.extractedText?.trim() ?? "";
  if (!text) return { status: "NO_TEXT" };
  return {
    status: "READY",
    versionId: chosen.id,
    versionNumber: chosen.versionNumber,
    validatedOn: isoDay(document.validatedAt),
    text: text.slice(0, TABLET_DIPC_MAX_CHARS),
  };
}

export const TABLET_DIPC_UNAVAILABLE: Record<Exclude<TabletDipcSource["status"], "READY">, string> = {
  ABSENT: "Le DIPEC de la structure n'a pas encore été déposé. EODA le prépare avec vous.",
  NOT_VALIDATED: "Le DIPEC n'est pas encore validé par EODA. On ne fait signer qu'un DIPEC validé.",
  NO_TEXT: "Le DIPEC validé ne peut pas s'afficher sur la tablette (texte illisible). Prévenez EODA.",
};
