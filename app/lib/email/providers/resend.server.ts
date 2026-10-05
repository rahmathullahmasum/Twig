import type { EmailProvider, SendEmailInput, SendEmailResult } from "../types";
import { logger } from "../../logger.server";

// Raw fetch against Resend's HTTP API rather than adding the `resend` SDK as
// a dependency -- this is the only call site, not worth a whole package.
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ from: this.from, to: input.to, subject: input.subject, html: input.html }),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error({ status: response.status, text }, "Resend API error");
        return { provider: this.name, providerMessageId: null, status: "failed" };
      }

      const json = (await response.json()) as { id?: string };
      return { provider: this.name, providerMessageId: json.id ?? null, status: "sent" };
    } catch (error) {
      logger.error({ error }, "Failed to send email via Resend");
      return { provider: this.name, providerMessageId: null, status: "failed" };
    }
  }
}
