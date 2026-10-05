# Shopify App Portfolio Dashboard

An internal tool (not a Shopify app itself, not installed by merchants) that tracks
install/uninstall/growth/revenue across every Shopify app you've built and published,
in one place. Pulls data centrally from the Shopify **Partner API** — no code changes
needed in your individual apps for any of that. The one exception is shop email
(Partner API doesn't expose it at all); see "Shop email ingestion" below.

## Stack

- React Router v7 + PostgreSQL/Prisma + `@shopify/polaris`/`polaris-viz` (same stack as
  the `Shopify Growth Intelligence` project, minus anything Shopify-embedded-app-specific
  — this tool is just a plain internal web app, gated by a single shared password)
- `pg-boss` background worker: syncs every tracked app from the Partner API on a
  15-minute schedule

## First-time setup

1. **Get a Partner API access token** (organization owner only):
   partners.shopify.com → Settings → Partner API clients → Manage Partner API clients →
   create one with at least **"Manage apps"** permission (add **"View financials"** too
   if you want revenue data later). Copy the token — it's shown once.
2. **Get your organization ID**: the number in the Partner Dashboard's URL
   (`partners.shopify.com/<this number>/...`).
3. **Copy `.env.example` to `.env`** and fill in `DATABASE_URL`,
   `PARTNER_API_ORGANIZATION_ID`, `PARTNER_API_ACCESS_TOKEN`, `DASHBOARD_PASSWORD`,
   `SESSION_SECRET`, `INGEST_SECRET` (for shop email ingestion, see below).
4. `npm install && npm run db:migrate`
5. `npm run dev` (defaults to port 3100) — log in at `/login` with `DASHBOARD_PASSWORD`. Once
   logged in, change it any time from **Settings** in the sidebar — after that, the `.env`
   value is ignored (the current password lives in the `DashboardSettings` DB row, seeded
   from `DASHBOARD_PASSWORD` the first time anyone logs in).
6. `npm run worker` in a second terminal (background sync).
7. Go to **Apps**, add each app you want tracked: open it in the Partner Dashboard,
   copy the number from its URL (`partners.shopify.com/<org>/apps/<this number>/...`),
   paste it in with a display name. New apps you build later just get added the same
   way — no code changes.

## Revenue tracking

Also pulled from the Partner API (`transactions`, needs the "View financials"
permission on the API client): gross/net revenue per app, shown per-currency on the
dashboard and per-app pages. Not yet seen with real non-zero data — verified the query
itself works, but every tracked app has had $0 in transactions so far.

## Shop email ingestion (closing the one gap Partner API can't fill)

The Partner API exposes shop **name and domain**, but not the merchant's email. Since
each individual app already gets the shop's email during its own OAuth install flow,
this dashboard exposes `POST /api/ingest-shop` for those apps to report it:

```
POST /api/ingest-shop
X-Ingest-Secret: <INGEST_SECRET>
Content-Type: application/json

{ "trackedAppId": "<id from this dashboard's /apps page>", "shopDomain": "example.myshopify.com", "email": "merchant@example.com" }
```

Add a call like this to each app right after OAuth completes (wherever it already has
the shop's email), using that app's own `TrackedApp.id` (visible on `/apps` or in its
URL here). Best-effort — don't let a failed call block that app's own install flow.
Not yet wired up in any real app; the endpoint itself is built and live-tested.

```ts
// Add near the end of your app's OAuth/install handler, after you already
// have `session.shop` and the merchant's email from your own onboarding.
fetch("https://<this-dashboard-url>/api/ingest-shop", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Ingest-Secret": process.env.PORTFOLIO_INGEST_SECRET! },
  body: JSON.stringify({
    trackedAppId: "<this app's TrackedApp.id, from /apps here>",
    shopDomain: session.shop,
    email: shopEmail,
  }),
}).catch(() => {}); // best-effort; never let this block your own install flow
```

**Important: shops that uninstalled *before* this call existed have no email on
file and nothing can retroactively fill it in** (Partner API doesn't have it,
and the merchant is gone). To avoid losing email for shops that uninstall in the
*future*, backfill every **currently active** shop once, using data your app
already has, in addition to adding the call above for new installs going forward:

```ts
// One-off backfill script -- run once from inside your app's own project
// (it needs your app's own database/ORM to list existing shops + emails).
// Adjust the `getAllActiveShopsWithEmail()` call to however your app actually
// stores shops/emails -- this is a template, not a drop-in script.
import "dotenv/config";

const TRACKED_APP_ID = "<this app's TrackedApp.id, from /apps here>";
const DASHBOARD_URL = "https://<this-dashboard-url>";

async function backfill() {
  const shops = await getAllActiveShopsWithEmail(); // <- your app's own query
  for (const shop of shops) {
    if (!shop.email) continue;
    try {
      const res = await fetch(`${DASHBOARD_URL}/api/ingest-shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ingest-Secret": process.env.PORTFOLIO_INGEST_SECRET! },
        body: JSON.stringify({ trackedAppId: TRACKED_APP_ID, shopDomain: shop.domain, email: shop.email }),
      });
      console.log(shop.domain, res.status);
    } catch (err) {
      console.error(shop.domain, "failed", err);
    }
  }
}

backfill();
```

## Win-back emails

`app/lib/email/sendWinbackEmail.server.ts` sends a one-off win-back email to a specific
uninstalled shop, personalized by its classified uninstall reason. Triggered manually
("Send win-back" button in the per-app page's shop table, next to any uninstalled shop
that has an email on file) — not automatic/bulk, by design. Every attempt (sent, logged,
or failed) is recorded in `EmailLog` for audit, and the button becomes "Send again" with
a "Last sent X ago" note once one has gone out. Set `RESEND_API_KEY` + `EMAIL_FROM` in
`.env` to actually send; leave them empty and it falls back to logging the email instead
(useful for testing the flow with no real provider configured).

## Architecture

```
Partner API (app.events + transactions, per tracked app) -- polled every 15 min
  -> AppEventLog (full install/uninstall history, source of truth)
  -> AppTransaction (revenue ledger)
  -> ShopInstallation (derived current state per app+shop; email added via ingestion)
  -> AppMetricsDaily (daily rollup per app; dashboard sums across apps)
  -> Dashboard (Portfolio Overview + per-app detail)
```
