import type { EmailProvider, SendEmailInput, SendEmailResult } from "../types";
import { logger } from "../../logger.server";

/** Fallback when RESEND_API_KEY isn't set -- logs instead of sending, so nothing silently no-ops. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    logger.info({ to: input.to, subject: input.subject }, "[email:console] would send email");
    return { provider: this.name, providerMessageId: null, status: "logged" };
  }
}
