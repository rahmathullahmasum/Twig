import type { ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { useState } from "react";
import { createUserSession, registerUser } from "../lib/auth/session.server";
import { Button, PasswordField, BrandMark } from "../components/ui";

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
    <div className="login-wrap">
      <div className="card login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <BrandMark />
          <span className="brand-name">Growth Portfolio</span>
        </div>
        <h1 className="h1" style={{ fontSize: 20 }}>
          Create an account
        </h1>
        {actionData?.error && (
          <p className="msg-err" style={{ background: "var(--color-critical-bg)", padding: "9px 11px", borderRadius: 7, marginTop: 16 }}>
            {actionData.error}
          </p>
        )}
        <Form method="post" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label className="label" htmlFor="rg-email">
                Email
              </label>
              <input
                id="rg-email"
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {allowedDomain && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Must be an @{allowedDomain} email.
                </span>
              )}
            </div>
            <PasswordField
              id="rg-pw"
              label="Password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              helpText="At least 8 characters."
            />
            <PasswordField
              id="rg-pw-confirm"
              label="Confirm password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <Button type="submit" variant="primary" block>
              Create account
            </Button>
            <p className="meta" style={{ justifyContent: "center" }}>
              Already have an account? <Link to="/login" style={{ marginLeft: 4 }}>Log in</Link>
            </p>
          </div>
        </Form>
      </div>
    </div>
  );
}
