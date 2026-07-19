import type { EmailPort } from "./email-port";
import { ResendEmailAdapter } from "./resend-email-adapter";
import { ConsoleEmailAdapter } from "./console-email-adapter";

let cached: EmailPort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un
// SDK d'envoi directement (même principe que getFileStoragePort()).
export function getEmailPort(): EmailPort {
  if (cached) return cached;

  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;

  if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
    cached = new ResendEmailAdapter({ apiKey: RESEND_API_KEY, from: RESEND_FROM_EMAIL });
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Envoi d'email non configuré : RESEND_API_KEY/RESEND_FROM_EMAIL requis en production."
    );
  }

  cached = new ConsoleEmailAdapter();
  return cached;
}

export type { EmailPort, EmailMessage, EmailAttachment } from "./email-port";
