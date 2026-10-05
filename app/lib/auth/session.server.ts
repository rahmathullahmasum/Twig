import { createCookieSessionStorage, redirect } from "react-router";
import db from "../../db.server";
import { hashPassword, verifyPasswordHash } from "./password.server";

const SETTINGS_ID = "singleton";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__portfolio_session",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET || "dev-secret-change-me"],
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  },
});

// Bootstraps the DB-backed password from DASHBOARD_PASSWORD on first use, so
// existing deployments keep working with their current password until it's
// changed in the UI (at which point the env var stops mattering).
async function getOrCreatePasswordHash(): Promise<string> {
  const existing = await db.dashboardSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing.passwordHash;

  const envPassword = process.env.DASHBOARD_PASSWORD || "";
  const created = await db.dashboardSettings.create({
    data: { id: SETTINGS_ID, passwordHash: hashPassword(envPassword) },
  });
  return created.passwordHash;
}

export async function verifyPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const hash = await getOrCreatePasswordHash();
  return verifyPasswordHash(input, hash);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
  if (!(await verifyPassword(currentPassword))) return false;
  await db.dashboardSettings.update({
    where: { id: SETTINGS_ID },
    data: { passwordHash: hashPassword(newPassword) },
  });
  return true;
}

export async function createUserSession(redirectTo: string): Promise<Response> {
  const session = await sessionStorage.getSession();
  session.set("authed", true);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function isAuthed(request: Request): Promise<boolean> {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return session.get("authed") === true;
}

export async function requireAuth(request: Request): Promise<void> {
  if (!(await isAuthed(request))) {
    throw redirect("/login");
  }
}

export async function destroySession(request: Request): Promise<Response> {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
