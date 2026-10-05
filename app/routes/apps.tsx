import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import {
  AppProvider,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Button,
  TextField,
  FormLayout,
  DataTable,
  Badge,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { requireAuth } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import db from "../db.server";
import { syncTrackedApp } from "../lib/sync/syncApp.server";
import { syncTrackedAppTransactions } from "../lib/sync/syncTransactions.server";
import { syncTrackedAppSubscriptions } from "../lib/sync/syncSubscriptions.server";
import { computeAppMetricsForToday } from "../lib/sync/metricsRollup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth(request);

  const apps = await db.trackedApp.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { installations: { where: { isActive: true } } } },
      syncCursor: true,
    },
  });

  return { apps };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add") {
    const partnerGid = String(formData.get("partnerGid") || "").trim();
    const name = String(formData.get("name") || "").trim();
    if (!partnerGid || !name) {
      return { ok: false, message: "Both fields are required." };
    }
    const normalizedGid = partnerGid.startsWith("gid://")
      ? partnerGid
      : `gid://partners/App/${partnerGid.replace(/\D/g, "")}`;

    const existing = await db.trackedApp.findUnique({ where: { partnerGid: normalizedGid } });
    if (existing) {
      return { ok: false, message: "This app is already being tracked." };
    }

    const trackedApp = await db.trackedApp.create({ data: { partnerGid: normalizedGid, name } });

    try {
      await syncTrackedApp(trackedApp.id);
      await syncTrackedAppTransactions(trackedApp.id);
      await syncTrackedAppSubscriptions(trackedApp.id);
      await computeAppMetricsForToday(trackedApp.id);
      return { ok: true, message: `Added "${name}" and ran the first sync.` };
    } catch (error) {
      return {
        ok: true,
        message: `Added "${name}", but the first sync failed: ${
          error instanceof Error ? error.message : String(error)
        }. It'll retry on the next scheduled sync, or click "Sync now".`,
      };
    }
  }

  if (intent === "sync") {
    const id = String(formData.get("id"));
    try {
      const result = await syncTrackedApp(id);
      const txnResult = await syncTrackedAppTransactions(id);
      const subResult = await syncTrackedAppSubscriptions(id);
      await computeAppMetricsForToday(id);
      return {
        ok: true,
        message: `Synced: ${result.processed} event(s), ${txnResult.processed} transaction(s), ${subResult.checked} subscription(s) checked.`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  return { ok: false, message: "Unknown action" };
};

export default function Apps() {
  const { apps } = useLoaderData<typeof loader>();
  const addFetcher = useFetcher<typeof action>();
  const [partnerGid, setPartnerGid] = useState("");
  const [name, setName] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <AppLayout title="Apps" subtitle="Track every Shopify app you've built in one place" apps={apps}>
        <Layout>
          {addFetcher.data?.message && (
            <Layout.Section>
              <Banner tone={addFetcher.data.ok ? "success" : "warning"}>{addFetcher.data.message}</Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Track a new app
                </Text>
                <Text as="p" tone="subdued">
                  Open the app in the Partner Dashboard, copy the number from its URL
                  (partners.shopify.com/&lt;org&gt;/apps/<strong>this number</strong>/...).
                </Text>
                <addFetcher.Form method="post">
                  <input type="hidden" name="intent" value="add" />
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        label="App ID (number, or full gid://... )"
                        name="partnerGid"
                        value={partnerGid}
                        onChange={setPartnerGid}
                        autoComplete="off"
                      />
                      <TextField label="Display name" name="name" value={name} onChange={setName} autoComplete="off" />
                    </FormLayout.Group>
                    <Button submit loading={addFetcher.state !== "idle"}>
                      Add &amp; sync
                    </Button>
                  </FormLayout>
                </addFetcher.Form>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              {apps.length === 0 ? (
                <Text as="p" tone="subdued">
                  No apps tracked yet. Add one above to get started.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "numeric", "text", "text"]}
                  headings={["App", "Active installs", "Last synced", ""]}
                  rows={apps.map((app) => [
                    <Link key={app.id} to={`/apps/${app.id}`}>
                      {app.name}
                    </Link>,
                    <Badge key={app.id} tone="success">
                      {String(app._count.installations)}
                    </Badge>,
                    formatRelativeTime(app.syncCursor?.lastOccurredAt),
                    <SyncButton key={app.id} id={app.id} />,
                  ])}
                />
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </AppLayout>
    </AppProvider>
  );
}

function SyncButton({ id }: { id: string }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="sync" />
      <input type="hidden" name="id" value={id} />
      <InlineStack gap="200">
        <Button submit size="slim" loading={fetcher.state !== "idle"}>
          Sync now
        </Button>
      </InlineStack>
    </fetcher.Form>
  );
}
