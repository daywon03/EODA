// ─────────────────────────────────────────────────────────────────────────────
// ÉCHEC DE PRODUCTION DU PDF DU DEVIS — quelle cause, quel message.
//
// Test de bout en bout du 12/10 : Chromium ne pouvait pas s'exécuter sur le poste
// local et l'écran disait « Réessayez dans un instant ». Réessayer redonnait le même
// échec. Un message d'erreur nomme le problème ET le recours qui marche : on ne
// propose de réessayer que lorsque réessayer peut aboutir (délai dépassé).
//
// Module pur (aucun import de puppeteer) : le service de rendu étiquette l'étape qui
// a échoué, ce fichier décide du message.
// ─────────────────────────────────────────────────────────────────────────────

export type DevisPdfFailureStage = "LAUNCH" | "TIMEOUT" | "PAGE";

export class DevisPdfError extends Error {
  readonly stage: DevisPdfFailureStage;

  constructor(stage: DevisPdfFailureStage, cause?: unknown) {
    super(`Production du PDF du devis échouée (${stage})`, { cause });
    this.name = "DevisPdfError";
    this.stage = stage;
  }
}

const MESSAGES: Record<DevisPdfFailureStage | "UNKNOWN", string> = {
  LAUNCH:
    "Le PDF n'a pas pu être produit : le moteur de rendu (Chromium) ne démarre pas sur ce serveur. Réessayer ne changera rien — utilisez « Télécharger » et joignez le PDF à votre e-mail.",
  TIMEOUT:
    "La page du devis a mis trop de temps à répondre pour produire le PDF. Réessayez dans un instant.",
  PAGE:
    "La page imprimable du devis n'a pas pu être ouverte pour produire le PDF. Ouvrez « Télécharger » pour vérifier qu'elle s'affiche.",
  UNKNOWN:
    "Le PDF du devis n'a pas pu être produit (erreur inattendue). Utilisez « Télécharger » et joignez le PDF à votre e-mail.",
};

// Jamais le message technique d'origine à l'écran : il reste dans le journal serveur.
export function devisPdfFailureMessage(error: unknown): string {
  return error instanceof DevisPdfError ? MESSAGES[error.stage] : MESSAGES.UNKNOWN;
}
