import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { useState } from "react";
import { createUserSession, isResetTokenValid, resetPasswordWithToken } from "../lib/auth/session.server";
import { Button, PasswordField, BrandMark } from "../components/ui";

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
    <div className="login-wrap">
      <div className="card login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <BrandMark />
          <span className="brand-name">Growth Portfolio</span>
        </div>
        <h1 className="h1" style={{ fontSize: 20 }}>
          Reset password
        </h1>
        {actionData?.message && (
          <p className="msg-err" style={{ background: "var(--color-critical-bg)", padding: "9px 11px", borderRadius: 7, marginTop: 16 }}>
            {actionData.message}
          </p>
        )}
        {!valid ? (
          <p className="msg-err" style={{ background: "var(--color-critical-bg)", padding: "9px 11px", borderRadius: 7, marginTop: 16 }}>
            This reset link is invalid or has expired. Request a new one from the login page.
          </p>
        ) : (
          <form method="post" style={{ marginTop: 20 }}>
            <input type="hidden" name="token" value={token} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PasswordField
                id="rp-new"
                label="New password"
                name="newPassword"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                helpText="At least 8 characters."
              />
              <PasswordField
                id="rp-confirm"
                label="Confirm new password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
              <Button type="submit" variant="primary" block>
                Set new password
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
