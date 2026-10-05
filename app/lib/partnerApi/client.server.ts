import { logger } from "../logger.server";

// Confirmed by introspection against the real API before writing this file
// (see CLAUDE.md "Key decisions"): endpoint shape, auth header, and that
// "2026-01" is a valid version.
function endpoint(): string {
  const orgId = process.env.PARTNER_API_ORGANIZATION_ID;
  const version = process.env.PARTNER_API_VERSION || "2026-01";
  if (!orgId) throw new Error("PARTNER_API_ORGANIZATION_ID is not set");
  return `https://partners.shopify.com/${orgId}/api/${version}/graphql.json`;
}

interface GraphQLEnvelope<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
}

const MAX_RETRIES = 3;
// The Partner API allows 4 requests/second per client; a small fixed delay
// between calls keeps a sync loop comfortably under that without needing a
// token-bucket -- there's no per-call cost extension like the Admin API.
const MIN_INTERVAL_MS = 300;

let lastCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

export async function partnerGraphqlJson<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const accessToken = process.env.PARTNER_API_ACCESS_TOKEN;
  if (!accessToken) throw new Error("PARTNER_API_ACCESS_TOKEN is not set");

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const waitFor = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (waitFor > 0) await sleep(waitFor);
    lastCallAt = Date.now();

    let response: Response;
    try {
      response = await fetch(endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      lastError = error;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After")) || 2;
      logger.warn({ attempt, retryAfterSeconds }, "Partner API returned 429, backing off");
      await sleep(retryAfterSeconds * 1000);
      continue;
    }

    const json = (await response.json()) as GraphQLEnvelope<T>;

    if (json.errors && json.errors.length > 0) {
      const throttled = json.errors.some((e) => e.extensions?.code === "THROTTLED");
      if (throttled) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`Partner API error: ${JSON.stringify(json.errors)}`);
    }

    if (!json.data) {
      throw new Error("Partner API response had no data");
    }

    return json.data;
  }

  throw lastError instanceof Error ? lastError : new Error("Partner API request failed after retries");
}
