import type { LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import { requireUser } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { Badge, Avatar } from "../components/ui";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const currentUser = await requireUser(request);
  const [user, apps] = await Promise.all([
    db.user.findUnique({ where: { id: params.id }, select: { id: true, email: true, createdAt: true, updatedAt: true } }),
    db.trackedApp.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!user) {
    throw data("User not found", { status: 404 });
  }
  return { user, isYou: user.id === currentUser.id, email: currentUser.email, apps };
};

export default function UserInfo() {
  const { user, isYou, email, apps } = useLoaderData<typeof loader>();

  return (
    <AppLayout apps={apps} userEmail={email}>
      <header className="page-head">
        <div>
          <h1 className="h1">{user.email}</h1>
          <p className="sub">Account details</p>
        </div>
      </header>

      <section className="card">
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={user.email} size={36} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="card-title">{user.email}</h2>
              {isYou && <Badge tone="brand">You</Badge>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted">Joined {formatRelativeTime(user.createdAt)}</span>
            <span className="muted">Password last changed {formatRelativeTime(user.updatedAt)}</span>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
