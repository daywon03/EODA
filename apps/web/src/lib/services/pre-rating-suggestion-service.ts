import type { DocumentStatus } from "@eoda/database";

// Pont Module 1 → Module 3 — pur, ne fait aucun appel LLM (réutilise le statut déjà
// dérivé par DocumentStatusService, cf. context/07 et specs/01-mvp-v1.md §Module 3).
// Toujours une suggestion modifiable, jamais une cotation appliquée automatiquement.
export function shouldSuggestCompliance(linkedDocumentStatuses: DocumentStatus[]): boolean {
  if (linkedDocumentStatuses.length === 0) return false;
  return linkedDocumentStatuses.every((s) => s === "COMPLIANT");
}
