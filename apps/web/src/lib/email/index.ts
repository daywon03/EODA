import type { EmailPort } from "./email-port";
import { ResendEmailAdapter } from "./resend-email-adapter";
import { ConsoleEmailAdapter } from "./console-email-adapter";
import { getEnv } from "@/lib/config/env";

let cached: EmailPort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un
// SDK d'envoi directement (même principe que getFileStoragePort()).
export function getEmailPort(): EmailPort {
  if (cached) return cached;

  const env = getEnv();

  if (env.resend) {
    cached = new ResendEmailAdapter(env.resend);
    return cached;
  }

  if (env.isProduction) {
    throw new Error(
      "Envoi d'email non configuré : RESEND_API_KEY/RESEND_FROM_EMAIL requis en production."
    );
  }

  cached = new ConsoleEmailAdapter();
  return cached;
}

export type { EmailPort, EmailMessage, EmailAttachment } from "./email-port";
