// ─────────────────────────────────────────────────────────────────────────────
// TYPES DE DOCUMENT À ACCÈS RESTREINT — configuration versionnée (ADR 20261110).
//
// Le tampon de la structure sert à « signer » le formulaire du Département : Sandrine
// (call du 09/11/2026) — « c'est comme si quelqu'un avait accès à la signature EODA pour
// signer des chèques ». Son FICHIER ne s'ouvre que pour la direction de la structure et
// pour sa tablette enregistrée ; le cabinet voit la ligne et son état, jamais le contenu,
// et aucune IA ne le lit. La règle est `canOpenDocumentFile`
// (`lib/auth/document-file-access.ts`).
//
// Une liste dans le code, et non une colonne réglable à l'écran : lever la restriction
// passe par une revue de code, pas par un clic d'un compte qui voudrait lire le tampon.
// `acces-restreint.test.ts` échoue si un code listé n'est pas un type du référentiel.
// ─────────────────────────────────────────────────────────────────────────────

export const RESTRICTED_DOCUMENT_TYPE_CODES: readonly string[] = ["DEPARTEMENT_TAMPON"];

export function isRestrictedDocumentType(code: string | null | undefined): boolean {
  return typeof code === "string" && RESTRICTED_DOCUMENT_TYPE_CODES.includes(code);
}

// Le libellé unique, cabinet comme structure : il dit QUI ouvre, pas pourquoi les autres
// n'ouvrent pas.
export const RESTRICTED_DOCUMENT_NOTICE = "Accès réservé à la direction de la structure";
