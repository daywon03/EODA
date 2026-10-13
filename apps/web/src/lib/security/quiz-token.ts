import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// JETON D'INVITATION AU QUIZ (N10) — la seule porte publique nouvelle.
//
//  - 32 octets aléatoires (256 bits), encodés base64url : impossible à deviner ;
//  - seule l'EMPREINTE SHA-256 est en base (QuizInvitation.tokenHash) : une fuite
//    de la base ne donne aucun lien utilisable ;
//  - comparaison en TEMPS CONSTANT de l'empreinte relue ;
//  - usage UNIQUE et durée COURTE (QUIZ_INVITATION_TTL_HOURS).
// Pas de SMS (décision 8) : le jeton voyage par QR code ou lien montré en réunion.
// ─────────────────────────────────────────────────────────────────────────────

// Trois jours : de quoi passer le quiz après la réunion d'équipe où le QR a été
// montré, pas assez pour qu'un lien oublié traîne. Valeur choisie dans N10, à
// confirmer par Damon.
export const QUIZ_INVITATION_TTL_HOURS = 72;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateQuizToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isQuizTokenWellFormed(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function hashQuizToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Comparaison en temps constant de deux empreintes hexadécimales.
export function quizTokenHashesMatch(expectedHash: string, candidateToken: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const candidate = Buffer.from(hashQuizToken(candidateToken), "hex");
  if (expected.length !== candidate.length || expected.length === 0) return false;
  return timingSafeEqual(expected, candidate);
}

export function quizInvitationExpiry(now: Date): Date {
  return new Date(now.getTime() + QUIZ_INVITATION_TTL_HOURS * 60 * 60 * 1000);
}

export type InvitationState = "VALID" | "EXPIRED" | "USED";

export function decideInvitationState(invitation: { expiresAt: Date; usedAt: Date | null }, now: Date): InvitationState {
  if (invitation.usedAt) return "USED";
  if (invitation.expiresAt <= now) return "EXPIRED";
  return "VALID";
}
