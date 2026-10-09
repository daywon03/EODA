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
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewQueueRow = {
  versionId: string;
  versionNumber: number;
  uploadedAt: Date;
  originalFilename: string;
  documentTypeLabel: string | null;
  establishmentId: string;
  establishmentName: string;
};

export type ReviewQueueItem = {
  versionId: string;
  documentLabel: string;
  establishmentName: string;
  versionLabel: string;
  uploadedAt: Date;
  href: string;
};

export function reviewItemHref(establishmentId: string): string {
  return `/dashboard/cabinet/etablissements/${encodeURIComponent(establishmentId)}`;
}

export function toReviewQueueItem(row: ReviewQueueRow): ReviewQueueItem {
  return {
    versionId: row.versionId,
    // Un dépôt hors liste attendue n'a pas de type : son nom de fichier est alors
    // la seule chose qui le désigne pour le cabinet.
    documentLabel: row.documentTypeLabel ?? row.originalFilename,
    establishmentName: row.establishmentName,
    versionLabel: `Version ${row.versionNumber}`,
    uploadedAt: row.uploadedAt,
    href: reviewItemHref(row.establishmentId),
  };
}

// Du plus ancien au plus récent (maquette : « Du plus ancien au plus récent,
// toutes structures ») — ce qui attend depuis le plus longtemps passe d'abord.
export function sortReviewQueue(items: readonly ReviewQueueItem[]): ReviewQueueItem[] {
  return [...items].sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
}
