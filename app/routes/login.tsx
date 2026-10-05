import type { ActionFunctionArgs } from "react-router";
import { Form, useActionData } from "react-router";
import { AppProvider, Page, Card, FormLayout, TextField, Button, Banner } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { createUserSession, verifyPassword } from "../lib/auth/session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");

  if (!(await verifyPassword(password))) {
    return { error: "Incorrect password." };
  }
  return createUserSession("/dashboard");
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [password, setPassword] = useState("");

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page narrowWidth title="App Portfolio Dashboard">
        <Card>
          {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}
          <Form method="post">
            <FormLayout>
              <TextField
                label="Password"
                name="password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <Button submit variant="primary">
                Log in
              </Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
