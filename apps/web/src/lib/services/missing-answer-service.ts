import type { DocumentCategory, DocumentStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// RÉPONSE À UN DOCUMENT NON DÉPOSÉ — tranche N3 (« Je ne l'ai pas »).
//
// L'ancienne question binaire « Ce document vous concerne-t-il ? Oui / Non » rangeait
// le « Non » en NOT_APPLICABLE : le document disparaissait des documents à produire,
// alors que Sandrine voulait l'inverse — « je ne l'ai pas » veut dire « il faut le
// créer », pas « il ne me concerne pas » (26/08, Q12 du bilan du 08/10/2026).
//
// Trois réponses distinctes désormais :
//   - WILL_PROVIDE  : il existe, il n'est pas encore déposé        → MISSING ;
//   - DONT_HAVE     : il n'existe pas, il est À PRODUIRE            → MISSING + le fait
//                     « déclaré absent » (`statusOverriddenByUser`, déjà en base) ;
//   - NOT_CONCERNED : il ne s'applique pas à la structure           → NOT_APPLICABLE,
//                     INTERDIT sur les sept documents de la loi 2002-2.
//
// Aucun nouvel état stocké : « à produire » = MISSING + réponse de la structure, un
// fait qui existait déjà (le dépôt d'une version le remet à faux, cf.
// document-ingestion-service). Règles PURES.
// ─────────────────────────────────────────────────────────────────────────────

export const MISSING_ANSWERS = ["WILL_PROVIDE", "DONT_HAVE", "NOT_CONCERNED"] as const;
export type MissingAnswer = (typeof MISSING_ANSWERS)[number];

// Entrée non fiable (route HTTP publique) : rien n'est casté, une valeur inconnue
// vaut refus.
export function parseMissingAnswer(raw: unknown): MissingAnswer | null {
  return typeof raw === "string" && (MISSING_ANSWERS as readonly string[]).includes(raw)
    ? (raw as MissingAnswer)
    : null;
}

// Les documents de la loi 2002-2 sont dus par TOUT service (art. L311-4 CASF et
// suivants) : « ne nous concerne pas » n'est pas une réponse possible (07/09, 15/09).
export function canAnswerNotConcerned(category: DocumentCategory): boolean {
  return category !== "LOI_2002_2";
}

export const NOT_CONCERNED_FORBIDDEN_MESSAGE =
  "Ce document est obligatoire pour tous les services (loi 2002-2). Si vous ne l'avez pas, répondez « Je ne l'ai pas ».";

export function missingAnswerError(answer: MissingAnswer, category: DocumentCategory): string | null {
  return answer === "NOT_CONCERNED" && !canAnswerNotConcerned(category)
    ? NOT_CONCERNED_FORBIDDEN_MESSAGE
    : null;
}

export function missingAnswerWrite(answer: MissingAnswer): {
  status: DocumentStatus;
  statusOverriddenByUser: boolean;
} {
  switch (answer) {
    case "WILL_PROVIDE":
      return { status: "MISSING", statusOverriddenByUser: false };
    case "DONT_HAVE":
      return { status: "MISSING", statusOverriddenByUser: true };
    case "NOT_CONCERNED":
      return { status: "NOT_APPLICABLE", statusOverriddenByUser: true };
  }
}

export type MissingFacts = {
  category: DocumentCategory;
  // Statut lu en base (ou dérivé : MISSING sans ligne, péremption appliquée).
  status: DocumentStatus;
  statusOverriddenByUser: boolean;
  hasVersion: boolean;
};

// Lecture : le statut à afficher et le fait « à produire ».
//
// Rattrapage SANS migration de données : avant le 10/10/2026, un « Non » sur un
// document de la loi 2002-2 avait été enregistré NOT_APPLICABLE. Cette réponse n'est
// plus possible ; elle se lit donc comme ce qu'elle voulait dire — « je ne l'ai pas ».
// Les lignes en base ne sont pas réécrites : ce sont des réponses de clients.
export function normaliseMissingState(facts: MissingFacts): {
  status: DocumentStatus;
  declaredMissing: boolean;
} {
  if (facts.hasVersion) return { status: facts.status, declaredMissing: false };
  if (facts.status === "NOT_APPLICABLE" && !canAnswerNotConcerned(facts.category)) {
    return { status: "MISSING", declaredMissing: true };
  }
  return {
    status: facts.status,
    declaredMissing: facts.status === "MISSING" && facts.statusOverriddenByUser,
  };
}
