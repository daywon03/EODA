import type { SupportMode } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// MENTIONS DE RELECTURE — service UNIQUE (tranche N1, D8).
//
// Deux phrases, et seulement deux, disent au client qui a relu ce qu'il lit :
//   - relu par EODA      → « Relu par EODA, le JJ/MM » ;
//   - en autonomie, non relu → la réserve complète (CLAUDE.md §7, décision du
//     08/10/2026) : non revérifié par un humain, peut comporter des erreurs, à relire.
//
// Écrites ici et nulle part ailleurs : à l'écran, dans l'export Word, dans un e-mail
// qui annonce un document. Une réserve recopiée à la main finit tronquée quelque part
// — et c'est précisément sur la réserve que la parole d'EODA se joue.
// Jamais « Sandrine » (D7), jamais « validé » ni « conforme » sans relecture.
// ─────────────────────────────────────────────────────────────────────────────

export const AUTONOMY_RESERVE =
  "Non revérifié par un humain : peut comporter des erreurs. À relire absolument.";

// Version courte, pour le bandeau de mode : le lien qui l'accompagne mène à la
// version complète, qui reste celle de chaque document.
export const AUTONOMY_RESERVE_SHORT = "Non revérifié par un humain : à relire absolument.";

// JJ/MM en composantes LOCALES, comme toDateInputValue.
export function describeReviewMention(reviewedAt: Date): string {
  const day = String(reviewedAt.getDate()).padStart(2, "0");
  const month = String(reviewedAt.getMonth() + 1).padStart(2, "0");
  return `Relu par EODA, le ${day}/${month}`;
}

export type MentionFacts = {
  mode: SupportMode;
  // Date de la relecture humaine par EODA ; null tant que personne ne l'a faite.
  reviewedAt: Date | null;
};

// La mention qui accompagne une production (analyse, document corrigé) montrée à
// la structure. `null` = rien à montrer à la structure : en accompagnement, une
// production non relue ne lui parvient pas (analysisVisibleTo), il n'y a donc rien
// à annoter.
export function documentMention(facts: MentionFacts): string | null {
  if (facts.reviewedAt) return describeReviewMention(facts.reviewedAt);
  return facts.mode === "AUTONOMIE" ? AUTONOMY_RESERVE : null;
}

// Pour un e-mail qui annonce un document : la même mention, sous forme d'une phrase
// complète. Aucun e-mail n'annonce encore de document produit (10/10/2026) ; celui qui
// le fera passera par ici.
export function documentAnnouncementMention(facts: MentionFacts): string | null {
  const mention = documentMention(facts);
  return mention ? `${mention}.`.replace(/\.\.$/, ".") : null;
}
