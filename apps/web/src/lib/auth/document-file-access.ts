import { isRestrictedDocumentType } from "@/content/documents/acces-restreint";
import { isVersionVisibleToClient } from "@/lib/services/deliverables-service";
import type { ClientAccessRole } from "./capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// QUI OUVRE LE FICHIER D'UNE VERSION DE DOCUMENT — règle PURE, une seule
// (ADR 20261110, documents à accès restreint).
//
// La garde (`guards.ts` : `tryEstablishmentAccess`, `resolveTabletSession`) a déjà dit si
// l'appelant voit la STRUCTURE. Cette règle ne dit que s'il ouvre le FICHIER (octets,
// pages, texte extrait) de telle version. Chaque porte qui sert un document l'applique
// — aucune ne la recopie :
//   - document ordinaire : le cabinet ouvre tout ; la structure ouvre ses dépôts et ce
//     qu'EODA a validé, jamais un brouillon (`isVersionVisibleToClient`) ;
//   - document restreint (`content/documents/acces-restreint.ts`) : la DIRECTION de la
//     structure (toutes les versions — un dépôt d'EODA y est fait pour son compte, il ne
//     sera jamais validé puisque personne chez EODA ne le regarde) et la TABLETTE de la
//     structure ; aucun compte du cabinet, administration comprise ; aucun autre rôle de
//     la structure.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentFileOpener =
  | { side: "CABINET" }
  | { side: "CLIENT"; accessRole: ClientAccessRole | null }
  | { side: "TABLET" };

export type DocumentFileFacts = {
  documentTypeCode: string | null | undefined;
  producedByCabinet: boolean;
  validatedAt: Date | null;
};

function isDirection(opener: DocumentFileOpener): boolean {
  return opener.side === "CLIENT" && opener.accessRole === "DIRECTION";
}

// Au niveau de la LIGNE (le type), avant toute version : ce que l'écran propose — un
// cadenas, ou les boutons Voir / Télécharger. La version, elle, est jugée par
// `canOpenDocumentFile`.
export function canOpenFilesOfType(opener: DocumentFileOpener, documentTypeCode: string | null | undefined): boolean {
  if (!isRestrictedDocumentType(documentTypeCode)) return true;
  return opener.side === "TABLET" || isDirection(opener);
}

export function canOpenDocumentFile(opener: DocumentFileOpener, facts: DocumentFileFacts): boolean {
  if (isRestrictedDocumentType(facts.documentTypeCode)) return canOpenFilesOfType(opener, facts.documentTypeCode);
  // Une tablette n'ouvre que ce que ses propres sélections lui annoncent (DIPEC validé,
  // fiches validées) — par leurs routes, jamais par cette porte générale.
  if (opener.side === "TABLET") return false;
  if (opener.side === "CABINET") return true;
  return isVersionVisibleToClient({ producedByCabinet: facts.producedByCabinet, validatedAt: facts.validatedAt });
}

// Déposer sur une ligne restreinte : la direction, ou le cabinet POUR elle (il ne pourra
// plus relire ce qu'il a déposé — l'écran le dit avant l'envoi). La garde d'écriture
// (`requireEstablishmentAccess(…, DOCUMENTS_WRITE)`) reste le premier contrôle.
export function canDepositDocumentFile(opener: DocumentFileOpener, documentTypeCode: string | null | undefined): boolean {
  if (!isRestrictedDocumentType(documentTypeCode)) return opener.side !== "TABLET";
  return opener.side === "CABINET" || isDirection(opener);
}

// Depuis le contexte que rend la garde d'établissement — jamais depuis une entrée.
export function documentFileOpenerOf(access: {
  isClient: boolean;
  clientAccessRole: ClientAccessRole | null;
}): DocumentFileOpener {
  return access.isClient ? { side: "CLIENT", accessRole: access.clientAccessRole } : { side: "CABINET" };
}
