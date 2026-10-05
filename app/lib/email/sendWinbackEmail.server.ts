import db from "../../db.server";
import { logger } from "../logger.server";
import { getEmailProvider } from "./provider.server";
import type { UninstallReasonCategory } from "../sync/classifyUninstallReason";

const REASON_MESSAGE: Record<UninstallReasonCategory, string> = {
  PRICING: "We get it — price matters. If budget was the blocker, reply and let us know; we may be able to help.",
  MISSING_FEATURE:
    "You mentioned something was missing. We're actively building based on feedback like yours — reply and tell us what you needed and we'll let you know when it ships.",
  USABILITY: "Sorry it felt hard to use — that's on us. We'd be glad to walk you through it directly if you give it another try.",
  SWITCHED_COMPETITOR: "We'd love to know what the other tool did better — it genuinely helps us improve.",
  EVALUATING: "Looks like you were comparing a few options — happy to answer any questions if you're still deciding.",
  STORE_CLOSED: "Totally understandable. If your store picks back up, we'll be here.",
  TECHNICAL_ISSUE: "Sorry you hit a technical issue — that's exactly the kind of bug we want to fix. Reply with any details and we'll look into it.",
  NO_LONGER_NEEDED: "No worries — if things change, the app is free to reinstall any time.",
  OTHER: "Thanks for trying the app. If anything changes, we'd love to have you back.",
};

function buildWinbackHtml(appName: string, reasonCategory: string | null): string {
  const personalized = reasonCategory && reasonCategory in REASON_MESSAGE
    ? REASON_MESSAGE[reasonCategory as UninstallReasonCategory]
    : REASON_MESSAGE.OTHER;

  return `
    <p>Hi,</p>
    <p>We noticed you uninstalled <strong>${appName}</strong>. No hard feelings — we'd just love to have you back.</p>
    <p>${personalized}</p>
    <p>The app is free to reinstall any time from the Shopify App Store.</p>
    <p style="color:#888; font-size:12px; margin-top:24px;">If you'd rather not hear from us again, just reply and let us know.</p>
  `;
}

export interface SendWinbackResult {
  sent: boolean;
  status: string;
}

/**
 * Sends (or, with no RESEND_API_KEY configured, logs) a one-off win-back
 * email to a specific uninstalled shop. Manually triggered per shop (a
 * button in the UI), not automatic -- this is a deliberate, one-at-a-time
 * action by the app owner, not a bulk marketing blast, so it isn't gated
 * behind a consent-flag system the way the sibling project's Growth Actions
 * are. Every attempt (sent, logged, or failed) is recorded in EmailLog.
 */
export async function sendWinbackEmail(shopInstallationId: string): Promise<SendWinbackResult> {
  const shop = await db.shopInstallation.findUnique({
    where: { id: shopInstallationId },
    include: { trackedApp: true },
  });

  if (!shop) return { sent: false, status: "not_found" };
  if (!shop.email) return { sent: false, status: "no_email_on_file" };

  const subject = `We'd love to have you back on ${shop.trackedApp.name}`;
  const html = buildWinbackHtml(shop.trackedApp.name, shop.reasonCategory);

  const provider = getEmailProvider();
  const result = await provider.send({ to: shop.email, subject, html });

  await db.emailLog.create({
    data: {
      trackedAppId: shop.trackedAppId,
      shopGid: shop.shopGid,
      shopDomain: shop.shopDomain,
      recipient: shop.email,
      subject,
      type: "winback",
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      status: result.status,
    },
  });

  logger.info({ shopDomain: shop.shopDomain, status: result.status }, "Win-back email attempt logged");
  return { sent: result.status === "sent" || result.status === "logged", status: result.status };
}
