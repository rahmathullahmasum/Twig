import type { ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData } from "react-router";
import { AppProvider, Page, Card, FormLayout, TextField, Button, Banner, InlineStack, Text } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { createUserSession, verifyUserCredentials } from "../lib/auth/session.server";
import { PasswordField } from "../components/PasswordField";

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const userId = await verifyUserCredentials(email, password);
  if (!userId) {
    return { error: "Incorrect email or password." };
  }
  return createUserSession(userId, "/dashboard");
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page narrowWidth title="App Portfolio Dashboard">
        <Card>
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
              />
              <PasswordField
                label="Password"
                name="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <Button submit variant="primary">
                Log in
              </Button>
              <InlineStack align="space-between">
                <Link to="/forgot-password">Forgot password?</Link>
                <Text as="span">
                  No account? <Link to="/register">Register</Link>
                </Text>
              </InlineStack>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
