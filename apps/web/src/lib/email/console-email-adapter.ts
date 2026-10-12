import type { EmailDelivery, EmailPort, EmailMessage } from "./email-port";

// Fallback dev/tant-que-Resend-non-configuré — n'envoie rien, journalise
// seulement. Ne jamais utiliser en production (cf. getEmailPort()).
export class ConsoleEmailAdapter implements EmailPort {
  async send(message: EmailMessage): Promise<EmailDelivery> {
    console.log("[ConsoleEmailAdapter] Email non envoyé (RESEND_API_KEY absent) :", {
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      attachments: message.attachments?.map((a) => a.filename),
    });
    return "NOT_CONFIGURED";
  }
}
