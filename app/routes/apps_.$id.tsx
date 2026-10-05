import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import {
  AppProvider,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  DataTable,
  Badge,
  Grid,
  TextField,
  ButtonGroup,
  Button,
  Avatar,
  Banner,
} from "@shopify/polaris";
import { LineChart } from "@shopify/polaris-viz";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { requireAuth } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { ReasonBadge } from "../components/ReasonBadge";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { sendWinbackEmail } from "../lib/email/sendWinbackEmail.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireAuth(request);

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
    series: [...byDateForCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value })),
  }));

  const activeInstallsTrend = dailyMetrics.map((m) => ({
    key: m.date.toISOString().slice(0, 10),
    value: m.activeInstalls,
  }));

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
    activeInstallsTrend,
    lastWinbackByShopGid,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAuth(request);
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
    activeInstallsTrend,
    lastWinbackByShopGid,
  } = useLoaderData<typeof loader>();
  const winbackFetcher = useFetcher<typeof action>();
  const active = installations.filter((i) => i.isActive);
  const inactive = installations.filter((i) => !i.isActive);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return installations.filter((i) => {
      if (status === "active" && !i.isActive) return false;
      if (status === "inactive" && i.isActive) return false;
      if (term.length === 0) return true;
      return i.shopName.toLowerCase().includes(term) || i.shopDomain.toLowerCase().includes(term);
    });
  }, [installations, search, status]);

  const sortedReasons = [...reasonBreakdown].sort((a, b) => b._count._all - a._count._all);
  const maxReasonCount = Math.max(1, ...sortedReasons.map((r) => r._count._all));

  return (
    <AppProvider i18n={polarisTranslations}>
      <AppLayout title={trackedApp.name} subtitle="Installed shops, uninstalls, and why they left" apps={apps}>
        <Layout>
          {winbackFetcher.data?.message && (
            <Layout.Section>
              <Banner tone={winbackFetcher.data.ok ? "success" : "warning"}>{winbackFetcher.data.message}</Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text as="span" tone="subdued">
                      Active installs
                    </Text>
                    <Text as="p" variant="heading2xl">
                      {active.length}
                    </Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text as="span" tone="subdued">
                      Uninstalled
                    </Text>
                    <Text as="p" variant="heading2xl">
                      {inactive.length}
                    </Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
            </Grid>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Active installs over time
                </Text>
                {activeInstallsTrend.length > 1 ? (
                  <div style={{ height: 220 }}>
                    <LineChart data={[{ name: "Active installs", data: activeInstallsTrend }]} />
                  </div>
                ) : (
                  <Text as="p" tone="subdued">
                    Not enough history yet to chart a trend — check back after a few sync runs.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {sortedReasons.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Why shops uninstalled
                  </Text>
                  <BlockStack gap="300">
                    {sortedReasons.map((r) => {
                      const pct = Math.round((r._count._all / maxReasonCount) * 100);
                      return (
                        <BlockStack gap="100" key={r.reasonCategory}>
                          <InlineStack align="space-between" blockAlign="center">
                            <ReasonBadge category={r.reasonCategory} />
                            <Text as="span" tone="subdued">
                              {r._count._all}
                            </Text>
                          </InlineStack>
                          <div
                            style={{
                              height: 8,
                              width: "100%",
                              background: "var(--p-color-bg-surface-tertiary)",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: "var(--p-color-bg-fill-emphasis)",
                                borderRadius: 4,
                              }}
                            />
                          </div>
                        </BlockStack>
                      );
                    })}
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Revenue
                </Text>
                {revenueByCurrency.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No revenue recorded yet for this app.
                  </Text>
                ) : (
                  <>
                    <InlineStack gap="400">
                      {revenueByCurrency.map((r) => (
                        <BlockStack gap="100" key={r.currencyCode}>
                          <Text as="span" tone="subdued">
                            Gross revenue ({r.currencyCode ?? "unknown currency"})
                          </Text>
                          <Text as="p" variant="headingLg">
                            {(r._sum.grossAmount ?? 0).toLocaleString(undefined, {
                              style: r.currencyCode ? "currency" : "decimal",
                              currency: r.currencyCode ?? undefined,
                            })}
                          </Text>
                          <Text as="span" tone="subdued">
                            {r._count._all} transaction(s)
                          </Text>
                        </BlockStack>
                      ))}
                    </InlineStack>
                    {revenueTrend.length > 0 && (
                      <div style={{ height: 200 }}>
                        <LineChart
                          data={revenueTrend.map((r) => ({
                            name: r.currency === "unknown" ? "Unknown currency" : r.currency,
                            data: r.series,
                          }))}
                        />
                      </div>
                    )}
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "text"]}
                      headings={["Type", "Shop", "Gross amount", "Date"]}
                      rows={recentTransactions.map((t) => [
                        t.type.replace(/^App/, "").replace(/Sale$/, ""),
                        t.shopDomain ?? "—",
                        t.grossAmount !== null
                          ? t.grossAmount.toLocaleString(undefined, {
                              style: "currency",
                              currency: t.currencyCode ?? "USD",
                            })
                          : "—",
                        new Date(t.occurredAt).toLocaleDateString(),
                      ])}
                    />
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd">
                    Shops ({filtered.length})
                  </Text>
                  <InlineStack gap="300" blockAlign="center">
                    <div style={{ minWidth: 220 }}>
                      <TextField
                        label=""
                        labelHidden
                        placeholder="Search by shop name or domain"
                        value={search}
                        onChange={setSearch}
                        autoComplete="off"
                        clearButton
                        onClearButtonClick={() => setSearch("")}
                      />
                    </div>
                    <ButtonGroup variant="segmented">
                      <Button pressed={status === "all"} onClick={() => setStatus("all")}>
                        All
                      </Button>
                      <Button pressed={status === "active"} onClick={() => setStatus("active")}>
                        Active
                      </Button>
                      <Button pressed={status === "inactive"} onClick={() => setStatus("inactive")}>
                        Uninstalled
                      </Button>
                    </ButtonGroup>
                  </InlineStack>
                </InlineStack>

                {filtered.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No shops match this filter.
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text", "text", "text", "text"]}
                    headings={["Shop", "Email", "Plan", "Status", "Reason", "Installed", "Uninstalled", "Win-back"]}
                    rows={filtered.map((i) => [
                      <InlineStack key={i.id} gap="200" blockAlign="center" wrap={false}>
                        <Avatar source={i.shopAvatarUrl ?? undefined} name={i.shopName || i.shopDomain} size="sm" />
                        <Text as="span">{i.shopName || i.shopDomain}</Text>
                      </InlineStack>,
                      i.email ?? "—",
                      i.isActive
                        ? !i.subscriptionSyncedAt
                          ? "Not checked yet"
                          : i.planHandle
                            ? `${i.planHandle}${
                                i.planAmount
                                  ? ` (${i.planAmount.toLocaleString(undefined, { style: "currency", currency: i.planCurrencyCode ?? "USD" })})`
                                  : ""
                              }`
                            : "Free"
                        : "—",
                      <Badge key={i.id} tone={i.isActive ? "success" : "critical"}>
                        {i.isActive ? "Active" : "Uninstalled"}
                      </Badge>,
                      i.isActive ? "—" : <ReasonBadge key={i.id} category={i.reasonCategory} />,
                      formatRelativeTime(i.installedAt),
                      i.uninstalledAt ? formatRelativeTime(i.uninstalledAt) : "—",
                      i.isActive ? (
                        "—"
                      ) : (
                        <WinbackCell
                          key={i.id}
                          shopInstallationId={i.id}
                          hasEmail={Boolean(i.email)}
                          lastSent={lastWinbackByShopGid[i.shopGid]}
                        />
                      ),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </AppLayout>
    </AppProvider>
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
    return (
      <Text as="span" tone="subdued">
        No email on file
      </Text>
    );
  }

  return (
    <BlockStack gap="100">
      {lastSent && (
        <Text as="span" tone="subdued">
          Last sent {formatRelativeTime(lastSent.sentAt)}
        </Text>
      )}
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="send-winback" />
        <input type="hidden" name="shopInstallationId" value={shopInstallationId} />
        <Button submit size="slim" loading={fetcher.state !== "idle"}>
          {lastSent ? "Send again" : "Send win-back"}
        </Button>
      </fetcher.Form>
    </BlockStack>
  );
}
