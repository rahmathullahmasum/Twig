import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireUser } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { RangeFilter } from "../components/RangeFilter";
import { DeltaBadge } from "../components/DeltaBadge";
import { LineChart } from "../components/ui";
import db from "../db.server";

const RANGE_VALUES = [7, 30, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseRangeDays(request: Request): (typeof RANGE_VALUES)[number] {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("range"));
  return (RANGE_VALUES.includes(raw as (typeof RANGE_VALUES)[number]) ? raw : 30) as (typeof RANGE_VALUES)[number];
}

function sumBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return rows.reduce((sum, row) => sum + (row[key] as number), 0);
}

const CHART_COLORS = ["#3E5BD6", "#E0702A", "#0F9D86", "#8B4FC9", "#C23A7A", "#8F7400"];

function compactNumber(n: number): string {
  const rounded = Math.round(n);
  const abs = Math.abs(rounded);
  if (abs >= 1000) {
    const k = rounded / 1000;
    return `${(abs >= 10000 ? k.toFixed(0) : k.toFixed(1)).replace(/\.0$/, "")}k`;
  }
  return String(rounded);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  const rangeDays = parseRangeDays(request);

  const apps = await db.trackedApp.findMany({ orderBy: { createdAt: "asc" } });

  const now = new Date();
  const currentStart = new Date(now.getTime() - rangeDays * DAY_MS);
  const previousStart = new Date(now.getTime() - 2 * rangeDays * DAY_MS);

  const [currentMetrics, previousMetrics] = await Promise.all([
    db.appMetricsDaily.findMany({ where: { date: { gte: currentStart } }, orderBy: { date: "asc" } }),
    db.appMetricsDaily.findMany({ where: { date: { gte: previousStart, lt: currentStart } } }),
  ]);

  const byDate = new Map<string, { activeInstalls: number; newInstalls: number; uninstalls: number; reinstalls: number }>();
  const byAppByDate = new Map<string, Map<string, number>>(); // trackedAppId -> date -> activeInstalls
  for (const m of currentMetrics) {
    const key = m.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { activeInstalls: 0, newInstalls: 0, uninstalls: 0, reinstalls: 0 };
    entry.activeInstalls += m.activeInstalls;
    entry.newInstalls += m.newInstalls;
    entry.uninstalls += m.uninstalls;
    entry.reinstalls += m.reinstalls;
    byDate.set(key, entry);

    const appDates = byAppByDate.get(m.trackedAppId) ?? new Map<string, number>();
    appDates.set(key, m.activeInstalls);
    byAppByDate.set(m.trackedAppId, appDates);
  }
  const trend = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const allDates = trend.map(([date]) => date);
  const perAppTrend = apps.map((a) => ({
    id: a.id,
    name: a.name,
    series: allDates.map((date) => byAppByDate.get(a.id)?.get(date) ?? 0),
  }));

  const currentTotals = {
    newInstalls: sumBy(currentMetrics, "newInstalls"),
    uninstalls: sumBy(currentMetrics, "uninstalls"),
    reinstalls: sumBy(currentMetrics, "reinstalls"),
  };
  const previousTotals = {
    newInstalls: sumBy(previousMetrics, "newInstalls"),
    uninstalls: sumBy(previousMetrics, "uninstalls"),
    reinstalls: sumBy(previousMetrics, "reinstalls"),
  };

  const activeCounts = await db.shopInstallation.groupBy({
    by: ["trackedAppId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const activeByApp = new Map(activeCounts.map((c) => [c.trackedAppId, c._count._all]));
  const totalActive = [...activeByApp.values()].reduce((a, b) => a + b, 0);
  const activeAtRangeStart = trend.length > 0 ? trend[0][1].activeInstalls : totalActive;

  const revenueByCurrency = await db.appTransaction.groupBy({
    by: ["currencyCode"],
    where: { occurredAt: { gte: currentStart } },
    _sum: { grossAmount: true },
  });

  const revenueTransactions = await db.appTransaction.findMany({
    where: { occurredAt: { gte: currentStart } },
    select: { occurredAt: true, grossAmount: true, currencyCode: true },
  });
  const revenueByDateByCurrency = new Map<string, Map<string, number>>(); // currency -> date -> amount
  for (const t of revenueTransactions) {
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

  return {
    rangeDays,
    apps: apps.map((a) => ({ id: a.id, name: a.name, activeInstalls: activeByApp.get(a.id) ?? 0 })),
    trend: trend.map(([date, v]) => ({ date, ...v })),
    perAppTrend,
    revenueTrend,
    currentTotals,
    previousTotals,
    totalActive,
    activeAtRangeStart,
    revenueByCurrency,
    email: user.email,
  };
};

export default function Dashboard() {
  const {
    rangeDays,
    apps,
    trend,
    perAppTrend,
    revenueTrend,
    currentTotals,
    previousTotals,
    totalActive,
    activeAtRangeStart,
    revenueByCurrency,
    email,
  } = useLoaderData<typeof loader>();

  const labels = trend.map((t) => t.date);

  return (
    <AppLayout apps={apps} userEmail={email}>
      <header className="page-head">
        <div>
          <h1 className="h1">Portfolio Overview</h1>
          <p className="sub">Installs, uninstalls, and growth across every tracked app.</p>
        </div>
        <div className="head-actions">
          <RangeFilter />
        </div>
      </header>

      {apps.length === 0 && (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ margin: 0 }}>
            Go to <Link to="/apps">Apps</Link> and add your first one to start syncing install/uninstall data.
          </p>
        </div>
      )}

      <div className="stats">
        <div className="card stat">
          <div className="stat-top">
            <span className="stat-label">Active installs (all apps)</span>
            <DeltaBadge current={totalActive} previous={activeAtRangeStart} />
          </div>
          <div className="stat-value num">{totalActive.toLocaleString()}</div>
        </div>
        <div className="card stat">
          <div className="stat-top">
            <span className="stat-label">New installs ({rangeDays}d)</span>
            <DeltaBadge current={currentTotals.newInstalls} previous={previousTotals.newInstalls} />
          </div>
          <div className="stat-value num">{currentTotals.newInstalls.toLocaleString()}</div>
        </div>
        <div className="card stat">
          <div className="stat-top">
            <span className="stat-label">Uninstalls ({rangeDays}d)</span>
            <DeltaBadge current={currentTotals.uninstalls} previous={previousTotals.uninstalls} />
          </div>
          <div className="stat-value num">{currentTotals.uninstalls.toLocaleString()}</div>
        </div>
        <div className="card stat">
          <div className="stat-top">
            <span className="stat-label">Reinstalls ({rangeDays}d)</span>
            <DeltaBadge current={currentTotals.reinstalls} previous={previousTotals.reinstalls} />
          </div>
          <div className="stat-value num">{currentTotals.reinstalls.toLocaleString()}</div>
        </div>
      </div>

      {revenueByCurrency.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Revenue ({rangeDays}d)</h2>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            {revenueByCurrency.map((r) => (
              <div key={r.currencyCode ?? "unknown"}>
                <div className="stat-label">{r.currencyCode ?? "Unknown currency"}</div>
                <div className="stat-value" style={{ fontSize: 22, marginTop: 4 }}>
                  {(r._sum.grossAmount ?? 0).toLocaleString(undefined, {
                    style: r.currencyCode ? "currency" : "decimal",
                    currency: r.currencyCode ?? undefined,
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Active installs over time</h2>
            <p className="card-meta">All apps combined · daily snapshot</p>
          </div>
        </div>
        <div className="card-body">
          {trend.length > 1 ? (
            <LineChart
              series={[{ name: "Active installs", color: "#3E5BD6", values: trend.map((t) => t.activeInstalls) }]}
              labels={labels}
              area
              formatValue={compactNumber}
              formatTooltip={(v) => Math.round(v).toLocaleString()}
            />
          ) : (
            <p className="muted">Not enough history yet to chart a trend — check back after a few sync runs.</p>
          )}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">New installs vs. uninstalls vs. reinstalls</h2>
              <p className="card-meta">All apps · per day</p>
            </div>
          </div>
          <div className="card-body">
            {trend.length > 1 ? (
              <LineChart
                series={[
                  { name: "New installs", color: "#3E5BD6", values: trend.map((t) => t.newInstalls) },
                  { name: "Uninstalls", color: "#E0702A", values: trend.map((t) => t.uninstalls) },
                  { name: "Reinstalls", color: "#0F9D86", values: trend.map((t) => t.reinstalls) },
                ]}
                labels={labels}
                zeroBased
                showLegend
                legendMetric="total"
              />
            ) : (
              <p className="muted">Not enough history yet to chart a trend — check back after a few sync runs.</p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Active installs by app</h2>
              <p className="card-meta">One line per tracked app</p>
            </div>
          </div>
          <div className="card-body">
            {perAppTrend.length > 1 && trend.length > 1 ? (
              <LineChart
                series={perAppTrend.map((a, i) => ({ name: a.name, color: CHART_COLORS[i % CHART_COLORS.length], values: a.series }))}
                labels={labels}
                zeroBased
                formatValue={compactNumber}
                formatTooltip={(v) => Math.round(v).toLocaleString()}
                showLegend
                legendMetric="last"
              />
            ) : (
              <p className="muted">Not enough history yet to chart a trend — check back after a few sync runs.</p>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Revenue over time</h2>
          </div>
        </div>
        <div className="card-body">
          {revenueTrend.length > 0 ? (
            <LineChart
              series={revenueTrend.map((r, i) => ({
                name: r.currency === "unknown" ? "Unknown currency" : r.currency,
                color: CHART_COLORS[i % CHART_COLORS.length],
                values: r.series,
              }))}
              labels={revenueTrend[0]?.labels ?? labels}
              area
              formatValue={(v) => `$${compactNumber(v)}`}
              formatTooltip={(v) => v.toLocaleString(undefined, { style: "currency", currency: "USD" })}
            />
          ) : (
            <p className="muted">No revenue recorded in this period yet.</p>
          )}
        </div>
      </section>

      {apps.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">By app</h2>
            </div>
          </div>
          <div className="tscroll">
            <div className="thead" style={{ gridTemplateColumns: "minmax(240px, 1fr) 160px" }}>
              <span>App</span>
              <span>Active installs</span>
            </div>
            {apps.map((a) => (
              <div key={a.id} className="trow" style={{ gridTemplateColumns: "minmax(240px, 1fr) 160px" }}>
                <Link to={`/apps/${a.id}`} style={{ fontWeight: 500 }}>
                  {a.name}
                </Link>
                <span className="num">{a.activeInstalls.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
