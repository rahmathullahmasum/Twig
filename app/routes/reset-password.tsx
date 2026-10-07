import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { AppProvider, Page, Card, BlockStack, FormLayout, Button, Banner } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { createUserSession, isResetTokenValid, resetPasswordWithToken } from "../lib/auth/session.server";
import { PasswordField } from "../components/PasswordField";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const token = new URL(request.url).searchParams.get("token") || "";
  const valid = await isResetTokenValid(token);
  return { token, valid };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const token = String(formData.get("token") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation don't match." };
  }

  const userId = await resetPasswordWithToken(token, newPassword);
  if (!userId) {
    return { ok: false, message: "This reset link is invalid or has expired. Request a new one." };
  }
  return createUserSession(userId, "/dashboard");
};

export default function ResetPassword() {
  const { token, valid } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page narrowWidth title="Reset password">
        <Card>
          <BlockStack gap="300">
            {actionData?.message && <Banner tone="critical">{actionData.message}</Banner>}
            {!valid ? (
              <Banner tone="critical">This reset link is invalid or has expired. Request a new one from the login page.</Banner>
            ) : (
              <form method="post">
                <input type="hidden" name="token" value={token} />
                <FormLayout>
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
                    Set new password
                  </Button>
                </FormLayout>
              </form>
            )}
          </BlockStack>
        </Card>
      </Page>
    </AppProvider>
  );
}
