import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPasswordHash(plain: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const derivedBuf = Buffer.from(derived, "hex");
  const candidate = scryptSync(plain, salt, KEY_LENGTH);
  if (candidate.length !== derivedBuf.length) return false;
  return timingSafeEqual(candidate, derivedBuf);
}
