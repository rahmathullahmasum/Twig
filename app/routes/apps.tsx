import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { requireUser } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { Badge, Button, AppBadge } from "../components/ui";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import db from "../db.server";
import { syncTrackedApp } from "../lib/sync/syncApp.server";
import { syncTrackedAppTransactions } from "../lib/sync/syncTransactions.server";
import { syncTrackedAppSubscriptions } from "../lib/sync/syncSubscriptions.server";
import { computeAppMetricsForToday } from "../lib/sync/metricsRollup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  const apps = await db.trackedApp.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { installations: { where: { isActive: true } } } },
      syncCursor: true,
    },
  });

  return { apps, email: user.email };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add") {
    const partnerGid = String(formData.get("partnerGid") || "").trim();
    const name = String(formData.get("name") || "").trim();
    if (!partnerGid || !name) {
      return { ok: false, message: "Both fields are required." };
    }
    const normalizedGid = partnerGid.startsWith("gid://")
      ? partnerGid
      : `gid://partners/App/${partnerGid.replace(/\D/g, "")}`;

    const existing = await db.trackedApp.findUnique({ where: { partnerGid: normalizedGid } });
    if (existing) {
      return { ok: false, message: "This app is already being tracked." };
    }

    const trackedApp = await db.trackedApp.create({ data: { partnerGid: normalizedGid, name } });

    try {
      await syncTrackedApp(trackedApp.id);
      await syncTrackedAppTransactions(trackedApp.id);
      await syncTrackedAppSubscriptions(trackedApp.id);
      await computeAppMetricsForToday(trackedApp.id);
      return { ok: true, message: `Added "${name}" and ran the first sync.` };
    } catch (error) {
      return {
        ok: true,
        message: `Added "${name}", but the first sync failed: ${
          error instanceof Error ? error.message : String(error)
        }. It'll retry on the next scheduled sync, or use "Sync all apps now" in Settings.`,
      };
    }
  }

  if (intent === "rename") {
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { ok: false, message: "Name can't be empty." };
    }
    const app = await db.trackedApp.update({ where: { id }, data: { name } });
    return { ok: true, message: `Renamed to "${app.name}".` };
  }

  if (intent === "delete") {
    const id = String(formData.get("id") || "");
    const app = await db.trackedApp.delete({ where: { id } });
    return { ok: true, message: `Deleted "${app.name}" and all its data.` };
  }

  return { ok: false, message: "Unknown action" };
};

export default function Apps() {
  const { apps, email } = useLoaderData<typeof loader>();
  const addFetcher = useFetcher<typeof action>();
  const [partnerGid, setPartnerGid] = useState("");
  const [name, setName] = useState("");

  return (
    <AppLayout apps={apps} userEmail={email}>
      <header className="page-head">
        <div>
          <h1 className="h1">Apps</h1>
          <p className="sub">Track every Shopify app you&apos;ve built in one place.</p>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Track a new app</h2>
            <p className="card-meta">
              Open the app in the Partner Dashboard, copy the number from its URL
              (partners.shopify.com/&lt;org&gt;/apps/<strong>this number</strong>/...).
            </p>
          </div>
        </div>
        <div className="card-body">
          <addFetcher.Form method="post">
            <input type="hidden" name="intent" value="add" />
            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="na-gid">
                  App ID (number, or full gid://... )
                </label>
                <input
                  id="na-gid"
                  className="input"
                  value={partnerGid}
                  onChange={(e) => setPartnerGid(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="na-name">
                  Display name
                </label>
                <input
                  id="na-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="primary" disabled={addFetcher.state !== "idle"}>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add &amp; sync
              </Button>
            </div>
          </addFetcher.Form>
          {addFetcher.data?.message && (
            <p className={addFetcher.data.ok ? "msg-ok" : "msg-err"} style={{ marginTop: 12 }}>
              {addFetcher.data.message}
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}>
          <div>
            <h2 className="card-title">Tracked apps</h2>
            <p className="card-meta">Select an app to see its shops, uninstall reasons and revenue.</p>
          </div>
        </div>
        {apps.length === 0 ? (
          <div className="empty">No apps tracked yet. Add one above to get started.</div>
        ) : (
          <div className="tscroll">
            <div className="thead g-apps">
              <span>App</span>
              <span>Active installs</span>
              <span>Last synced</span>
              <span className="t-right">Actions</span>
            </div>
            {apps.map((app) => (
              <AppRow
                key={app.id}
                id={app.id}
                name={app.name}
                installs={app._count.installations}
                synced={formatRelativeTime(app.syncCursor?.lastOccurredAt)}
              />
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function AppRow({ id, name, installs, synced }: { id: string; name: string; installs: number; synced: string }) {
  const fetcher = useFetcher<typeof action>();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="trow g-apps">
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <fetcher.Form method="post" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="id" value={id} />
            <label htmlFor={`rename-${id}`} style={{ position: "absolute", left: -9999 }}>
              Rename app
            </label>
            <input
              id={`rename-${id}`}
              className="input"
              style={{ height: 32, maxWidth: 240 }}
              name="name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button type="submit" variant="primary" size="sm" disabled={fetcher.state !== "idle"}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </fetcher.Form>
        ) : (
          <Link to={`/apps/${id}`} className="link-btn">
            <AppBadge name={name} />
            <span className="app-name truncate" style={{ display: "block" }}>
              {name}
            </span>
          </Link>
        )}
        {fetcher.data?.ok === false && <p className="msg-err" style={{ marginTop: 6 }}>{fetcher.data.message}</p>}
      </div>
      <div>
        <Badge tone="neutral">{String(installs)}</Badge>
      </div>
      <div className="muted">{synced}</div>
      <div className="row-actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          Rename
        </Button>
        <fetcher.Form
          method="post"
          onSubmit={(event) => {
            if (!confirm(`Delete "${name}" and all its tracked data (shops, events, revenue)? This can't be undone.`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="danger" size="sm" disabled={fetcher.state !== "idle"}>
            Delete
          </Button>
        </fetcher.Form>
      </div>
    </div>
  );
}
