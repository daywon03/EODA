// Port d'envoi d'email (Dependency Inversion) — le métier ne dépend jamais
// directement d'un SDK d'envoi externe. cf. specs/02-architecture-technique.md §1,
// même principe que FileStoragePort pour le stockage.
export type EmailAttachment = { filename: string; content: Buffer; contentType: string };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
