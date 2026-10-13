import {
  decideOneTimeTokenState,
  generateOneTimeToken,
  hashOneTimeToken,
  isOneTimeTokenWellFormed,
  oneTimeTokenExpiry,
  oneTimeTokenMatches,
  type OneTimeTokenState,
} from "./one-time-token";

// ─────────────────────────────────────────────────────────────────────────────
// JETON D'INVITATION AU QUIZ (N10) — la seule porte publique nouvelle de N10.
//
// Les règles du jeton (256 bits, empreinte SHA-256 seule en base, comparaison en
// temps constant, usage unique, durée courte) vivent dans `one-time-token.ts`,
// partagé avec la confirmation d'adresse du libre-service. Ce module n'en garde que
// la durée propre au quiz et ses noms historiques.
// Pas de SMS (décision 8) : le jeton voyage par QR code ou lien montré en réunion.
// ─────────────────────────────────────────────────────────────────────────────

// Trois jours : de quoi passer le quiz après la réunion d'équipe où le QR a été
// montré, pas assez pour qu'un lien oublié traîne. Valeur choisie dans N10, à
// confirmer par Damon.
export const QUIZ_INVITATION_TTL_HOURS = 72;

export const generateQuizToken = generateOneTimeToken;
export const isQuizTokenWellFormed = isOneTimeTokenWellFormed;
export const hashQuizToken = hashOneTimeToken;
export const quizTokenHashesMatch = oneTimeTokenMatches;
export const decideInvitationState = decideOneTimeTokenState;
export type InvitationState = OneTimeTokenState;

export function quizInvitationExpiry(now: Date): Date {
  return oneTimeTokenExpiry(now, QUIZ_INVITATION_TTL_HOURS);
}
