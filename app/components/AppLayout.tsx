import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigation } from "react-router";
import { Avatar, AppBadge, BrandMark } from "./ui";

interface TrackedAppSummary {
  id: string;
  name: string;
}

interface AppLayoutProps {
  apps?: TrackedAppSummary[];
  userEmail?: string;
  children: ReactNode;
}

export function AppLayout({ apps = [], userEmail, children }: AppLayoutProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  const isOverview = location.pathname === "/dashboard";
  const isApps = location.pathname === "/apps";
  const isUsers = location.pathname === "/users" || location.pathname.startsWith("/users/");
  const isSettings = location.pathname === "/settings";

  return (
    <div className="shell">
      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 100,
            background: "var(--color-primary)",
            transformOrigin: "left",
            animation: "progress-anim 1.1s ease-in-out infinite",
          }}
        />
      )}
      <style>{`@keyframes progress-anim { 0% { transform: scaleX(0); opacity: 1; } 60% { transform: scaleX(0.75); } 100% { transform: scaleX(1); opacity: 0; } }`}</style>

      <div className={`backdrop${mobileNavOpen ? " open" : ""}`} onClick={() => setMobileNavOpen(false)} />

      <aside className={`sidebar${mobileNavOpen ? " open" : ""}`}>
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Growth Portfolio</div>
          </div>
        </div>

        <nav aria-label="Main">
          <p className="nav-label">Workspace</p>
          <div className="nav-group">
            <Link to="/dashboard" className={`nav-link${isOverview ? " is-active" : ""}`}>
              <OverviewIcon />
              <span>Portfolio Overview</span>
            </Link>
            <Link to="/apps" className={`nav-link${isApps ? " is-active" : ""}`}>
              <AppsIcon />
              <span>Apps</span>
              <span className="nav-count">{apps.length}</span>
            </Link>
            {apps.length > 0 && (
              <div className="nav-sub">
                {apps.map((a) => (
                  <Link
                    key={a.id}
                    to={`/apps/${a.id}`}
                    className={`nav-link nav-link-sub${location.pathname === `/apps/${a.id}` ? " is-active" : ""}`}
                  >
                    <AppBadge name={a.name} />
                    <span className="truncate">{a.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="side-spacer" />

        <nav aria-label="Account">
          <div className="nav-group">
            <Link to="/users" className={`nav-link${isUsers ? " is-active" : ""}`}>
              <UsersIcon />
              <span>Users</span>
            </Link>
            <Link to="/settings" className={`nav-link${isSettings ? " is-active" : ""}`}>
              <SettingsIcon />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        {userEmail && (
          <div className="side-foot">
            <Avatar name={userEmail} />
            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.3 }}>
                {userEmail}
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="main">
        <div style={{ padding: "0 0 8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm hamburger"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            Menu
          </button>
        </div>
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}

function OverviewIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function AppsIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17.5l9 5 9-5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.8c2 .7 3.2 2.5 3.6 5.2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}
