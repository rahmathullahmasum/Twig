import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createCookieSessionStorage, redirect } from "react-router";
import db from "../../db.server";
import { hashPassword, verifyPasswordHash } from "./password.server";

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Internal company tool -- signup is self-service but gated to this domain
// so it isn't an open registration page. Leave ALLOWED_EMAIL_DOMAIN unset to
// allow any domain.
function isAllowedEmailDomain(email: string): boolean {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (!domain) return true;
  return email.endsWith(`@${domain.toLowerCase()}`);
}

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

export async function registerUser(
  emailInput: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const email = normalizeEmail(emailInput);
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isAllowedEmailDomain(email)) {
    return { ok: false, error: `Only @${process.env.ALLOWED_EMAIL_DOMAIN} emails can register.` };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const user = await db.user.create({ data: { email, passwordHash: hashPassword(password) } });
  return { ok: true, userId: user.id };
}

export async function verifyUserCredentials(emailInput: string, password: string): Promise<string | null> {
  if (!password) return null;
  const email = normalizeEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;
  return verifyPasswordHash(password, user.passwordHash) ? user.id : null;
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !verifyPasswordHash(currentPassword, user.passwordHash)) return false;
  await db.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPassword) } });
  return true;
}

// Returns the raw token to embed in the emailed reset link -- only its
// sha256 hash is persisted. Returns null if no account matches (caller
// should still show a generic "check your email" message either way, to
// avoid leaking which emails are registered).
export async function createPasswordResetToken(emailInput: string): Promise<string | null> {
  const email = normalizeEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: { resetTokenHash: sha256(token), resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });
  return token;
}

async function findUserByResetToken(token: string) {
  if (!token) return null;
  const hash = sha256(token);
  // sha256 output is fixed-length hex, so a direct equality lookup is safe
  // (no length-based timing signal to worry about here).
  const user = await db.user.findFirst({ where: { resetTokenHash: hash } });
  if (!user?.resetTokenHash || !user.resetTokenExpiresAt) return null;
  if (user.resetTokenExpiresAt.getTime() < Date.now()) return null;

  const a = Buffer.from(hash);
  const b = Buffer.from(user.resetTokenHash);
  return a.length === b.length && timingSafeEqual(a, b) ? user : null;
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return (await findUserByResetToken(token)) !== null;
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<string | null> {
  const user = await findUserByResetToken(token);
  if (!user) return null;
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), resetTokenHash: null, resetTokenExpiresAt: null },
  });
  return user.id;
}

export async function createUserSession(userId: string, redirectTo: string): Promise<Response> {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return session.get("userId") ?? null;
}

export async function requireAuth(request: Request): Promise<string> {
  const userId = await getUserId(request);
  if (!userId) throw redirect("/login");
  return userId;
}

// For loaders that need to show who's logged in (the sidebar's account
// footer) -- one extra query over requireAuth, so only call it where that's
// actually displayed, not from every action.
export async function requireUser(request: Request): Promise<{ id: string; email: string }> {
  const userId = await requireAuth(request);
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw redirect("/login");
  return { id: userId, email: user.email };
}

export async function destroySession(request: Request): Promise<Response> {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
