import type { RateLimitPolicy } from "@/lib/security/rate-limiter-port";
import { isEmailShaped } from "@/lib/validation/form-parsers";
import { EMAIL_CONFIRMATION_PREFIX } from "@/lib/auth/routes";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATION DE L'ADRESSE D'UN COMPTE LIBRE-SERVICE — règles pures (tranche 11,
// décision de Damon du 13/10/2026).
//
// Une inscription en ligne crée le compte, mais il n'ouvre RIEN tant que l'adresse
// n'est pas confirmée par le lien reçu. Seuls les comptes créés en libre-service sont
// concernés (ceux qui ont un ProspectAccount) : un compte créé par le cabinet vient
// d'une relation commerciale, son adresse n'a rien à prouver.
//
// Entrées hostiles (S8) : la confirmation et le renvoi sont PUBLICS. Débit limité,
// réponse du renvoi identique que l'adresse existe ou non (S9), jeton à usage unique
// (one-time-token.ts).
// ─────────────────────────────────────────────────────────────────────────────

// Vingt-quatre heures : le temps d'ouvrir sa messagerie le lendemain d'une inscription
// faite le soir, pas assez pour qu'un lien oublié traîne. Valeur choisie en tranche 11,
// à confirmer par Damon.
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

// Le chemin vit dans lib/auth/routes.ts, qui le classe ANONYMOUS : un seul endroit.
export function confirmationPathFor(token: string): string {
  return `${EMAIL_CONFIRMATION_PREFIX}/${token}`;
}

export type VerificationFacts = { isSelfRegistered: boolean; emailVerifiedAt: Date | null };

// Vrai = le compte ne doit PAS pouvoir se connecter.
export function isEmailVerificationPending(facts: VerificationFacts): boolean {
  return facts.isSelfRegistered && facts.emailVerifiedAt === null;
}

// Un nouveau lien n'est émis que pour un compte libre-service, actif, pas encore
// confirmé. Tout autre cas (adresse inconnue, compte cabinet, déjà confirmé) ne fait
// RIEN — et l'écran dit la même chose dans tous les cas.
export function shouldIssueVerificationLink(
  account: (VerificationFacts & { isActive: boolean }) | null
): boolean {
  return account !== null && account.isActive && isEmailVerificationPending(account);
}

// Ce que l'écran peut dire de l'envoi. Sans service d'e-mail (poste local), l'écran le
// dit honnêtement ; et en DÉVELOPPEMENT SEULEMENT il montre le lien, pour qu'on puisse
// tester le parcours. Jamais en production : le lien y prouverait la possession d'une
// adresse sans l'avoir reçue.
export type LinkDisclosure = { emailNotSentLocally: boolean; devConfirmationPath: string | null };

export function confirmationLinkDisclosure(input: {
  isDevelopment: boolean;
  isEmailConfigured: boolean;
  confirmationPath: string | null;
}): LinkDisclosure {
  const emailNotSentLocally = !input.isEmailConfigured;
  const devConfirmationPath =
    input.isDevelopment && emailNotSentLocally && input.confirmationPath ? input.confirmationPath : null;
  return { emailNotSentLocally, devConfirmationPath };
}

export const UNVERIFIED_LOGIN_MESSAGE =
  "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail, ou demandez un nouveau lien ci-dessous.";

export const RESEND_NEUTRAL_MESSAGE =
  "C'est noté. Si un espace attend une confirmation avec cette adresse, un nouveau lien vient de partir. Il est valable 24 heures.";

export const RESEND_RATE_LIMITED_MESSAGE = "Trop de demandes. Réessayez dans une heure.";

export type ConfirmationOutcome = "CONFIRMED" | "INVALID" | "EXPIRED" | "USED" | "RATE_LIMITED";

export const CONFIRMATION_MESSAGES: Record<ConfirmationOutcome, string> = {
  CONFIRMED: "Votre adresse est confirmée. Vous pouvez vous connecter.",
  INVALID: "Ce lien n'est pas valable. Demandez un nouveau lien ci-dessous.",
  EXPIRED: "Ce lien a expiré. Demandez un nouveau lien ci-dessous.",
  USED: "Ce lien a déjà servi. Si votre adresse est confirmée, connectez-vous ; sinon, demandez un nouveau lien.",
  RATE_LIMITED: "Trop de tentatives. Réessayez dans un quart d'heure.",
};

export const CONFIRM_IP_RATE_LIMIT: RateLimitPolicy = { limit: 30, windowSeconds: 15 * 60 };
export const RESEND_IP_RATE_LIMIT: RateLimitPolicy = { limit: 5, windowSeconds: 60 * 60 };
export const RESEND_EMAIL_RATE_LIMIT: RateLimitPolicy = { limit: 3, windowSeconds: 60 * 60 };

export function resendThrottleKeys(ip: string, email: string): { ip: string; email: string } {
  return { ip: `verify-resend:ip:${ip}`, email: `verify-resend:email:${email.trim().toLowerCase()}` };
}

// Adresse saisie pour un renvoi : entrée non fiable, bornée, jamais journalisée.
export function parseResendEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return isEmailShaped(email) ? email : null;
}
