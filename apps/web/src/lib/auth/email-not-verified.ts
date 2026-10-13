import { CredentialsSignin } from "next-auth";

// Refus de connexion d'un compte libre-service dont l'adresse n'est pas confirmée
// (tranche 11). Levé par authorize() (auth.ts) APRÈS la vérification du mot de passe :
// seul le titulaire du mot de passe apprend que son adresse attend une confirmation —
// pour tout autre, la connexion échoue avec le message générique (aucun oracle).
export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";

export class EmailNotVerifiedError extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}

// Lecture par le CODE plutôt que par `instanceof` : l'erreur traverse @auth/core, et
// une seconde copie du module ferait échouer `instanceof` sans bruit.
export function isEmailNotVerifiedError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === EMAIL_NOT_VERIFIED_CODE;
}
