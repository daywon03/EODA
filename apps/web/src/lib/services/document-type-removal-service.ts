import type { DocumentCategory } from "@eoda/database";
import { CABINET_DOCUMENT_TYPE_PREFIX } from "./document-type-creation-service";

// ─────────────────────────────────────────────────────────────────────────────
// RETIRER UNE LIGNE DE « DOCUMENTS » (retours de Sandrine, 09/11/2026 : « il manque
// des poubelles »). Règles PURES.
//
//  - seule une ligne créée par le cabinet (code `EODA_…`) se retire : la loi 2002-2
//    et les lignes du référentiel sont la base de toutes les structures ;
//  - jamais utilisée (aucun document dans aucune structure, aucun gabarit) : la ligne
//    est SUPPRIMÉE ;
//  - déjà utilisée : elle est ARCHIVÉE (`DocumentType.archivedAt`) — masquée de toutes
//    les listes, versions, analyses et journal gardés. Effacer une ligne qui porte des
//    dépôts effacerait l'historique d'une structure.
// ─────────────────────────────────────────────────────────────────────────────

export type RemovableDocumentType = { code: string; category: DocumentCategory; archivedAt: Date | null };
export type DocumentTypeUsage = { documents: number; templates: number };
export type DocumentTypeRemovalPlan = { kind: "DELETE" } | { kind: "ARCHIVE" } | { kind: "REFUSED"; error: string };

function refusal(type: RemovableDocumentType): string | null {
  if (type.category === "LOI_2002_2") return "Les documents de la loi 2002-2 ne se retirent pas de la liste.";
  if (!type.code.startsWith(CABINET_DOCUMENT_TYPE_PREFIX)) {
    return "Cette ligne vient du référentiel : seules les lignes créées par le cabinet se retirent.";
  }
  if (type.archivedAt !== null) return "Cette ligne est déjà retirée de la liste.";
  return null;
}

// Pour afficher (ou non) la poubelle ; le serveur rejoue planDocumentTypeRemoval.
export function canRemoveDocumentType(type: RemovableDocumentType): boolean {
  return refusal(type) === null;
}

export function planDocumentTypeRemoval(type: RemovableDocumentType, usage: DocumentTypeUsage): DocumentTypeRemovalPlan {
  const error = refusal(type);
  if (error) return { kind: "REFUSED", error };
  return usage.documents === 0 && usage.templates === 0 ? { kind: "DELETE" } : { kind: "ARCHIVE" };
}
