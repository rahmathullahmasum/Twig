import type { ReactNode } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { AppProvider, Layout, Card, Text, BlockStack, InlineStack, Grid, DataTable, Banner } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { LineChart } from "@shopify/polaris-viz";
import { requireAuth } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { RangeFilter } from "../components/RangeFilter";
import { DeltaBadge } from "../components/DeltaBadge";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth(request);
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
    series: allDates.map((date) => ({ key: date, value: byAppByDate.get(a.id)?.get(date) ?? 0 })),
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
    series: [...byDateForCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value })),
  }));

  return {
    rangeDays,
    apps: apps.map((a) => ({ id: a.id, name: a.name, activeInstalls: activeByApp.get(a.id) ?? 0 })),
    trend,
    perAppTrend,
    revenueTrend,
    currentTotals,
    previousTotals,
    totalActive,
    activeAtRangeStart,
    revenueByCurrency,
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
  } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={polarisTranslations}>
      <AppLayout title="Portfolio Overview" subtitle="Installs, uninstalls, and growth across every tracked app" apps={apps}>
      <Layout>
        <Layout.Section>
          <RangeFilter />
        </Layout.Section>

        {apps.length === 0 && (
          <Layout.Section>
            <Banner tone="info" title="No apps tracked yet">
              <p>
                Go to <Link to="/apps">Apps</Link> and add your first one to start syncing install/uninstall data.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard
                label="Active installs (all apps)"
                value={totalActive.toLocaleString()}
                badge={<DeltaBadge current={totalActive} previous={activeAtRangeStart} />}
              />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard
                label={`New installs (${rangeDays}d)`}
                value={currentTotals.newInstalls.toLocaleString()}
                badge={<DeltaBadge current={currentTotals.newInstalls} previous={previousTotals.newInstalls} />}
              />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard
                label={`Uninstalls (${rangeDays}d)`}
                value={currentTotals.uninstalls.toLocaleString()}
                badge={<DeltaBadge current={currentTotals.uninstalls} previous={previousTotals.uninstalls} />}
              />
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <StatCard
                label={`Reinstalls (${rangeDays}d)`}
                value={currentTotals.reinstalls.toLocaleString()}
                badge={<DeltaBadge current={currentTotals.reinstalls} previous={previousTotals.reinstalls} />}
              />
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {revenueByCurrency.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Revenue ({rangeDays}d)
                </Text>
                <InlineStack gap="600">
                  {revenueByCurrency.map((r) => (
                    <BlockStack gap="100" key={r.currencyCode ?? "unknown"}>
                      <Text as="span" tone="subdued">
                        {r.currencyCode ?? "Unknown currency"}
                      </Text>
                      <Text as="p" variant="headingLg">
                        {(r._sum.grossAmount ?? 0).toLocaleString(undefined, {
                          style: r.currencyCode ? "currency" : "decimal",
                          currency: r.currencyCode ?? undefined,
                        })}
                      </Text>
                    </BlockStack>
                  ))}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Active installs over time (all apps combined)
              </Text>
              {trend.length > 1 ? (
                <div style={{ height: 240 }}>
                  <LineChart
                    data={[
                      {
                        name: "Active installs",
                        data: trend.map(([date, v]) => ({ key: date, value: v.activeInstalls })),
                      },
                    ]}
                  />
                </div>
              ) : (
                <Text as="p" tone="subdued">
                  Not enough history yet to chart a trend — check back after a few sync runs.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                New installs vs. uninstalls
              </Text>
              {trend.length > 1 ? (
                <div style={{ height: 240 }}>
                  <LineChart
                    data={[
                      { name: "New installs", data: trend.map(([date, v]) => ({ key: date, value: v.newInstalls })) },
                      { name: "Uninstalls", data: trend.map(([date, v]) => ({ key: date, value: v.uninstalls })) },
                      { name: "Reinstalls", data: trend.map(([date, v]) => ({ key: date, value: v.reinstalls })) },
                    ]}
                  />
                </div>
              ) : (
                <Text as="p" tone="subdued">
                  Not enough history yet to chart a trend — check back after a few sync runs.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {perAppTrend.length > 1 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Active installs by app
                </Text>
                {trend.length > 1 ? (
                  <div style={{ height: 240 }}>
                    <LineChart data={perAppTrend.map((a) => ({ name: a.name, data: a.series }))} />
                  </div>
                ) : (
                  <Text as="p" tone="subdued">
                    Not enough history yet to chart a trend — check back after a few sync runs.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Revenue over time
              </Text>
              {revenueTrend.length > 0 ? (
                <div style={{ height: 240 }}>
                  <LineChart
                    data={revenueTrend.map((r) => ({
                      name: r.currency === "unknown" ? "Unknown currency" : r.currency,
                      data: r.series,
                    }))}
                  />
                </div>
              ) : (
                <Text as="p" tone="subdued">
                  No revenue recorded in this period yet.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {apps.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  By app
                </Text>
                <DataTable
                  columnContentTypes={["text", "numeric"]}
                  headings={["App", "Active installs"]}
                  rows={apps.map((a) => [
                    <Link key={a.id} to={`/apps/${a.id}`}>
                      {a.name}
                    </Link>,
                    a.activeInstalls,
                  ])}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
      </AppLayout>
    </AppProvider>
  );
}

function StatCard({ label, value, badge }: { label: string; value: string; badge: ReactNode }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="span" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
        {badge}
      </BlockStack>
    </Card>
  );
}
