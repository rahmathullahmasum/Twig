import { partnerGraphqlJson } from "./client.server";

// Every field/type/enum value here was confirmed via GraphQL introspection
// against the live Partner API before being written (see CLAUDE.md). The
// Partner API has no "list all my apps" query -- app IDs are added manually
// via the Apps page (see app/routes/apps.tsx).

export type PartnerAppEventType = "INSTALLED" | "UNINSTALLED" | "REACTIVATED" | "DEACTIVATED";

export interface PartnerAppEvent {
  type: "RELATIONSHIP_INSTALLED" | "RELATIONSHIP_UNINSTALLED" | "RELATIONSHIP_REACTIVATED" | "RELATIONSHIP_DEACTIVATED";
  occurredAt: string;
  shop: { id: string; name: string; myshopifyDomain: string; avatarUrl: string | null };
  reason?: string | null;
  description?: string | null;
}

interface AppEventsResponse {
  app: {
    id: string;
    name: string;
    events: {
      edges: { cursor: string; node: PartnerAppEvent }[];
      pageInfo: { hasNextPage: boolean };
    };
  } | null;
}

const APP_EVENTS_QUERY = `#graphql
  query AppEvents($id: ID!, $after: String, $occurredAtMin: DateTime) {
    app(id: $id) {
      id
      name
      events(
        first: 100
        after: $after
        occurredAtMin: $occurredAtMin
        types: [RELATIONSHIP_INSTALLED, RELATIONSHIP_UNINSTALLED, RELATIONSHIP_REACTIVATED, RELATIONSHIP_DEACTIVATED]
      ) {
        edges {
          cursor
          node {
            type
            occurredAt
            shop { id name myshopifyDomain avatarUrl }
            ... on RelationshipUninstalled {
              reason
              description
            }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  }
`;

export async function fetchAppEventsPage(
  partnerGid: string,
  after: string | null,
  occurredAtMin: string | undefined,
): Promise<AppEventsResponse["app"]> {
  const data = await partnerGraphqlJson<AppEventsResponse>(APP_EVENTS_QUERY, {
    id: partnerGid,
    after,
    occurredAtMin,
  });
  return data.app;
}

/** Fetches every event page for one app since `occurredAtMin` (or all history if omitted). */
export async function fetchAllAppEvents(
  partnerGid: string,
  occurredAtMin?: string,
): Promise<{ appName: string | null; events: PartnerAppEvent[] }> {
  const events: PartnerAppEvent[] = [];
  let after: string | null = null;
  let appName: string | null = null;

  do {
    const app = await fetchAppEventsPage(partnerGid, after, occurredAtMin);
    if (!app) break;
    appName = app.name;
    for (const edge of app.events.edges) events.push(edge.node);
    // This API's PageInfo has no endCursor -- the next `after` is the last
    // edge's own cursor (confirmed by introspection, see CLAUDE.md).
    const lastEdge = app.events.edges.at(-1);
    after = app.events.pageInfo.hasNextPage && lastEdge ? lastEdge.cursor : null;
  } while (after);

  return { appName, events };
}

// --- Revenue (Partner API "transactions" root query -- requires the "View
// financials" permission on the Partner API client). Only the three
// transaction types that carry an actual Money amount are relevant here;
// the rest of the Transaction union (LegacyTransaction, ReferralTransaction,
// TaxTransaction, ThemeSale, ServiceSale, ...) is out of scope for app revenue.

export type PartnerTransactionType = "AppSubscriptionSale" | "AppOneTimeSale" | "AppUsageSale";

export interface PartnerTransaction {
  __typename: PartnerTransactionType | string;
  id: string;
  createdAt: string;
  grossAmount?: { amount: string; currencyCode: string } | null;
  netAmount?: { amount: string; currencyCode: string } | null;
  shop?: { id: string; name: string; myshopifyDomain: string } | null;
}

interface TransactionsResponse {
  transactions: {
    edges: { cursor: string; node: PartnerTransaction }[];
    pageInfo: { hasNextPage: boolean };
  };
}

