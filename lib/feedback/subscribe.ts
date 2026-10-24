/**
 * Email sign-up (2026-10-24): double opt-in list for UAE job-search tips.
 * Pure parsing only; the route handler owns storage and sending.
 *
 * `CONSENT_TEXT_VERSION` is stored with every sign-up so a later wording
 * change does not retroactively claim consent to something the person did
 * not read. Bump it whenever the consent sentence on the form changes.
 */

export const CONSENT_TEXT_VERSION = "2026-10-24";

export const CONSENT_TEXT =
  "UAE job-search tips by email, about twice a month. Unsubscribe with one click, any time. " +
  "We never share your address.";

export const SUBSCRIBE_SOURCES = ["post_export", "post_checker", "blog", "thanks", "cover_letter"] as const;
export type SubscribeSource = (typeof SUBSCRIBE_SOURCES)[number];

// Deliberately simple: one @, no spaces, a dot in the domain. The confirm
// email is the real validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SubscribeRequest = { email: string; source: SubscribeSource };

export function parseSubscribe(raw: unknown): SubscribeRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const email = typeof r.email === "string" ? r.email.trim().toLowerCase().slice(0, 254) : "";
  if (!EMAIL_RE.test(email)) return null;
  const source = typeof r.source === "string" && (SUBSCRIBE_SOURCES as readonly string[]).includes(r.source)
    ? (r.source as SubscribeSource)
    : "blog";
  return { email, source };
}
