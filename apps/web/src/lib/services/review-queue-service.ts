import type { DocumentAnalysisResult } from "@/lib/llm";

// ─────────────────────────────────────────────────────────────────────────────
// FILE « À RELIRE » — règles pures.
//
// Une analyse automatique n'atteint jamais le client sans revue humaine
// (analysisVisibleTo, CLAUDE.md §7). La file est donc la liste des analyses que le
// cabinet n'a pas encore relues — un ÉTAT DÉRIVÉ de deux faits stockés
// (`analysisResultJson` posé, `analysisReviewedAt` vide), jamais un statut de plus.
//
// Seule la version COURANTE d'un document compte : une version remplacée n'est
// plus ce que le client verra, et la laisser dans la file ferait monter un
// compteur que rien ne ferait jamais redescendre.
//
// « Relu » n'est pas « validé » : le geste de cette file pose `analysisReviewedAt`
// (l'analyse devient visible du client), jamais `Document.validatedAt`, qui reste
// un geste distinct, sur la fiche.
// ─────────────────────────────────────────────────────────────────────────────

export const REVIEW_QUEUE_BASE_PATH = "/dashboard/cabinet/a-relire";

export type ReviewQueueRow = {
  versionId: string;
  versionNumber: number;
  uploadedAt: Date;
  originalFilename: string;
  documentTypeLabel: string | null;
  establishmentId: string;
  establishmentName: string;
  // Propositions à vérifier sur cette version (cf. countProposals).
  proposalCount: number;
};

export type ReviewQueueItem = {
  versionId: string;
  establishmentId: string;
  documentLabel: string;
  establishmentName: string;
  versionLabel: string;
  uploadedAt: Date;
  proposalCount: number;
  // L'élément ouvert DANS la file (partageable, le serveur garde la main).
  href: string;
  // La fiche de la structure, où vivent la validation et l'historique.
  establishmentHref: string;
};

export function reviewItemHref(versionId: string): string {
  return `${REVIEW_QUEUE_BASE_PATH}?v=${encodeURIComponent(versionId)}`;
}

export function establishmentHref(establishmentId: string): string {
  return `/dashboard/cabinet/etablissements/${encodeURIComponent(establishmentId)}`;
}

export function toReviewQueueItem(row: ReviewQueueRow): ReviewQueueItem {
  return {
    versionId: row.versionId,
    establishmentId: row.establishmentId,
    // Un dépôt hors liste attendue n'a pas de type : son nom de fichier est alors
    // la seule chose qui le désigne pour le cabinet.
    documentLabel: row.documentTypeLabel ?? row.originalFilename,
    establishmentName: row.establishmentName,
    versionLabel: `Version ${row.versionNumber}`,
    uploadedAt: row.uploadedAt,
    proposalCount: row.proposalCount,
    href: reviewItemHref(row.versionId),
    establishmentHref: establishmentHref(row.establishmentId),
  };
}

// Du plus ancien au plus récent (maquette : « Du plus ancien au plus récent,
// toutes structures ») — ce qui attend depuis le plus longtemps passe d'abord.
export function sortReviewQueue(items: readonly ReviewQueueItem[]): ReviewQueueItem[] {
  return [...items].sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
}

// Après « Marquer relu », on passe au suivant : celui qui suivait dans la file, ou
// le premier s'il n'y en a pas après. File vide → la page de la file (« Tout est relu »).
export function nextQueueHref(items: readonly ReviewQueueItem[], currentVersionId: string): string {
  const index = items.findIndex((item) => item.versionId === currentVersionId);
  const rest = items.filter((item) => item.versionId !== currentVersionId);
  if (rest.length === 0) return REVIEW_QUEUE_BASE_PATH;
  const after = index >= 0 ? items.slice(index + 1)[0] : undefined;
  return (after ?? rest[0]!).href;
}

export function pluralizeProposals(count: number): string {
  if (count === 0) return "aucune proposition";
  return `${count} proposition${count > 1 ? "s" : ""}`;
}

// ── Propositions à vérifier ──────────────────────────────────────────────────
//
// Deux natures, et elles n'appellent pas le même geste :
//   - un CRITÈRE repéré (DocumentCriterionSuggestion) est une décision : Accepter
//     (confirmé) ou Corriger (écarté). Il ne sort jamais vers le client.
//   - un CONSTAT de l'analyse (élément manquant, suggestion de correction) est
//     restitué tel quel au client une fois l'analyse relue. Il n'a pas d'état
//     propre en base : le corriger, c'est corriger le DOCUMENT, depuis la fiche.

export type CriterionSuggestionStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export type CriterionProposal = {
  kind: "CRITERION";
  id: string;
  status: CriterionSuggestionStatus;
  criterionCode: string;
  criterionLabel: string;
  isImperative: boolean;
  justification: string;
};

export type FindingProposal = {
  kind: "MISSING" | "CORRECTION";
  key: string;
  text: string;
};

export type ReviewProposals = {
  criteria: CriterionProposal[];
  findings: FindingProposal[];
};

export const PROPOSAL_KIND_LABELS: Record<CriterionProposal["kind"] | FindingProposal["kind"], string> = {
  CRITERION: "Critère repéré",
  MISSING: "Élément manquant",
  CORRECTION: "Correction proposée",
};

export function buildReviewProposals(input: {
  analysis: DocumentAnalysisResult | null;
  criteria: readonly CriterionProposal[];
}): ReviewProposals {
  const missing = input.analysis?.elementsManquants ?? [];
  const corrections = input.analysis?.suggestionsCorrection ?? [];
  return {
    // Impératifs d'abord : ce sont ceux dont l'absence fait échouer l'évaluation.
    criteria: [...input.criteria].sort(
      (a, b) => Number(b.isImperative) - Number(a.isImperative) || a.criterionCode.localeCompare(b.criterionCode)
    ),
    findings: [
      ...missing.map((text, i): FindingProposal => ({ kind: "MISSING", key: `m${i}`, text })),
      ...corrections.map((text, i): FindingProposal => ({ kind: "CORRECTION", key: `c${i}`, text })),
    ],
  };
}

// Ce qu'il reste à trancher : seuls les critères en attente appellent un geste.
export function countPendingCriteria(proposals: ReviewProposals): number {
  return proposals.criteria.filter((c) => c.status === "PENDING").length;
}

// Nombre affiché dans la file : critères en attente + constats à relire.
export function countProposals(analysis: DocumentAnalysisResult | null, pendingCriteria: number): number {
  if (!analysis) return pendingCriteria;
  return pendingCriteria + analysis.elementsManquants.length + analysis.suggestionsCorrection.length;
}

export function describePending(pendingCriteria: number): string {
  if (pendingCriteria === 0) return "Tous les critères repérés sont tranchés.";
  return `${pendingCriteria} critère${pendingCriteria > 1 ? "s" : ""} repéré${pendingCriteria > 1 ? "s" : ""} à vérifier`;
}
