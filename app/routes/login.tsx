import type { ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData } from "react-router";
import { useState } from "react";
import { createUserSession, verifyUserCredentials } from "../lib/auth/session.server";
import { Button, PasswordField, BrandMark } from "../components/ui";

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
    <div className="login-wrap">
      <div className="card login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <BrandMark />
          <span className="brand-name">Growth Portfolio</span>
        </div>
        <h1 className="h1" style={{ fontSize: 20 }}>
          Sign in
        </h1>
        {actionData?.error && (
          <p className="msg-err" style={{ background: "var(--color-critical-bg)", padding: "9px 11px", borderRadius: 7, marginTop: 16 }}>
            {actionData.error}
          </p>
        )}
        <Form method="post" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label className="label" htmlFor="lg-email">
                Email
              </label>
              <input
                id="lg-email"
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PasswordField
              id="lg-pw"
              label="Password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <Button type="submit" variant="primary" block>
              Log in
            </Button>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <Link to="/forgot-password">Forgot password?</Link>
              <span>
                No account? <Link to="/register">Register</Link>
              </span>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
