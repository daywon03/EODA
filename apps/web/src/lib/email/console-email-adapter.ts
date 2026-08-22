import type { EmailPort, EmailMessage } from "./email-port";

// Fallback dev/tant-que-Resend-non-configuré — n'envoie rien, journalise
// seulement. Ne jamais utiliser en production (cf. getEmailPort()).
export class ConsoleEmailAdapter implements EmailPort {
  async send(message: EmailMessage): Promise<void> {
    console.log("[ConsoleEmailAdapter] Email non envoyé (RESEND_API_KEY absent) :", {
      to: message.to,
      subject: message.subject,
      attachments: message.attachments?.map((a) => a.filename),
    });
  }
}
