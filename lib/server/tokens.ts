import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * One-time tokens for the feedback routes (rating follow-up, email confirm).
 * The raw token travels in a URL or JSON response; only its SHA-256 is
 * stored, so a database read-out cannot be replayed.
 */

export const newToken = (): string => randomBytes(24).toString("base64url");

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const tokenMatches = (token: string, storedHash: string | null | undefined): boolean => {
  if (!storedHash) return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
};
