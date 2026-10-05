import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData } from "react-router";
import { AppProvider, Layout, Card, Text, BlockStack, FormLayout, TextField, Button, Banner } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { requireAuth, changePassword } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAuth(request);
  const formData = await request.formData();
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation don't match." };
  }

  const changed = await changePassword(currentPassword, newPassword);
  if (!changed) {
    return { ok: false, message: "Current password is incorrect." };
  }
  return { ok: true, message: "Password changed." };
};

export default function Settings() {
  const actionData = useActionData<typeof action>();
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
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Change password
                </Text>
                <Text as="p" tone="subdued">
                  This changes the single shared password used to log in to this dashboard.
                </Text>
                <Form method="post">
                  <FormLayout>
                    <TextField
                      label="Current password"
                      name="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      autoComplete="current-password"
                    />
                    <TextField
                      label="New password"
                      name="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={setNewPassword}
                      autoComplete="new-password"
                      helpText="At least 8 characters."
                    />
                    <TextField
                      label="Confirm new password"
                      name="confirmPassword"
                      type="password"
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
