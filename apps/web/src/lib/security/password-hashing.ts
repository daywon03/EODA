import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// EMPREINTES ET MOTS DE PASSE TEMPORAIRES — un seul endroit
//
// Le coût bcrypt et la génération du mot de passe temporaire étaient recopiés dans
// auth.ts, actions/user.ts et actions/password.ts. Une empreinte posée par la
// réinitialisation doit être exactement aussi chère à casser que celle posée par
// l'invitation : un coût qui diverge d'un point d'appel à l'autre est une faiblesse
// invisible (D1 — un correctif appliqué N-1 fois n'existe pas).
// ─────────────────────────────────────────────────────────────────────────────

export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

// 16 caractères issus de 12 octets aléatoires cryptographiques (`randomBytes`,
// jamais `Math.random`). Affiché une seule fois côté Cabinet, jamais stocké en
// clair ni journalisé — il ne vaut que pour la première connexion, la plateforme
// exige ensuite une rotation (`mustChangePassword`).
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}
