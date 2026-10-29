import type { RateLimitPolicy } from "@/lib/security/rate-limiter-port";
import { PASSWORD_SETUP_PREFIX } from "@/lib/auth/routes";

// ─────────────────────────────────────────────────────────────────────────────
// LIEN DE CRÉATION DU MOT DE PASSE — règles pures (audit de sécurité du 28/10/2026).
//
// Le mot de passe temporaire voyageait EN CLAIR dans l'e-mail d'invitation (compromis
// du 26/08) : quiconque lisait la boîte — ou l'archive d'une messagerie — avait de quoi
// se connecter. Il est remplacé par un lien à usage unique : la personne choisit ELLE-
// MÊME son mot de passe, que personne d'autre ne voit jamais, cabinet compris. Le lien
// expire, ne sert qu'une fois, et un nouveau lien ferme le précédent.
// ─────────────────────────────────────────────────────────────────────────────

// Trois jours : le temps d'ouvrir une invitation reçue un vendredi.
export const PASSWORD_SETUP_TTL_HOURS = 72;

// Ouverture et validation du lien, par adresse IP : un jeton de 256 bits ne se devine
// pas, mais une rafale de requêtes se refuse quand même.
export const PASSWORD_SETUP_IP_RATE_LIMIT: RateLimitPolicy = { limit: 20, windowSeconds: 15 * 60 };

export function passwordSetupPathFor(token: string): string {
  return `${PASSWORD_SETUP_PREFIX}/${token}`;
}

export type PasswordSetupLinkState = "VALID" | "INVALID" | "EXPIRED" | "USED";

export const PASSWORD_SETUP_LINK_MESSAGES: Record<Exclude<PasswordSetupLinkState, "VALID">, string> = {
  INVALID: "Ce lien n'est pas valide. Demandez-en un nouveau à la personne qui vous a invité(e).",
  EXPIRED: "Ce lien a expiré (il est valable 3 jours). Demandez-en un nouveau à la personne qui vous a invité(e).",
  USED: "Ce lien a déjà servi. Connectez-vous avec le mot de passe que vous avez choisi.",
};

// Ce que l'écran du cabinet montre après une invitation ou une réinitialisation : le
// lien seulement s'il n'est PAS parti par e-mail — sinon personne d'autre que la
// personne n'a à le voir.
export function setupLinkToShow(delivery: "SENT" | "NOT_CONFIGURED" | "FAILED", setupUrl: string): string | null {
  return delivery === "SENT" ? null : setupUrl;
}
