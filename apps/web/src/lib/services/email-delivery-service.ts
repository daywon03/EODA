import type { EmailDelivery } from "@/lib/email/email-port";

// ─────────────────────────────────────────────────────────────────────────────
// CE QUE L'ÉCRAN DIT D'UN ENVOI D'E-MAIL — seulement ce qui s'est réellement passé.
//
// Test de bout en bout du 12/10 : sans RESEND_API_KEY, l'adaptateur console
// n'envoie rien, mais `send()` se terminait sans erreur — et l'écran annonçait
// « Invitation envoyée ». Le port distingue désormais SENT de NOT_CONFIGURED, et
// ce module transforme ce fait en phrase. Pur, testé.
// ─────────────────────────────────────────────────────────────────────────────

// FAILED = le fournisseur a refusé ou l'appel a levé.
export type InvitationDelivery = EmailDelivery | "FAILED";

export function invitationDeliveryMessage(
  delivery: InvitationDelivery,
  email: string
): { tone: "ok" | "warning"; text: string } {
  if (delivery === "SENT") {
    return {
      tone: "ok",
      text: `Invitation envoyée à ${email} — identifiant et mot de passe compris.`,
    };
  }
  if (delivery === "NOT_CONFIGURED") {
    return {
      tone: "warning",
      text: "Compte créé ; e-mail non envoyé en local — transmettez le mot de passe autrement.",
    };
  }
  return {
    tone: "warning",
    text: "Compte créé ; l'e-mail d'invitation n'a pas pu être envoyé — transmettez le mot de passe autrement.",
  };
}

// Décompte d'un envoi groupé : un envoi « non configuré » n'est PAS un envoi réussi.
export function countDeliveries(
  results: readonly PromiseSettledResult<EmailDelivery>[]
): { sent: number; notConfigured: number; failed: number } {
  let sent = 0;
  let notConfigured = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "rejected") failed += 1;
    else if (result.value === "SENT") sent += 1;
    else notConfigured += 1;
  }
  return { sent, notConfigured, failed };
}

// Devis : l'e-mail n'est pas parti parce que l'envoi n'est pas configuré. Le devis
// reste à son statut — il n'a été envoyé à personne.
export function devisEmailNotSentMessage(): string {
  return "E-mail non envoyé : l'envoi d'e-mails n'est pas configuré sur cet environnement (local). Utilisez « Télécharger », envoyez le PDF vous-même, puis « Marquer comme envoyé ».";
}

// Relance d'un devis, de la structure inscrite… : rien n'est parti, rien n'est
// journalisé, et l'écran le dit sans proposer de « marquer » quoi que ce soit.
export function reminderNotSentMessage(): string {
  return "Relance non envoyée : l'envoi d'e-mails n'est pas configuré sur cet environnement (local).";
}
