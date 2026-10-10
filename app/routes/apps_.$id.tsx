import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { requireUser } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { ReasonBadge, reasonColor } from "../components/ReasonBadge";
import { translateReason } from "../lib/sync/classifyUninstallReason";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { sendWinbackEmail } from "../lib/email/sendWinbackEmail.server";
import { Badge, Button, Avatar, AppBadge, Select, LineChart } from "../components/ui";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  const [trackedApp, installations, reasonBreakdown, apps, revenueByCurrency, recentTransactions, allTransactions, dailyMetrics] =
    await Promise.all([
      db.trackedApp.findUniqueOrThrow({ where: { id: params.id } }),
      db.shopInstallation.findMany({
        where: { trackedAppId: params.id },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      db.shopInstallation.groupBy({
        by: ["reasonCategory"],
        where: { trackedAppId: params.id, isActive: false, reasonCategory: { not: null } },
        _count: { _all: true },
      }),
      db.trackedApp.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
      db.appTransaction.groupBy({
        by: ["currencyCode"],
        where: { trackedAppId: params.id },
        _sum: { grossAmount: true, netAmount: true },
        _count: { _all: true },
      }),
      db.appTransaction.findMany({ where: { trackedAppId: params.id }, orderBy: { occurredAt: "desc" }, take: 20 }),
      db.appTransaction.findMany({
        where: { trackedAppId: params.id },
        select: { occurredAt: true, grossAmount: true, currencyCode: true },
      }),
      db.appMetricsDaily.findMany({ where: { trackedAppId: params.id }, orderBy: { date: "asc" } }),
    ]);

  const winbackLogs = await db.emailLog.findMany({
    where: { trackedAppId: params.id, type: "winback" },
    orderBy: { sentAt: "desc" },
  });
  const lastWinbackByShop = new Map<string, (typeof winbackLogs)[number]>();
  for (const log of winbackLogs) {
    if (!lastWinbackByShop.has(log.shopGid)) lastWinbackByShop.set(log.shopGid, log);
  }

  const revenueByDateByCurrency = new Map<string, Map<string, number>>();
  for (const t of allTransactions) {
    if (!t.grossAmount) continue;
    const currency = t.currencyCode ?? "unknown";
    const key = t.occurredAt.toISOString().slice(0, 10);
    const byDateForCurrency = revenueByDateByCurrency.get(currency) ?? new Map<string, number>();
    byDateForCurrency.set(key, (byDateForCurrency.get(key) ?? 0) + t.grossAmount);
    revenueByDateByCurrency.set(currency, byDateForCurrency);
  }
  const revenueTrend = [...revenueByDateByCurrency.entries()].map(([currency, byDateForCurrency]) => ({
    currency,
    labels: [...byDateForCurrency.keys()].sort((a, b) => a.localeCompare(b)),
    series: [...byDateForCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
  }));

  const activeInstallsLabels = dailyMetrics.map((m) => m.date.toISOString().slice(0, 10));
  const activeInstallsTrend = dailyMetrics.map((m) => m.activeInstalls);

  const lastWinbackByShopGid: Record<string, { status: string; sentAt: string }> = {};
  for (const [shopGid, log] of lastWinbackByShop) {
    lastWinbackByShopGid[shopGid] = { status: log.status, sentAt: log.sentAt.toISOString() };
  }

  return {
    trackedApp,
    installations,
    reasonBreakdown,
    apps,
    revenueByCurrency,
    recentTransactions,
    revenueTrend,
    activeInstallsLabels,
    activeInstallsTrend,
    lastWinbackByShopGid,
    email: user.email,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "send-winback") {
    const shopInstallationId = String(formData.get("shopInstallationId"));
    const result = await sendWinbackEmail(shopInstallationId);
    if (!result.sent) {
      return { ok: false, message: `Couldn't send: ${result.status}` };
    }
    return {
      ok: true,
      message: result.status === "logged" ? "Logged (no RESEND_API_KEY configured — no email actually sent)." : "Email sent.",
    };
  }

  return { ok: false, message: "Unknown action" };
};

type StatusFilter = "all" | "active" | "inactive";

export default function AppDetail() {
  const {
    trackedApp,
    installations,
    reasonBreakdown,
    apps,
    revenueByCurrency,
    recentTransactions,
    revenueTrend,
    activeInstallsLabels,
    activeInstallsTrend,
    lastWinbackByShopGid,
    email,
  } = useLoaderData<typeof loader>();
  const winbackFetcher = useFetcher<typeof action>();
  const active = installations.filter((i) => i.isActive);
  const inactive = installations.filter((i) => !i.isActive);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return installations
      .filter((i) => {
        if (status === "active" && !i.isActive) return false;
        if (status === "inactive" && i.isActive) return false;
        if (term.length === 0) return true;
        return i.shopName.toLowerCase().includes(term) || i.shopDomain.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        // Most recent activity first -- a shop's uninstall date if it has
        // one, otherwise its install date -- so active and uninstalled
        // shops interleave by date instead of clustering by status.
        const dateA = new Date(a.uninstalledAt ?? a.installedAt).getTime();
        const dateB = new Date(b.uninstalledAt ?? b.installedAt).getTime();
        return dateB - dateA;
      });
  }, [installations, search, status]);

  const sortedReasons = [...reasonBreakdown].sort((a, b) => b._count._all - a._count._all);
  const maxReasonCount = Math.max(1, ...sortedReasons.map((r) => r._count._all));

  return (
    <AppLayout apps={apps} userEmail={email}>
      <div>
        <a href="/apps" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}>
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All apps
        </a>
      </div>

      <header className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <AppBadge name={trackedApp.name} large />
          <div>
            <h1 className="h1">{trackedApp.name}</h1>
            <p className="sub">Installed shops, uninstalls, and why they left</p>
          </div>
        </div>
      </header>

      {winbackFetcher.data?.message && (
        <p className={winbackFetcher.data.ok ? "msg-ok" : "msg-err"}>{winbackFetcher.data.message}</p>
      )}

      <div className="stats">
        <div className="card stat">
          <span className="stat-label">Active installs</span>
          <div className="stat-value num">{active.length}</div>
        </div>
        <div className="card stat">
          <span className="stat-label">Uninstalled</span>
          <div className="stat-value num">{inactive.length}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Active installs over time</h2>
          </div>
        </div>
        <div className="card-body">
          {activeInstallsTrend.length > 1 ? (
            <LineChart
              series={[{ name: "Active installs", color: "#3E5BD6", values: activeInstallsTrend }]}
              labels={activeInstallsLabels}
              area
              formatTooltip={(v) => Math.round(v).toLocaleString()}
            />
          ) : (
            <p className="muted">Not enough history yet to chart a trend — check back after a few sync runs.</p>
          )}
        </div>
      </section>

      {sortedReasons.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Why shops uninstalled</h2>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 10 }}>
            {sortedReasons.map((r) => {
              const pct = (r._count._all / maxReasonCount) * 100;
              return (
                <div className="reason-row" key={r.reasonCategory}>
                  <span>
                    <ReasonBadge category={r.reasonCategory} />
                  </span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: reasonColor(r.reasonCategory) }} />
                  </div>
                  <span className="num" style={{ textAlign: "right", fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600 }}>{r._count._all}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Revenue</h2>
          </div>
        </div>
        <div className="card-body">
          {revenueByCurrency.length === 0 ? (
            <p className="muted">No revenue recorded yet for this app.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 16 }}>
                {revenueByCurrency.map((r) => (
                  <div key={r.currencyCode}>
                    <div className="stat-label">Gross revenue ({r.currencyCode ?? "unknown currency"})</div>
                    <div className="stat-value" style={{ fontSize: 22, marginTop: 4 }}>
                      {(r._sum.grossAmount ?? 0).toLocaleString(undefined, {
                        style: r.currencyCode ? "currency" : "decimal",
                        currency: r.currencyCode ?? undefined,
                      })}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {r._count._all} transaction(s)
                    </div>
                  </div>
                ))}
              </div>
              {revenueTrend.length > 0 && (
                <LineChart
                  series={revenueTrend.map((r, i) => ({
                    name: r.currency === "unknown" ? "Unknown currency" : r.currency,
                    color: ["#3E5BD6", "#E0702A", "#0F9D86", "#8B4FC9"][i % 4],
                    values: r.series,
                  }))}
                  labels={revenueTrend[0]?.labels ?? []}
                  small
                  area
                  formatValue={(v) => `$${Math.round(v)}`}
                  formatTooltip={(v) => v.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                />
              )}
              <div className="card-split" style={{ marginTop: 16 }}>
                <div className="tscroll">
                  <div className="thead g-txn">
                    <span>Type</span>
                    <span>Shop</span>
                    <span className="t-right">Gross amount</span>
                    <span>Date</span>
                  </div>
                  {recentTransactions.map((t) => (
                    <div key={t.id} className="trow g-txn" style={{ minHeight: 44 }}>
                      <span>
                        <Badge tone="neutral">{t.type.replace(/^App/, "").replace(/Sale$/, "")}</Badge>
                      </span>
                      <span className="truncate">{t.shopDomain ?? "—"}</span>
                      <span className="num t-right" style={{ fontWeight: 500 }}>
                        {t.grossAmount !== null
                          ? t.grossAmount.toLocaleString(undefined, { style: "currency", currency: t.currencyCode ?? "USD" })
                          : "—"}
                      </span>
                      <span className="muted num">{new Date(t.occurredAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Shops</h2>
            <p className="card-meta">Showing {filtered.length} of {installations.length} shops</p>
          </div>
        </div>
        <div className="toolbar">
          <div className="input-icon" style={{ flex: "1 1 280px", maxWidth: 360 }}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <label htmlFor="shop-search" style={{ position: "absolute", left: -9999 }}>
              Search shops
            </label>
            <input
              id="shop-search"
              className="input"
              type="search"
              placeholder="Search by shop name or domain"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            ariaLabel="Status"
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
            style={{ width: 180 }}
            options={[
              { label: "All shops", value: "all" },
              { label: "Active only", value: "active" },
              { label: "Uninstalled only", value: "inactive" },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No shops match this filter.</div>
        ) : (
          <div className="tscroll">
            <div className="thead g-shops">
              <span>Shop</span>
              <span>Store URL</span>
              <span>Email</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Uninstall reason</span>
              <span>What they said</span>
              <span>Installed</span>
              <span>Uninstalled</span>
              <span></span>
            </div>
            {filtered.map((i) => (
              <div key={i.id} className="trow g-shops">
                <div className="cell-shop">
                  <Avatar name={i.shopName || i.shopDomain} imageUrl={i.shopAvatarUrl} />
                  <span className="truncate" style={{ fontWeight: 500 }}>
                    {i.shopName || i.shopDomain}
                  </span>
                </div>
                <a className="truncate mono" href={`https://${i.shopDomain}`} target="_blank" rel="noopener noreferrer">
                  {i.shopDomain}
                </a>
                <span className="truncate muted">{i.email ?? "—"}</span>
                <span>
                  {i.isActive
                    ? !i.subscriptionSyncedAt
                      ? "Not checked yet"
                      : i.planHandle
                        ? `${i.planHandle}${
                            i.planAmount
                              ? ` (${i.planAmount.toLocaleString(undefined, { style: "currency", currency: i.planCurrencyCode ?? "USD" })})`
                              : ""
                          }`
                        : "Free"
                    : "—"}
                </span>
                <span>
                  <Badge tone={i.isActive ? "success" : "critical"}>{i.isActive ? "Active" : "Uninstalled"}</Badge>
                </span>
                <span>{i.isActive ? <span className="muted">—</span> : <ReasonBadge category={i.reasonCategory} />}</span>
                <span className="clamp" style={{ fontSize: 12.5 }}>
                  {i.isActive ? "—" : i.description || translateReason(i.reason) || "—"}
                </span>
                <span className="muted num">{formatRelativeTime(i.installedAt)}</span>
                <span className="muted num">{i.uninstalledAt ? formatRelativeTime(i.uninstalledAt) : "—"}</span>
                <span style={{ justifySelf: "end" }}>
                  {!i.isActive && (
                    <WinbackCell shopInstallationId={i.id} hasEmail={Boolean(i.email)} lastSent={lastWinbackByShopGid[i.shopGid]} />
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function WinbackCell({
  shopInstallationId,
  hasEmail,
  lastSent,
}: {
  shopInstallationId: string;
  hasEmail: boolean;
  lastSent?: { status: string; sentAt: string };
}) {
  const fetcher = useFetcher();

  if (!hasEmail) {
    return <span className="muted">No email on file</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {lastSent && <span className="muted" style={{ fontSize: 11.5 }}>Last sent {formatRelativeTime(lastSent.sentAt)}</span>}
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="send-winback" />
        <input type="hidden" name="shopInstallationId" value={shopInstallationId} />
        <Button type="submit" variant="secondary" size="sm" disabled={fetcher.state !== "idle"}>
          {lastSent ? "Send again" : "Send win-back email"}
        </Button>
      </fetcher.Form>
    </div>
  );
}
