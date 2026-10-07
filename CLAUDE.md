# Shopify App Portfolio Dashboard — Project Context for AI Sessions

> Read this first in any new session. This project's sibling/predecessor is
> `D:\Shopify Growth Intelligence` (a per-merchant analytics Shopify app) — this
> is a **different, separate project** for a different goal: read that project's
> own `CLAUDE.md` only if working on it specifically; don't conflate the two.

## What this project is

The user builds and sells several Shopify apps (currently ~7, a few published/approved
with 30+ combined merchant installs). Their goal: **one central dashboard** showing,
across ALL their apps: how many installs, why growth is/isn't happening, who
uninstalled and why, which merchants to target for win-back/re-engagement.

This is explicitly **not** the same as `Shopify Growth Intelligence` (which analyzes
one merchant's store data from inside an app that merchant installs). This tool sits
**outside** all of their apps and pulls data centrally via Shopify's **Partner API** —
deliberately chosen so their existing apps' codebases don't need to be touched for
install/uninstall/revenue tracking. The one exception, by explicit later request
("collect every type of data possible"): **shop email**, which the Partner API simply
does not expose (see "Key decisions") -- closing that gap does require a small,
one-time addition to each individual app (see "Shop email ingestion" below).

## Current status

**Built, verified clean (`tsc`/`eslint`/build), AND confirmed working end-to-end
against the user's real production data.** Built:
- Full project (React Router v7 + Prisma/Postgres + Polaris), password-gated internal
  tool at `/login`.
- Partner API client (`app/lib/partnerApi/client.server.ts`) with auth + backoff.
- Event-sync pipeline (`app/lib/sync/syncApp.server.ts`): pulls `RELATIONSHIP_INSTALLED`
  /`_UNINSTALLED`/`_REACTIVATED`/`_DEACTIVATED` events per tracked app, derives current
  `ShopInstallation` state, classifies uninstall reasons.
  `app/lib/sync/metricsRollup.server.ts`: daily per-app rollup.
- `pg-boss` worker: syncs every tracked app every 15 minutes.
- Routes: `/login`, `/dashboard` (portfolio-wide, sums across apps), `/apps` (add a new
  app to track + per-app quick stats), `/apps/:id` (per-app detail: shop list, uninstall
  reason breakdown), `/settings` (change password, **"Sync all apps now"** -- a manual
  full refresh across every tracked app; see the 2026-10-07 note below for why the old
  per-app "Sync now" button was removed in favor of this single one).
- **Revenue tracking** (2026-10-04, same session as the email work below):
  `app/lib/sync/syncTransactions.server.ts` pulls `AppSubscriptionSale`/`AppOneTimeSale`/
  `AppUsageSale` via the Partner API's `transactions(appId: ...)` root query (needs the
  "View financials" permission on the API client -- already granted). Stored in the new
  `AppTransaction` model, its own cursor field (`SyncCursor.lastTransactionAt`, separate
  from the events cursor since it's a different query entirely). Wired into the same
  worker sweep and the `/apps` add/sync actions. Dashboard and per-app pages show gross
  revenue grouped by currency (not summed across currencies -- see "Key decisions").
  Live-tested against the real app: query works, `0` transactions (it's free/no sales
  yet) -- not yet observed with actual non-zero revenue data.
- **Shop email ingestion** (2026-10-04): `ShopInstallation.email` (nullable) +
  `app/routes/api.ingest-shop.tsx`, a resource route (POST, header
  `X-Ingest-Secret: <INGEST_SECRET>`, body `{trackedAppId, shopDomain, email}`) that the
  user's *individual* apps call at install time to report the merchant's email -- the
  one thing Partner API can never give us. Matches on `(trackedAppId, shopDomain)`, not
  any GID (see "Key decisions" for why). **Live-tested end-to-end**: POSTed a real shop
  domain + fake test email, confirmed it landed in `ShopInstallation.email`, confirmed
  wrong-secret requests get 401, then deleted the test email again so no fake data is
  left in the real database. The route itself is proven; **no individual app has been
  wired up to call it yet** -- that's the next step, on the user's side (see "What's next").
- UI pass (2026-10-05): replaced the plain top-link nav with a persistent left sidebar
  (`AppLayout.tsx`, listing every tracked app for quick navigation), added a 7/30/90-day
  range filter + current-vs-previous delta badges to the dashboard, added search +
  active/inactive filtering to the per-app shop list, and replaced the plain reason
  table with colored `ReasonBadge`s + proportional bars. See "File map" for details.
- Local Postgres (Laragon) set up and migrated — see "Key decisions" below.
- **Subscription/plan tracking** (2026-10-05): `app/lib/sync/syncSubscriptions.server.ts`
  pulls each active shop's current pricing plan via the Partner API's
  `activeSubscription(appId, shopId)` query. **Required bumping `PARTNER_API_VERSION`
  from `2026-01` to `2026-07`** -- `activeSubscription` doesn't exist as a root field
  before that version (confirmed by re-probing root fields per version; see schema
  section below). Re-verified the existing events/transactions sync still work
  correctly at `2026-07` before relying on it. Stored directly on `ShopInstallation`
  (`planHandle`, `planAmount`, `planCurrencyCode`, `billingPeriod`, `trialEndsAt`,
  `subscriptionSyncedAt`) since a shop has at most one active subscription per app at a
  time -- no history table needed (unlike `AppTransaction`). One API call per active
  shop (no bulk query exists for this), so it's its own daily job
  (`JOBS.SWEEP_SUBSCRIPTIONS`), separate from the 15-minute main sweep, plus wired into
  `/apps`' manual "add"/"sync" actions. **App Store listing content (title,
  description, screenshots, icon, category) is confirmed NOT available anywhere in the
  Partner API**, any version -- the user asked, this was checked and ruled out, don't
  re-investigate it without new information. **Live-tested**: ran against all 54 active
  shops of the real app, zero errors, all currently on the free plan (`planHandle:
  null` for every shop) -- not yet observed with an actual paid plan assigned.
