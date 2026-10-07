import type { ActionFunctionArgs } from "react-router";
import { Form, useActionData } from "react-router";
import { AppProvider, Page, Card, Text, BlockStack, FormLayout, TextField, Button, Banner } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { createPasswordResetToken } from "../lib/auth/session.server";
import { getEmailProvider } from "../lib/email/provider.server";

const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();

  const token = await createPasswordResetToken(email);
  // Always the same response whether or not the account exists, so this
  // can't be used to find out which emails are registered.
  if (!token) {
    return { ok: true, message: GENERIC_MESSAGE };
  }

  const resetUrl = new URL("/reset-password", request.url);
  resetUrl.searchParams.set("token", token);

  await getEmailProvider().send({
    to: email,
    subject: "Reset your App Portfolio Dashboard password",
    html: `
      <p>Someone requested a password reset for your App Portfolio Dashboard account.</p>
      <p><a href="${resetUrl.toString()}">Click here to set a new password</a> (expires in 15 minutes).</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `,
  });

  return { ok: true, message: GENERIC_MESSAGE };
};

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();
  const [email, setEmail] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page narrowWidth title="Forgot password">
        <Card>
          <BlockStack gap="300">
            {actionData?.message && <Banner tone="success">{actionData.message}</Banner>}
            {!actionData?.ok && (
              <>
                <Text as="p" tone="subdued">
                  Enter your account email and we&apos;ll send a one-time reset link to it.
                </Text>
                <Form method="post">
                  <FormLayout>
                    <TextField
                      label="Email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      autoComplete="email"
                    />
                    <Button submit variant="primary">
                      Send reset link
                    </Button>
                  </FormLayout>
                </Form>
              </>
            )}
          </BlockStack>
        </Card>
      </Page>
    </AppProvider>
  );
}
