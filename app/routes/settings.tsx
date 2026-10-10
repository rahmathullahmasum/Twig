import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useFetcher, useLoaderData } from "react-router";
import { useState } from "react";
import { requireAuth, requireUser, changeUserPassword } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { Button, PasswordField } from "../components/ui";
import db from "../db.server";
import { syncTrackedApp } from "../lib/sync/syncApp.server";
import { syncTrackedAppTransactions } from "../lib/sync/syncTransactions.server";
import { syncTrackedAppSubscriptions } from "../lib/sync/syncSubscriptions.server";
import { computeAppMetricsForToday } from "../lib/sync/metricsRollup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  const apps = await db.trackedApp.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  return { email: user.email, apps };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync-all") {
    const apps = await db.trackedApp.findMany({ select: { id: true, name: true } });
    if (apps.length === 0) {
      return { ok: false, message: "No apps tracked yet -- add one from the Apps page first." };
    }

    const failures: string[] = [];
    for (const app of apps) {
      try {
        await syncTrackedApp(app.id);
        await syncTrackedAppTransactions(app.id);
        await syncTrackedAppSubscriptions(app.id);
        await computeAppMetricsForToday(app.id);
      } catch (error) {
        failures.push(`${app.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (failures.length === 0) {
      return { ok: true, message: `Synced all ${apps.length} app(s).` };
    }
    return {
      ok: false,
      message: `Synced ${apps.length - failures.length}/${apps.length} app(s). Failed: ${failures.join("; ")}`,
    };
  }

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation don't match." };
  }

  const changed = await changeUserPassword(userId, currentPassword, newPassword);
  if (!changed) {
    return { ok: false, message: "Current password is incorrect." };
  }
  return { ok: true, message: "Password changed." };
};

export default function Settings() {
  const { email, apps } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const syncFetcher = useFetcher<typeof action>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <AppLayout apps={apps} userEmail={email}>
      <header className="page-head">
        <div>
          <h1 className="h1">Settings</h1>
          <p className="sub">Workspace data sync and your account.</p>
        </div>
      </header>

      <div className="settings-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Data sync</h2>
                <p className="card-meta">
                  Pulls the latest installs, uninstalls, revenue, and subscription data for every
                  tracked app from the Partner API. Runs automatically every 15 minutes in the
                  background; use this to refresh on demand instead.
                </p>
              </div>
            </div>
            <div className="card-body" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <syncFetcher.Form method="post">
                <input type="hidden" name="intent" value="sync-all" />
                <Button type="submit" variant="primary" disabled={syncFetcher.state !== "idle"}>
                  {syncFetcher.state !== "idle" ? "Syncing…" : "Sync all apps now"}
                </Button>
              </syncFetcher.Form>
              {syncFetcher.data?.message && (
                <span className={syncFetcher.data.ok ? "msg-ok" : "msg-err"}>{syncFetcher.data.message}</span>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Session</h2>
                <p className="card-meta">Signed in as {email}</p>
              </div>
            </div>
            <div className="card-body">
              <Form method="post" action="/logout">
                <Button type="submit" variant="secondary">
                  Log out
                </Button>
              </Form>
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Change password</h2>
              <p className="card-meta">At least 8 characters.</p>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {actionData?.message && (
              <span className={actionData.ok ? "msg-ok" : "msg-err"}>{actionData.message}</span>
            )}
            <Form method="post">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <PasswordField
                  id="pw-cur"
                  label="Current password"
                  name="currentPassword"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
                <PasswordField
                  id="pw-new"
                  label="New password"
                  name="newPassword"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  helpText="At least 8 characters."
                />
                <PasswordField
                  id="pw-conf"
                  label="Confirm new password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                />
                <div>
                  <Button type="submit" variant="primary">
                    Update password
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
