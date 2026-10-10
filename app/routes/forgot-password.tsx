import type { ActionFunctionArgs } from "react-router";
import { Form, useActionData } from "react-router";
import { useState } from "react";
import { createPasswordResetToken } from "../lib/auth/session.server";
import { getEmailProvider } from "../lib/email/provider.server";
import { Button, BrandMark } from "../components/ui";

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
    <div className="login-wrap">
      <div className="card login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <BrandMark />
          <span className="brand-name">Growth Portfolio</span>
        </div>
        <h1 className="h1" style={{ fontSize: 20 }}>
          Forgot password
        </h1>
        {actionData?.message && (
          <p className="msg-ok" style={{ background: "var(--color-success-bg)", padding: "9px 11px", borderRadius: 7, marginTop: 16 }}>
            {actionData.message}
          </p>
        )}
        {!actionData?.ok && (
          <>
            <p className="sub" style={{ marginTop: 10 }}>
              Enter your account email and we&apos;ll send a one-time reset link to it.
            </p>
            <Form method="post" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="field">
                  <label className="label" htmlFor="fp-email">
                    Email
                  </label>
                  <input
                    id="fp-email"
                    className="input"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="primary" block>
                  Send reset link
                </Button>
              </div>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}
