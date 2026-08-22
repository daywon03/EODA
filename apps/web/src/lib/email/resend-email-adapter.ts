import { Resend } from "resend";
import type { EmailPort, EmailMessage } from "./email-port";

export class ResendEmailAdapter implements EmailPort {
  private readonly client: Resend;
  private readonly from: string;

  constructor(options: { apiKey: string; from: string }) {
    this.client = new Resend(options.apiKey);
    this.from = options.from;
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      ...(message.attachments && {
        attachments: message.attachments.map((a) => ({ filename: a.filename, content: a.content })),
      }),
    });

    if (error) {
      throw new Error(`Échec de l'envoi d'email via Resend : ${error.message}`);
    }
  }
}
