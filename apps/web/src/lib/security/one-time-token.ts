import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// JETON À USAGE UNIQUE — socle partagé par le quiz par QR code (N10) et la
// confirmation d'adresse du libre-service (tranche 11). Une seule implémentation :
// deux copies de ces règles finiraient par ne plus protéger la même chose (D1).
//
//  - 32 octets aléatoires (256 bits), encodés base64url : impossible à deviner ;
//  - seule l'EMPREINTE SHA-256 est en base : une fuite de la base ne donne aucun
//    lien utilisable ;
//  - forme vérifiée AVANT toute lecture en base ;
//  - comparaison en TEMPS CONSTANT de l'empreinte relue ;
//  - usage UNIQUE et durée COURTE, décidés par `decideOneTimeTokenState`.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateOneTimeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isOneTimeTokenWellFormed(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function hashOneTimeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Comparaison en temps constant d'une empreinte hexadécimale stockée et d'un jeton reçu.
export function oneTimeTokenMatches(expectedHash: string, candidateToken: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const candidate = Buffer.from(hashOneTimeToken(candidateToken), "hex");
  if (expected.length !== candidate.length || expected.length === 0) return false;
  return timingSafeEqual(expected, candidate);
}

export function oneTimeTokenExpiry(now: Date, ttlHours: number): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}

export type OneTimeTokenState = "VALID" | "EXPIRED" | "USED";

export function decideOneTimeTokenState(token: { expiresAt: Date; usedAt: Date | null }, now: Date): OneTimeTokenState {
  if (token.usedAt) return "USED";
  if (token.expiresAt <= now) return "EXPIRED";
  return "VALID";
}
