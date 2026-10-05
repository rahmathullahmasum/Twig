import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import db from "../db.server";
import { logger } from "../lib/logger.server";

/**
 * Resource route (no UI) that individual apps call at install time to report
 * the merchant's email -- the one thing the Partner API itself can never
 * give us (see CLAUDE.md). Matches on (trackedAppId, shopDomain): shopDomain
 * is the one identifier guaranteed to be the same value in both the Partner
 * API (Shop.myshopifyDomain) and an individual app's own OAuth session
 * (the `shop` param) -- their respective GIDs are different ID spaces, don't
 * try to cross-reference those instead.
 *
 * Request: POST, header `X-Ingest-Secret: <INGEST_SECRET>`, JSON body
 * `{ trackedAppId: string, shopDomain: string, email: string }`.
 *
 * If no ShopInstallation row exists yet for that shop (the periodic Partner
 * API sync hasn't caught the install event yet), the email is dropped and a
 * warning is logged -- not queued/retried. In practice the Partner API event
 * and this call both fire around install time, so this is a narrow race;
 * revisit with a pending-email table if it proves to actually drop data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return data({ ok: false, message: "INGEST_SECRET is not configured on the server." }, { status: 503 });
  }
  if (request.headers.get("X-Ingest-Secret") !== secret) {
    return data({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return data({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { trackedAppId, shopDomain, email } = (body ?? {}) as Record<string, unknown>;
  if (typeof trackedAppId !== "string" || typeof shopDomain !== "string" || typeof email !== "string") {
    return data(
      { ok: false, message: "Expected { trackedAppId: string, shopDomain: string, email: string }" },
      { status: 400 },
    );
  }

  const result = await db.shopInstallation.updateMany({
    where: { trackedAppId, shopDomain },
    data: { email },
  });

  if (result.count === 0) {
    logger.warn(
      { trackedAppId, shopDomain },
      "ingest-shop: no matching ShopInstallation yet (Partner API sync may not have caught up) -- email dropped",
    );
    return data({ ok: false, message: "No matching shop found yet; try again shortly." }, { status: 404 });
  }

  logger.info({ trackedAppId, shopDomain }, "ingest-shop: recorded shop email");
  return data({ ok: true });
};
