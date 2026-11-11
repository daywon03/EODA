import type { DocumentCategory } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// MASQUER UNE LIGNE DE « DOCUMENTS » POUR UNE SEULE STRUCTURE — règles PURES
// (retour de Sandrine, 10/11/2026 : doublons et lignes devenues inutiles chez un
// client ; décision de Damon : « masquer pour ce client », réversible).
//
// Deux portées, jamais confondues :
//  - pour CETTE structure : `EstablishmentDocumentTypeExclusion` — la ligne quitte sa
//    liste, ses compteurs, son avancement, les preuves attendues de ses critères et
//    son portail ; elle se rétablit ;
//  - pour TOUTES les structures : `removeDocumentType` (suppression ou archivage,
//    lignes du cabinet seulement — document-type-removal-service).
//
// La loi 2002-2 ne se masque pas (obligatoire pour toute structure) ; une ligne qui
// porte un dépôt non plus : masquer cacherait une pièce. « Non concerné » reste le
// geste pour une pièce qui ne s'applique pas.
// ─────────────────────────────────────────────────────────────────────────────

export function hideForEstablishmentError(input: { category: DocumentCategory; hasDeposit: boolean }): string | null {
  if (input.category === "LOI_2002_2") {
    return "Les documents de la loi 2002-2 sont obligatoires : ils ne se retirent pas de la liste d'une structure.";
  }
  if (input.hasDeposit) {
    return "Une pièce a été déposée sur cette ligne : elle reste visible. Supprimez d'abord le dépôt, ou marquez la ligne « Non concerné ».";
  }
  return null;
}

// Ce que la poubelle d'une ligne propose. `removableForEveryone` vient de
// canRemoveDocumentType (ligne du cabinet, non archivée) ; le serveur rejoue tout.
export function removalChoices(input: {
  category: DocumentCategory;
  hasDeposit: boolean;
  removableForEveryone: boolean;
}): { forThisStructure: boolean; forEveryone: boolean } {
  return {
    forThisStructure: hideForEstablishmentError(input) === null,
    forEveryone: input.removableForEveryone,
  };
}

// Les documents attendus d'une structure, sans les lignes qu'elle a masquées.
export function withoutHiddenTypes(typeIds: readonly string[], hidden: ReadonlySet<string>): string[] {
  return typeIds.filter((id) => !hidden.has(id));
}
