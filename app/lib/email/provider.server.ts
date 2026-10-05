import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./providers/console.server";
import { ResendEmailProvider } from "./providers/resend.server";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from) {
    cached = new ResendEmailProvider(apiKey, from);
  } else {
    cached = new ConsoleEmailProvider();
  }
  return cached;
}
