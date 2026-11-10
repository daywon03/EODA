// ─────────────────────────────────────────────────────────────────────────────
// CODES DES TYPES DE DOCUMENT À ACCÈS RESTREINT — donnée pure (ADR 20261110).
//
// Liste UNIQUE, ici parce que deux paquets la lisent : l'application
// (`apps/web/src/content/documents/acces-restreint.ts`, qui la réexporte avec la règle
// `isRestrictedDocumentType`) et le script de purge de ce paquet
// (`scripts/purge-restricted-document-content.ts`). Le paquet de base ne dépend jamais
// de l'application : la liste ne peut donc pas vivre dans `apps/web`.
//
// Une liste dans le code, et non une colonne réglable à l'écran : lever la restriction
// passe par une revue de code. `acces-restreint.test.ts` (apps/web) échoue si un code
// listé n'est pas un type du référentiel.
// ─────────────────────────────────────────────────────────────────────────────

export const RESTRICTED_DOCUMENT_TYPE_CODES: readonly string[] = ["DEPARTEMENT_TAMPON"];
