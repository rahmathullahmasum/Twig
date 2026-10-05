import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigation } from "react-router";
import { Page, BlockStack } from "@shopify/polaris";

interface TrackedAppSummary {
  id: string;
  name: string;
}

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  apps?: TrackedAppSummary[];
  children: ReactNode;
}

const SIDEBAR_WIDTH = 260;

export function AppLayout({ title, subtitle, primaryAction, apps = [], children }: AppLayoutProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer automatically whenever a navigation completes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--p-color-bg)" }}>
      <style>{`
        .portfolio-progress {
          position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 100;
          background: var(--p-color-bg-fill-emphasis);
          transform-origin: left;
          animation: portfolio-progress-anim 1.1s ease-in-out infinite;
        }
        @keyframes portfolio-progress-anim {
          0% { transform: scaleX(0); opacity: 1; }
          60% { transform: scaleX(0.75); }
          100% { transform: scaleX(1); opacity: 0; }
        }
        .portfolio-hamburger { display: none; }
        .portfolio-backdrop { display: none; }
        @media (max-width: 768px) {
          .portfolio-sidebar {
            position: fixed; left: 0; top: 0; z-index: 60;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
          }
          .portfolio-sidebar.open { transform: translateX(0); }
          .portfolio-hamburger { display: inline-flex !important; }
          .portfolio-backdrop.open {
            display: block; position: fixed; inset: 0; z-index: 55;
            background: rgba(0,0,0,0.35);
          }
        }

        .portfolio-navlink {
          display: flex;
          align-items: center;
          padding: 9px 12px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          color: var(--p-color-text);
          background: var(--p-color-bg-surface-secondary);
          border: 1px solid var(--p-color-border);
          transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .portfolio-navlink:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: rgba(99, 102, 241, 0.35);
          color: #4338ca;
        }
        .portfolio-navlink.active {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: transparent;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
        }
        .portfolio-navlink.compact {
          padding: 6px 12px;
          font-size: 13px;
        }
      `}</style>

      {isLoading && <div className="portfolio-progress" />}

      <div className={`portfolio-backdrop${mobileNavOpen ? " open" : ""}`} onClick={() => setMobileNavOpen(false)} />

      <div
        className={`portfolio-sidebar${mobileNavOpen ? " open" : ""}`}
        style={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--p-color-border)",
          background: "var(--p-color-bg-surface)",
          padding: "20px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <BlockStack gap="600">
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingInlineStart: 4 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                flexShrink: 0,
                background: "linear-gradient(135deg, #22d3ee, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              G
            </div>
            <span style={{ color: "var(--p-color-text)", fontWeight: 700, fontSize: 16 }}>Growth Portfolio</span>
          </div>

          <BlockStack gap="100">
            <SidebarLink to="/dashboard" active={location.pathname === "/dashboard"} icon={<DashboardIcon />}>
              Portfolio Overview
            </SidebarLink>
            <SidebarLink to="/apps" active={location.pathname === "/apps"} icon={<AppsIcon />}>
              Apps
            </SidebarLink>
          </BlockStack>

          {apps.length > 0 && (
            <BlockStack gap="100">
              <span
                style={{
                  paddingInlineStart: 12,
                  color: "var(--p-color-text-secondary)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                TRACKED APPS
              </span>
              {apps.map((a) => (
                <SidebarLink
                  key={a.id}
                  to={`/apps/${a.id}`}
                  active={location.pathname === `/apps/${a.id}`}
                  icon={<AppBadge name={a.name} />}
                >
                  {a.name}
                </SidebarLink>
              ))}
            </BlockStack>
          )}
        </BlockStack>

        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid var(--p-color-border)" }}>
          <SidebarLink to="/settings" active={location.pathname === "/settings"} icon={<SettingsIcon />}>
            Settings
          </SidebarLink>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "12px 20px 0" }}>
          <button
            type="button"
            className="portfolio-hamburger"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label="Toggle navigation"
            style={{
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--p-color-border)",
              borderRadius: 8,
              background: "var(--p-color-bg-surface)",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            <span aria-hidden style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
              <span style={{ width: 16, height: 2, background: "var(--p-color-text)", display: "block" }} />
              <span style={{ width: 16, height: 2, background: "var(--p-color-text)", display: "block" }} />
              <span style={{ width: 16, height: 2, background: "var(--p-color-text)", display: "block" }} />
            </span>
            <span style={{ marginLeft: 8 }}>Menu</span>
          </button>
        </div>
        <Page title={title} subtitle={subtitle} primaryAction={primaryAction} fullWidth>
          {children}
        </Page>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  active,
  compact,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  compact?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`portfolio-navlink${active ? " active" : ""}${compact ? " compact" : ""}`}>
      {icon && (
        <span style={{ display: "inline-flex", flexShrink: 0, marginRight: 10 }}>{icon}</span>
      )}
      {children}
    </Link>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="11" width="3.5" height="6" rx="1" fill="currentColor" />
      <rect x="8.25" y="7" width="3.5" height="10" rx="1" fill="currentColor" />
      <rect x="13.5" y="3" width="3.5" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function AppsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="3" width="6" height="6" rx="1.3" fill="currentColor" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" fill="currentColor" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" fill="currentColor" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16.17 12.5a1.37 1.37 0 00.27 1.51l.05.05a1.65 1.65 0 11-2.34 2.34l-.05-.05a1.37 1.37 0 00-1.51-.27 1.37 1.37 0 00-.83 1.26v.14a1.65 1.65 0 11-3.3 0v-.07a1.37 1.37 0 00-.9-1.26 1.37 1.37 0 00-1.51.27l-.05.05a1.65 1.65 0 11-2.34-2.34l.05-.05a1.37 1.37 0 00.27-1.51 1.37 1.37 0 00-1.26-.83h-.14a1.65 1.65 0 110-3.3h.07a1.37 1.37 0 001.26-.9 1.37 1.37 0 00-.27-1.51l-.05-.05A1.65 1.65 0 114.9 3.57l.05.05a1.37 1.37 0 001.51.27h.07a1.37 1.37 0 00.83-1.26v-.14a1.65 1.65 0 113.3 0v.07a1.37 1.37 0 00.83 1.26 1.37 1.37 0 001.51-.27l.05-.05a1.65 1.65 0 112.34 2.34l-.05.05a1.37 1.37 0 00-.27 1.51v.07a1.37 1.37 0 001.26.83h.14a1.65 1.65 0 110 3.3h-.07a1.37 1.37 0 00-1.26.83z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const BADGE_COLORS = [
  ["#6366f1", "#8b5cf6"],
  ["#06b6d4", "#3b82f6"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#06b6d4"],
  ["#ec4899", "#f43f5e"],
  ["#8b5cf6", "#d946ef"],
] as const;

function AppBadge({ name }: { name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const [from, to] = BADGE_COLORS[hash % BADGE_COLORS.length];
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        color: "#ffffff",
        fontSize: 11,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initial}
    </span>
  );
}
