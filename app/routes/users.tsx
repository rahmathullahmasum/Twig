import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { requireUser } from "../lib/auth/session.server";
import { AppLayout } from "../components/AppLayout";
import { Badge, Avatar, LinkButton } from "../components/ui";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import db from "../db.server";

const GRID = { display: "grid", gridTemplateColumns: "minmax(220px, 1.4fr) 180px", alignItems: "center", columnGap: 14 } as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  const [users, apps] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, createdAt: true } }),
    db.trackedApp.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  return { users, currentUserId: user.id, email: user.email, apps };
};

export default function Users() {
  const { users, currentUserId, email, apps } = useLoaderData<typeof loader>();

  return (
    <AppLayout apps={apps} userEmail={email}>
      <header className="page-head">
        <div>
          <h1 className="h1">Users</h1>
          <p className="sub">Everyone with access to this dashboard.</p>
        </div>
        <LinkButton to="/register" variant="secondary">
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          New account
        </LinkButton>
      </header>

      <section className="card">
        <div className="tscroll" style={{ borderRadius: 10 }}>
          <div className="thead" style={{ ...GRID, borderTop: 0 }}>
            <span>Email</span>
            <span>Joined</span>
          </div>
          {users.map((u) => (
            <div key={u.id} className="trow" style={GRID}>
              <div className="cell-shop">
                <Avatar name={u.email} />
                <Link to={`/users/${u.id}`} style={{ fontWeight: 500 }}>
                  {u.email}
                </Link>
                {u.id === currentUserId && <Badge tone="brand">You</Badge>}
              </div>
              <span className="muted">{formatRelativeTime(u.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