const APP_TRANSACTIONS_QUERY = `#graphql
  query AppTransactions($appId: ID!, $after: String, $createdAtMin: DateTime) {
    transactions(first: 50, after: $after, appId: $appId, createdAtMin: $createdAtMin) {
      edges {
        cursor
        node {
          __typename
          id
          createdAt
          ... on AppSubscriptionSale {
            grossAmount { amount currencyCode }
            netAmount { amount currencyCode }
            shop { id name myshopifyDomain avatarUrl }
          }
          ... on AppOneTimeSale {
            grossAmount { amount currencyCode }
            netAmount { amount currencyCode }
            shop { id name myshopifyDomain avatarUrl }
          }
          ... on AppUsageSale {
            grossAmount { amount currencyCode }
            netAmount { amount currencyCode }
            shop { id name myshopifyDomain avatarUrl }
          }
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

const RELEVANT_TRANSACTION_TYPES = new Set<string>(["AppSubscriptionSale", "AppOneTimeSale", "AppUsageSale"]);

/** Fetches every revenue transaction for one app since `createdAtMin` (or all history if omitted). */
export async function fetchAllAppTransactions(
  partnerGid: string,
  createdAtMin?: string,
): Promise<PartnerTransaction[]> {
  const transactions: PartnerTransaction[] = [];
  let after: string | null = null;

  do {
    const data: TransactionsResponse = await partnerGraphqlJson<TransactionsResponse>(APP_TRANSACTIONS_QUERY, {
      appId: partnerGid,
      after,
      createdAtMin,
    });
    for (const edge of data.transactions.edges) {
      if (RELEVANT_TRANSACTION_TYPES.has(edge.node.__typename)) transactions.push(edge.node);
    }
    const lastEdge = data.transactions.edges.at(-1);
    after = data.transactions.pageInfo.hasNextPage && lastEdge ? lastEdge.cursor : null;
  } while (after);

  return transactions;
}

// --- Active subscription (current pricing plan) per (app, shop). Only
// available from API version 2026-07 onward (confirmed: 2026-01 and 2026-04
// don't have this root field at all -- re-probe versions the same way as
// documented in CLAUDE.md if this ever 404s).
//
// Gotcha confirmed live: this query wants Admin-API-style GIDs
// (`gid://shopify/App/<id>`, `gid://shopify/Shop/<id>`), NOT the
// `gid://partners/...` GIDs the rest of this file uses -- even though it's
// called through the Partner API. The numeric id is the same, just the
// prefix differs. Use `toShopifyGid()` to convert before calling this.

export function toShopifyGid(partnerGid: string, resourceType: "App" | "Shop"): string {
  const numericId = partnerGid.replace(/\D/g, "");
  return `gid://shopify/${resourceType}/${numericId}`;
}

export interface ActiveSubscriptionInfo {
  billingPeriod: string;
  cancelAtEndOfCycle: boolean;
  trialEndsAt: string | null;
  items: {
    handle: string | null;
    description: string | null;
    price: { active: boolean; currency: string; amount?: string };
  }[];
}

interface ActiveSubscriptionResponse {
  activeSubscription: ActiveSubscriptionInfo | null;
}

const ACTIVE_SUBSCRIPTION_QUERY = `#graphql
  query ActiveSubscription($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      billingPeriod
      cancelAtEndOfCycle
      trialEndsAt
      items {
        handle
        description
        price {
          active
          currency
          ... on FlatRatePrice { amount }
        }
      }
    }
  }
`;

/** `partnerAppGid`/`partnerShopGid` are this project's usual `gid://partners/...` IDs; converted internally. */
export async function fetchActiveSubscription(
  partnerAppGid: string,
  partnerShopGid: string,
): Promise<ActiveSubscriptionInfo | null> {
  const data = await partnerGraphqlJson<ActiveSubscriptionResponse>(ACTIVE_SUBSCRIPTION_QUERY, {
    appId: toShopifyGid(partnerAppGid, "App"),
    shopId: toShopifyGid(partnerShopGid, "Shop"),
  });
  return data.activeSubscription;
}