- **Win-back emails** (2026-10-05): the user asked "how do I email someone when they
  uninstall if I don't have their email" -- answer: you can't, for shops whose email
  was never ingested (see the email-ingestion item above); the fix is backfilling
  *currently active* shops' emails now (template added to README.md) so future
  uninstalls aren't missing it. Built on top of that: `app/lib/email/` (EmailProvider
  abstraction -- `ResendEmailProvider` via raw fetch to Resend's HTTP API, no SDK
  dependency added; `ConsoleEmailProvider` fallback when `RESEND_API_KEY` isn't set) and
  `sendWinbackEmail.server.ts`, which personalizes the message by the shop's classified
  `reasonCategory` and logs every attempt to the new `EmailLog` model. Triggered via a
  per-shop "Send win-back" button in `apps_.$id.tsx`'s shop table (uninstalled shops
  with an email on file only) -- manual, one-at-a-time, deliberately **not** gated
  behind a consent-flag system the way the sibling project's bulk Growth Actions are
  (this is a one-off action by the app owner, not automated bulk marketing; the email
  itself includes an informal opt-out line). **Live-tested end-to-end**: set a test
  email on a real uninstalled shop, sent (via the console provider), confirmed the
  `EmailLog` row, then deleted both the test email and the test log row so no fake data
  remains in the real database.

**Live-verified** (2026-10-04): synced the user's real app "Twig Announcement Bar"
(org `4736574`, app GID `gid://partners/App/359001030657`) end-to-end — 145 real events,
78 shops, 54 active / 24 uninstalled. This is what drove the pagination fix and the
uninstall-reason classifier rewrite described below. Not yet exercised: the `/apps` UI
flow for adding an app (the live test above was done via a one-off script calling
`syncTrackedApp` directly, not through the route) and the `npm run worker` background
schedule actually firing.

## How the Partner API schema was confirmed (don't re-guess this)

Before writing any code, the live schema was introspected directly (with the user's
real token) via `curl` + GraphQL introspection queries — not assumed from docs alone,
since Partner API docs pages were incomplete/inconsistent when fetched. Findings:

