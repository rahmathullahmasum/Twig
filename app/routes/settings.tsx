import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useFetcher, useLoaderData } from "react-router";
import { AppProvider, Layout, Card, Text, BlockStack, FormLayout, Button, Banner } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { requireAuth, changeUserPassword } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { PasswordField } from "../components/PasswordField";
import db from "../db.server";
import { syncTrackedApp } from "../lib/sync/syncApp.server";
import { syncTrackedAppTransactions } from "../lib/sync/syncTransactions.server";
import { syncTrackedAppSubscriptions } from "../lib/sync/syncSubscriptions.server";
import { computeAppMetricsForToday } from "../lib/sync/metricsRollup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireAuth(request);
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return { email: user?.email ?? "" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync-all") {
    const apps = await db.trackedApp.findMany({ select: { id: true, name: true } });
    if (apps.length === 0) {
      return { ok: false, message: "No apps tracked yet -- add one from the Apps page first." };
    }

    const failures: string[] = [];
    for (const app of apps) {
      try {
        await syncTrackedApp(app.id);
        await syncTrackedAppTransactions(app.id);
        await syncTrackedAppSubscriptions(app.id);
        await computeAppMetricsForToday(app.id);
      } catch (error) {
        failures.push(`${app.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (failures.length === 0) {
      return { ok: true, message: `Synced all ${apps.length} app(s).` };
    }
    return {
      ok: false,
      message: `Synced ${apps.length - failures.length}/${apps.length} app(s). Failed: ${failures.join("; ")}`,
    };
  }

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation don't match." };
  }

  const changed = await changeUserPassword(userId, currentPassword, newPassword);
  if (!changed) {
    return { ok: false, message: "Current password is incorrect." };
  }
  return { ok: true, message: "Password changed." };
};

export default function Settings() {
  const { email } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const syncFetcher = useFetcher<typeof action>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <AppLayout title="Settings">
        <Layout>
          <Layout.Section>
            {actionData?.message && (
              <Banner tone={actionData.ok ? "success" : "critical"}>{actionData.message}</Banner>
            )}
            {syncFetcher.data?.message && (
              <Banner tone={syncFetcher.data.ok ? "success" : "critical"}>{syncFetcher.data.message}</Banner>
            )}
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Data sync
                </Text>
                <Text as="p" tone="subdued">
                  Pulls the latest installs, uninstalls, revenue, and subscription data for every
                  tracked app from the Partner API. Runs automatically every 15 minutes in the
                  background; use this to refresh on demand instead.
                </Text>
                <syncFetcher.Form method="post">
                  <input type="hidden" name="intent" value="sync-all" />
                  <Button submit loading={syncFetcher.state !== "idle"}>
                    Sync all apps now
                  </Button>
                </syncFetcher.Form>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Change password
                </Text>
                <Text as="p" tone="subdued">
                  Logged in as {email}.
                </Text>
                <Form method="post">
                  <FormLayout>
                    <PasswordField
                      label="Current password"
                      name="currentPassword"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      autoComplete="current-password"
                    />
                    <PasswordField
                      label="New password"
                      name="newPassword"
                      value={newPassword}
                      onChange={setNewPassword}
                      autoComplete="new-password"
                      helpText="At least 8 characters."
                    />
                    <PasswordField
                      label="Confirm new password"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                    />
                    <Button submit variant="primary">
                      Change password
                    </Button>
                  </FormLayout>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Account
                </Text>
                <Form method="post" action="/logout">
                  <Button submit tone="critical">
                    Log out
                  </Button>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </AppLayout>
    </AppProvider>
  );
}
