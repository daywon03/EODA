// Port d'envoi d'email (Dependency Inversion) — le métier ne dépend jamais
// directement d'un SDK d'envoi externe. cf. specs/02-architecture-technique.md §1,
// même principe que FileStoragePort pour le stockage.
export type EmailAttachment = { filename: string; content: Buffer; contentType: string };

export type EmailMessage = {
  to: string;
  // Copie — ex. l'expéditeur cabinet en copie d'un devis parti au prospect, pour
  // qu'il ait une trace dans sa propre boîte sans être le destinataire principal.
  cc?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

// Ce que l'envoi a RÉELLEMENT produit. `NOT_CONFIGURED` : l'adaptateur de
// développement n'a rien envoyé (pas de RESEND_API_KEY). Sans cette distinction,
// l'écran annonçait « Invitation envoyée » pour un e-mail jamais parti (test de bout
// en bout du 12/10). Un refus du fournisseur, lui, LÈVE.
export type EmailDelivery = "SENT" | "NOT_CONFIGURED";

export interface EmailPort {
  send(message: EmailMessage): Promise<EmailDelivery>;
}