- **Auth**: `X-Shopify-Access-Token: <token>` header. Endpoint:
  `https://partners.shopify.com/{organizationId}/api/{version}/graphql.json`.
  Confirmed working versions: `2026-01`, `2025-10`, `unstable`. `2025-07` and earlier
  quarterly strings tried returned "Invalid API version" — **don't assume older
  version strings work**; if `2026-01` ever stops working, re-probe with the same
  `for v in ...; do curl ...; done` approach used here before picking a new one.
- **No "list all my apps" query exists** at the root (`QueryRoot` only has `app(id)`,
  `transaction(id)`, `transactions(...)`, `publicApiVersions`). There's also no
  `organization`/`organizations` root field despite some docs implying one. This is why
  apps are added **manually** via the Apps page — there's no way to auto-discover them.
  (Also tried discovering app IDs via `transactions { ... app { id name } }` in case
  billing history could reveal them — returned empty for this account, since none of
  the tracked apps have any paid transaction yet. Don't rely on that path either.)
- **`App` object** only has: `id`, `name`, `apiKey`, `events(...)`. No install-count
  field of its own — install counts must be derived from events.
- **`App.events`** args: `after`, `before`, `first`, `last`, `types`, `shopId`,
  `chargeId`, `occurredAtMin`, `occurredAtMax` → `AppEventConnection`.
- **`PageInfo` has NO `endCursor`** on the user's real organization's schema (only
  `hasNextPage`/`hasPreviousPage`) — this *contradicted* what the initial introspection
  against a different, now-unused organization (`5191146`, an example/demo org, since
  replaced by the real one `4736574`) seemed to imply by not showing an error. Querying
  `pageInfo { endCursor }` against the real org fails with `"Field 'endCursor' doesn't
  exist on type 'PageInfo'"`. **Lesson: re-introspect per organization if a query
  behaves unexpectedly — don't assume schema parity across orgs.** The fix: paginate
  using the last edge's own `cursor` field as the next `after` value, not
  `pageInfo.endCursor` (see `app/lib/partnerApi/queries.server.ts`).
- **`AppEventTypes` enum** (confirmed full list): `RELATIONSHIP_INSTALLED`,
  `RELATIONSHIP_UNINSTALLED`, `RELATIONSHIP_REACTIVATED`, `RELATIONSHIP_DEACTIVATED`,
  plus charge/subscription/credit/usage types (not used by this project yet, but
  available later if revenue tracking is wanted — the "View financials" permission
  gates those).
- **`RelationshipInstalled`** fields: `app`, `occurredAt`, `shop`, `type`.
- **`RelationshipUninstalled`** fields: same plus `reason` (String, nullable) and
  `description` (String, nullable). **Confirmed against 24 real uninstall events**:
  `reason` is the text of a fixed option from Shopify's own uninstall survey dropdown
  (NOT a stable language-independent code) — critically, **it comes back localized to
  the merchant's own language**. Observed real values: English ("Too expensive"-style
  presets — the ones actually seen were "Not using app now", "Store is closing or
  pausing", "Testing multiple apps", "Other (please specify)"), German
  ("App wird derzeit nicht genutzt"), Chinese ("测试多个应用"), French
  ("Test de plusieurs applis"), Spanish ("No me satisfacen las funciones de la app").
  `description` is the free-text field the merchant fills in **only** when they pick
  "Other (please specify)" — it's `null` for every other preset. Roughly a fifth of
  uninstalls had `reason: null, description: null` entirely (merchant skipped the
  survey) or came back with `shop.name`/`shop.myshopifyDomain` as the literal string
  `"REDACTED"` for a subset of shops (cause unconfirmed — possibly Shopify's own
  privacy handling for some shops; don't assume it's a bug in this code if you see it
  again). `classifyUninstallReason.ts` now exact-matches known preset strings
  (including the non-English ones observed so far) before falling back to English
  keyword matching on `description` — add more locale strings as they're observed
  rather than guessing translations upfront.
- **`Shop`** fields: `id`, `name`, `myshopifyDomain`, `avatarUrl`. **No email field** —
  **re-confirmed against the real organization** (not just the demo org) on 2026-10-04,
  and re-checked that the root `QueryRoot` has no other query that exposes it either
  (same 4 fields as before: `app`, `publicApiVersions`, `transaction`, `transactions`).
  This is genuinely not available from Partner API, full stop -- it's the source of the
  "shop email ingestion" feature (see "Key decisions" and "What's next").
- **`Transaction` interface + the money-bearing concrete types**: `AppSubscriptionSale`,
  `AppOneTimeSale`, and `AppUsageSale` all share the identical field shape --
  `app, chargeId, createdAt, grossAmount, id, netAmount, shop, shopifyFee` (all
  `Money`-typed except `chargeId`/`createdAt`/`id`). `Money` = `{ amount: Decimal,
  currencyCode: Currency }`. The root `transactions(appId, after, createdAtMin, ...)`
  query returns these (plus non-revenue types like `LegacyTransaction`,
  `ReferralTransaction`, `TaxTransaction`, `ThemeSale`, `ServiceSale` -- ignored, see
  `RELEVANT_TRANSACTION_TYPES` in `queries.server.ts`). Confirmed via introspection +
  one live query against the real app (returned `[]` -- zero paid transactions so far).
- **Rate limit**: 4 requests/second per Partner API client (confirmed from docs, not
  independently load-tested). The client's fixed 300ms min-interval between calls
  keeps comfortably under that.
- **Root-level `QueryRoot` fields differ by API version** -- confirmed by re-probing on
  2026-10-05 the same way as the original version probe: `2026-01`/`2026-04` only have
  `app`, `publicApiVersions`, `transaction`, `transactions`; `2026-07` adds
  `activeSubscription` and a root-level `events`; `unstable` adds even more
  (`appSubscriptionMigrationOperation`, `eventsinks`, `migratableAppSubscriptions`, ...).
  **If a query/field you expect isn't there, re-probe versions before concluding it
  doesn't exist at all** -- this project is now pinned to `2026-07` specifically because
  `activeSubscription` needs it.
- **`activeSubscription(appId, shopId)` takes Admin-API-style GIDs
  (`gid://shopify/App/<id>`, `gid://shopify/Shop/<id>`), not the `gid://partners/...`
  GIDs every other query in this project uses** -- even though it's called through the
  Partner API. Confirmed live: `gid://partners/App/...` errors with `"Invalid GID app
  name 'partners'. Use 'shopify' instead"`; swapping just the prefix (same numeric id)
  works. `toShopifyGid()` in `queries.server.ts` does this conversion -- use it, don't
  pass a `gid://partners/...` value into this one query.
- **`activeSubscription` has no bulk/list form** -- it's one appId+shopId pair per call,
  no pagination, no "all shops for this app" query exists. Confirmed by its args
  (`appId: ID!, shopId: ID!`, both required, no `first`/`after`). This is why its sync
  iterates active `ShopInstallation` rows one at a time and runs as its own
  daily job rather than the 15-minute sweep.
- **App Store listing content is NOT in the Partner API, confirmed across 3 versions**
  (`2026-01`, `2026-04`, `2026-07`): the `App` object has exactly 4 fields in all of
  them (`id`, `name`, `apiKey`, `events`) -- no title/description/screenshots/icon/
  category/pricing-display fields anywhere, and no separate "AppListing" type exists in
  the schema. A web search summary claimed otherwise (said `App` exposes "Description,
  Pricing details, Screenshots, Banner, Icon") -- that was wrong; trust the direct
  introspection result over a secondhand search summary when the two conflict. The user
  explicitly decided not to add manual-entry fields for this either, so there is
  currently no way to see listing content from within this tool at all -- Partner
  Dashboard only.
- **No marketing-attribution data exists in the Partner API at all** (2026-10-05):
  the user asked whether Partner Dashboard's graphs could be replicated for marketing
  use. Listed and searched all 126 types in the schema for anything related to
  geography/country, page views/impressions, or traffic source/search terms --
  **none exist**. The only "graph-worthy" data available is what this project already
  pulls (install/uninstall events, revenue transactions, active subscriptions) -- there
  is nothing further to go fetch for this purpose. Don't re-search for this without new
  information (e.g. a future Partner API version changelog mentioning it).

## Key decisions

- **Separate project, not a feature bolted onto `Shopify Growth Intelligence`** — user's
  explicit choice. Don't merge them later without being asked.
- **Shop email closes via an ingestion endpoint, not a Partner API trick** (user
  explicitly asked, after the gap was explained, to "collect every type of data
  possible"): Partner API's `Shop` type has no email field, full stop (re-confirmed
  against the real org too). `app/routes/api.ingest-shop.tsx` is the one place that
  accepts it, from the *individual apps themselves* (each already gets shop email via
  its own Admin API OAuth flow). This still requires touching each of those apps' code
  once (a few lines calling this endpoint at install time) -- that's an accepted
  tradeoff now, not avoided. **Match on `(trackedAppId, shopDomain)`, never any GID**:
  Partner API shop GIDs (`gid://partners/Shop/...`) and Shopify Admin API shop GIDs
  (`gid://shopify/Shop/...`) are different ID spaces with no confirmed numeric
  correspondence -- `myshopifyDomain` / the OAuth `shop` param is the only identifier
  guaranteed identical in both systems. Still no "send email" button built here --
  this only *records* the email; actually emailing a shop is a decision for later once
  there's real data to act on.
- **Revenue amounts are grouped and displayed per-currency, never summed across
  currencies** -- `AppTransaction.currencyCode` can differ per transaction (it's
  whatever `Money.currencyCode` the Partner API returns), and adding e.g. USD + EUR
  raw numbers would silently produce a meaningless total. If revenue is ever needed as
  a single portfolio-wide number, convert currencies explicitly first (with real
  exchange rates) -- don't just sum `grossAmount` across rows without checking
  `currencyCode` first.
- **UI pass #2** (2026-10-05, "make the UI even better"): shop avatar/logo in the per-app
  shop table (Polaris `Avatar`, falls back to initials -- see note below), a centralized
  loading indicator (`AppLayout.tsx` renders a thin top progress bar via `useNavigation()`
  whenever ANY page is loading/navigating -- don't re-add per-page spinners, they were
  tried and removed in favor of this one central one), relative-time formatting
  (`app/lib/formatRelativeTime.ts`, e.g. "2 hours ago") everywhere a raw date was shown,
  and a mobile-responsive sidebar (collapses to a hamburger-toggled drawer below 768px,
  plain CSS in a `<style>` tag inside `AppLayout.tsx` -- no CSS file/stylesheet
  infrastructure exists in this project, that's deliberate, don't add one for one
  component's sake). **Checked against real data: every shop's `avatarUrl` came back
  `null`** (verified via a direct query against several real shops) -- not a bug, most
  merchants apparently never set a shop logo Partner API would expose. The `Avatar`
  component still renders a reasonable initials-based fallback from the shop name, so
  this isn't wasted, just don't expect real logo images to show up without a merchant
  that has one configured.
- **"Marketing graphs" request (2026-10-05)**: resulted in 4 new charts, all built from
  data this project already collects (see the schema-search note above for what was
  *ruled out*): dashboard.tsx gained "New installs vs. uninstalls" (3-series: new/
  uninstalls/reinstalls), "Active installs by app" (one line per tracked app -- only
  shown when there's more than 1 app), and "Revenue over time" (one line per currency,
  from `AppTransaction`, bucketed by day in JS since Prisma has no simple date-trunc
  groupBy). apps_.$id.tsx gained its own per-app "Active installs over time" (from
  `AppMetricsDaily` filtered to that app -- this page never had an installs trend chart
  before, only the combined stat cards) and a revenue-over-time chart inside the
  existing Revenue card (uses ALL of that app's transactions, not just the 20 shown in
  the recent-transactions table below it). All day-bucketing here follows the same
  pattern as the original portfolio trend code -- group into a `Map<dateString, ...>`
  in JS, don't try to push this into a Prisma query.
- **Apps are added manually, growably** — the user said more apps will come over time;
  the `TrackedApp` table + Apps page form is designed for that (paste an ID, get a
  name, done — no code change per new app).
- **Uninstall reason classification is a local keyword matcher**
  (`app/lib/sync/classifyUninstallReason.ts`), same pattern as the sibling project, not
  an AI call — kept simple and free. Revisit once real `reason`/`description` values
  are observed (see schema notes above).
- **REACTIVATED/DEACTIVATED events are logged but don't change `ShopInstallation.isActive`**
  yet — these appear to be billing-level pause/resume, distinct from a full
  install/uninstall cycle, but this wasn't confirmed against real data. If dashboard
  numbers look wrong for an app that uses recurring billing, check `AppEventLog` for
  these event types first.
- **`AppMetricsDaily` only ever computes "today"'s row** (`computeAppMetricsForToday`,
  called after every sync) — no historical backfill for days before an app was added to
  tracking. The portfolio trend chart will just be short for newly-added apps; that's
  expected, not a bug.
- **Migrated from local Postgres (Laragon) to Neon on 2026-10-05.** Was deliberately
  local-only for a while ("move later"); now moved. New Neon project: `App Portfolio
  Dashboard`, branch `production`, region AWS US East 2 (Ohio), database `neondb`,
  **connection pooling off** (direct connection — fine at this project's scale, and
  simpler for Prisma migrations). Migration method: `pg_dump` (plain SQL, schema+data,
  `--no-owner --no-privileges`) from local `app_portfolio` → `psql` restore straight into
  the fresh `neondb` — not `prisma migrate deploy` + reseed, since the dump already
  carries `_prisma_migrations` history, so `prisma migrate status` reports "up to date"
  with no extra step. Verified row-for-row (`TrackedApp`/`ShopInstallation`/
  `AppEventLog`/`AppTransaction`/`EmailLog` counts) matched local before cutting over.
  The old local Postgres (Laragon, `postgres`/`root`@`localhost:5432`/`app_portfolio`)
  still has the data too (dump was non-destructive) but is no longer the source of
  truth — `.env`'s `DATABASE_URL` now points at Neon. If a DB call ever fails with
  "Can't reach database server", this is now a Neon reachability/credentials issue, not
  the old "Laragon Postgres didn't auto-start" one.
- **`ShopInstallation.description`** (added after the live test, separate from
  `reason`) stores the free-text the merchant typed for "Other (please specify)".
  Earlier code had a bug where `reason` and `description` were conflated into one
  field, silently discarding the free-text whenever `reason` was non-null — fixed in
  `syncApp.server.ts`; don't reintroduce that merge.

## What's next

1. ~~Get a real Partner GID and verify end-to-end~~ **Done** (2026-10-04) — see
   "Current status" above for the result and what it changed.
2. ~~Run the full verification suite~~ **Done** — clean after every change in this
   session, including the pagination and classifier fixes.
3. ~~Exercise the actual `/apps` UI~~ **Done** — the "Add & sync" form and (now)
   Settings' "Sync all apps now" button have both been live-tested through the real
   route/action, not just by calling `syncTrackedApp` directly from a script.
4. ~~Confirm `npm run worker` actually fires the 15-minute sweep~~ **Done** (2026-10-07)
   — user was having to click "Sync now" manually because nothing kept the worker
   process alive. Now runs persistently under **pm2** (see README's "Keeping the sync
   worker running"); confirmed both `sweep.all-apps` (*/15 * * * *) and
   `sweep.subscriptions` (0 3 * * *) registered in `pgboss.schedule` in Neon. On
   Windows, pm2 can't run `npm run worker:start` directly in fork mode (`.cmd` shim +
   `spawn EINVAL`) — start it against tsx's JS entrypoint instead:
   `pm2 start node_modules/tsx/dist/cli.mjs --name portfolio-worker -- app/lib/jobs/worker.ts`,
   with `NODE_ENV=production` set (dev mode's `pino-pretty` transport doesn't surface
   logs reliably under pm2 on Windows; plain JSON logging does). `pm2-windows-startup`
   is installed globally so pm2 itself relaunches on Windows login and resurrects the
   saved process list (`pm2 save`) — don't forget to re-run `pm2 save` after changing
   how the worker is started. **Later the same day**, the user found the pm2 console
   window on Windows annoying enough to ask for it off entirely until they deploy to a
   real (Linux) server -- the worker was stopped and removed from pm2 (`pm2 delete
   portfolio-worker && pm2 save --force`), so **auto-sync is currently OFF**. Don't
   re-enable it proactively; restart with the `pm2 start ...` line above (+ `pm2 save`)
   only when asked. This is also why the old per-app "Sync now" button (in `/apps`) was
   removed and replaced with a single "Sync all apps now" button in `/settings` --
   without the background worker, manual re-sync needed to stay easy to reach, and one
   button for every app beats clicking "Sync now" per app one at a time.
5. Add the user's other apps (manually, via `/apps`, one ID at a time) as they're
   ready to be tracked.
6. ~~Decide whether/how to close the "no email" gap~~ **Decided + built** (2026-10-04,
   user asked to collect everything) — the ingestion endpoint
   (`api.ingest-shop.tsx`) is built and live-tested. **Still open: wire each real app
   up to actually call it.** For each app, at the point right after OAuth completes
   (wherever it already fetches/stores the merchant's shop email), add:
   ```ts
   fetch("http://localhost:3100/api/ingest-shop", { // or the deployed URL later
     method: "POST",
     headers: { "Content-Type": "application/json", "X-Ingest-Secret": process.env.PORTFOLIO_INGEST_SECRET },
     body: JSON.stringify({ trackedAppId: "<this app's TrackedApp.id from /apps>", shopDomain: session.shop, email: shopEmail }),
   }).catch(() => {}); // best-effort, never let this block or fail the app's own install flow
   ```
   The `trackedAppId` for each app is visible in this dashboard's `/apps` page (or its
   URL when you click into it). Each app needs `INGEST_SECRET`'s value as its own env
   var to send that header.
7. **Watch for real revenue data** once any tracked app has an actual paid
   conversion -- the `transactions` sync has only been verified against an all-zero
   account so far (query confirmed correct, but never seen a non-empty, real payload).
   Double-check `AppTransaction` rows and the dashboard/per-app revenue cards look
   right the first time real money shows up.
8. Deploy docs / Dockerfile / CI weren't set up yet for this project (the sibling
   project's `Dockerfile`/`fly.toml`/`.github/workflows/ci.yml` are a template to copy
   from if/when this one is ready to deploy) -- remember to add `INGEST_SECRET` and
   `PARTNER_API_*` to whatever secrets store is used.

## Routing gotcha already hit once

`apps.$id.tsx` silently never rendered — clicking the app name, or navigating to
`/apps/<id>` directly, kept showing the `/apps` list page instead (URL changed, no
console error, no server error; `curl`-ing the route directly returned the *correct*
HTML, proving the bug was routing/matching, not data or auth). Cause: `@react-router/fs-routes`
treats `apps.tsx` as the required parent **layout** for any `apps.*` file (here,
`apps.$id.tsx`) — and `apps.tsx`'s component has no `<Outlet />`, so the child route's
output had nowhere to mount. **Fixed by renaming to `apps_.$id.tsx`** (trailing
underscore on the `apps` segment opts a route out of that parent-layout nesting,
producing the same `/apps/:id` URL as a standalone route). If you add another
`foo.bar.tsx` file sitting next to an existing `foo.tsx` that ISN'T meant to be a
layout for it, use this same `foo_.bar.tsx` trick up front — don't wait to rediscover
this.

## File map

```
app/
  db.server.ts, root.tsx, entry.server.tsx, routes.ts   Same pattern as the sibling project.
  lib/
    auth/session.server.ts        Individual accounts (User model), cookie session, forgot/reset
                                   password. Was a single shared DASHBOARD_PASSWORD
                                   (DashboardSettings singleton row) until 2026-10-07, replaced
                                   because more than one person needed their own login --
                                   registration is self-service via /register but gated to
                                   ALLOWED_EMAIL_DOMAIN since this is an internal company tool.
    partnerApi/
      client.server.ts            Auth + rate-limit-aware fetch wrapper.
      queries.server.ts           Events, transactions, AND activeSubscription queries.
                                   Paginates via edges[].cursor, NOT pageInfo.endCursor (see above).
                                   toShopifyGid() converts gid://partners/... -> gid://shopify/...
                                   for the one query (activeSubscription) that needs it.
    sync/
      syncApp.server.ts            Pulls events since last cursor, derives ShopInstallation.
      syncTransactions.server.ts   Pulls revenue transactions since last cursor (separate
                                    cursor field, separate Partner API query).
      syncSubscriptions.server.ts  Pulls current plan for every ACTIVE shop (one API call
                                    each, no bulk query exists -- see "Key decisions").
      metricsRollup.server.ts      Today's AppMetricsDaily row per app.
      classifyUninstallReason.ts   Preset-string matcher (multi-locale) + English keyword
                                    fallback on `description`, verified against real data.
    jobs/
      queue.server.ts, worker.ts  pg-boss. Two schedules: 15-min sweep (events,
                                   transactions, metrics, per app) and a separate daily
                                   sweep for subscriptions (O(active shops), kept off the
                                   15-min cycle on purpose).
  routes/
    login.tsx, logout.tsx, register.tsx, forgot-password.tsx, reset-password.tsx, _index.tsx
    settings.tsx          Change own password (requires current password), log out,
                          "Sync all apps now" (manual full re-sync across every tracked
                          app -- the only manual sync entry point since the per-app
                          "Sync now" button was removed 2026-10-07). One account's own
                          settings -- no admin/user-management UI exists.
    users.tsx, users_.$id.tsx   Read-only list of every registered account + per-account
                          info (joined date, password-last-changed). No edit/delete.
    dashboard.tsx         Portfolio-wide (sums AppMetricsDaily across all apps), date-range
                          filterable (7/30/90d via RangeFilter), delta badges vs. previous
                          period, revenue-by-currency card.
    apps.tsx              Add a new tracked app (runs an initial sync); per-app quick
                          stats. No per-row sync button (removed 2026-10-07) -- manual
                          re-sync is now "Sync all apps now" in /settings, one button
                          for every tracked app instead of one per row.
    apps_.$id.tsx         Per-app detail: shop list (searchable + active/inactive filter,
                          client-side -- data volume is small, now shows email + plan
                          columns), uninstall reason breakdown (proportional bars +
                          ReasonBadge), revenue-by-currency + recent transactions table.
                          The trailing underscore in the filename is deliberate -- see
                          "Routing gotcha".
    api.ingest-shop.tsx   POST-only resource route (no UI): individual apps call this at
                          install time to report shop email. See "Key decisions" and
                          "What's next" for the auth/matching rules and the integration
                          snippet.
  components/
    AppLayout.tsx    Shared page shell: left sidebar (nav + list of tracked apps,
                     mobile-responsive drawer below 768px) + Polaris Page for the
                     content area + a global top progress bar driven by
                     useNavigation(). Every route wraps its content in this (inside its
                     own <AppProvider>) instead of a layout *route*, to sidestep the
                     exact nesting trap described in "Routing gotcha".
    DeltaBadge.tsx   current-vs-previous percent-change badge (green up / red down / "New" / "Flat").
    ReasonBadge.tsx  Colored label for an UninstallReasonCategory.
    RangeFilter.tsx  7/30/90-day segmented control, reused on dashboard.tsx.
  lib/formatRelativeTime.ts  "2 hours ago" style formatting, used wherever a date is shown.
  lib/email/
    provider.server.ts            Factory: Resend if RESEND_API_KEY+EMAIL_FROM set, else console.
    providers/resend.server.ts    Raw fetch to Resend's HTTP API, no SDK dependency.
    providers/console.server.ts   Fallback -- logs instead of sending.
    sendWinbackEmail.server.ts    The one send path in this project; personalizes by
                                   reasonCategory, writes EmailLog regardless of outcome.

prisma/schema.prisma  TrackedApp, ShopInstallation (now with `email`, `shopAvatarUrl`,
                      `planHandle`/`planAmount`/`planCurrencyCode`/`billingPeriod`/
                      `trialEndsAt`/`subscriptionSyncedAt`), AppEventLog, AppTransaction,
                      SyncCursor (now with `lastTransactionAt`), AppMetricsDaily, EmailLog.
```
