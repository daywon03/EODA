import type { Prisma } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// LES LIGNES DE « DOCUMENTS » QU'UNE STRUCTURE VOIT — un seul filtre, partout.
//
// Une ligne disparaît de la liste d'une structure dans deux cas :
//  - elle est retirée pour TOUTES les structures (`archivedAt`, 09/11/2026) ;
//  - elle est masquée pour CETTE structure (`EstablishmentDocumentTypeExclusion`,
//    10/11/2026 — document-type-exclusion-service).
// Checklist (cabinet et portail), compteurs, avancement de la mission, options de
// dépôt : tous passent par ce filtre. Écrit une fois pour qu'un écran ne puisse pas
// oublier l'un des deux cas (D1).
// ─────────────────────────────────────────────────────────────────────────────

export function documentTypeVisibleTo(establishmentId: string): Prisma.DocumentTypeWhereInput {
  return { archivedAt: null, hiddenFor: { none: { establishmentId } } };
}
