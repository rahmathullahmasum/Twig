import type { ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { AppProvider, Page, Card, FormLayout, TextField, Button, Banner, Text } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { createUserSession, registerUser } from "../lib/auth/session.server";
import { PasswordField } from "../components/PasswordField";

export const loader = async () => {
  return { allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN || null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    return { error: "Password and confirmation don't match." };
  }

  const result = await registerUser(email, password);
  if (!result.ok) {
    return { error: result.error };
  }
  return createUserSession(result.userId, "/dashboard");
};

export default function Register() {
  const { allowedDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page narrowWidth title="Create an account">
        <Card>
          <FormLayout>
            {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}
            <Form method="post">
              <FormLayout>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  helpText={allowedDomain ? `Must be an @${allowedDomain} email.` : undefined}
                />
                <PasswordField
                  label="Password"
                  name="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  helpText="At least 8 characters."
                />
                <PasswordField
                  label="Confirm password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                />
                <Button submit variant="primary">
                  Create account
                </Button>
                <Text as="p">
                  Already have an account? <Link to="/login">Log in</Link>
                </Text>
              </FormLayout>
            </Form>
          </FormLayout>
        </Card>
      </Page>
    </AppProvider>
  );
}
