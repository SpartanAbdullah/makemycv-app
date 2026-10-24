/**
 * Ratings (2026-10-24): one-tap stars after a success moment, with an
 * OPTIONAL follow-up line the user may let us quote. Pure parsers shared by
 * the route handler and the unit tests; no I/O here.
 *
 * Privacy: a star is anonymous (stars, surface, country, timestamp). A quote
 * becomes personal data only when the user adds a name — and it is shown on
 * makemycv.ae only if `quote_consent` is true AND a human has set
 * `approved_at` in the database. There is no automatic publication path.
 */

export const RATING_SURFACES = ["post_export", "post_checker", "cover_letter"] as const;
export type RatingSurface = (typeof RATING_SURFACES)[number];

export const RATING_LIMITS = {
  quote: 280,
  displayName: 40,
  displayRole: 60,
  /** How long after the star the follow-up line may still be attached. */
  quoteWindowMs: 24 * 60 * 60 * 1000,
} as const;

export type RatingSubmit = { stars: 1 | 2 | 3 | 4 | 5; surface: RatingSurface };
export type RatingQuote = {
  id: string;
  token: string;
  quote: string;
  quoteConsent: boolean;
  displayName: string;
  displayRole: string;
};

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRatingSubmit(raw: unknown): RatingSubmit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stars = Number(r.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  const surface = typeof r.surface === "string" ? r.surface : "";
  if (!(RATING_SURFACES as readonly string[]).includes(surface)) return null;
  return { stars: stars as RatingSubmit["stars"], surface: surface as RatingSurface };
}

export function parseRatingQuote(raw: unknown): RatingQuote | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && UUID_RE.test(r.id) ? r.id.toLowerCase() : "";
  const token = typeof r.token === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(r.token) ? r.token : "";
  const quote = clip(r.quote, RATING_LIMITS.quote);
  if (!id || !token || !quote) return null;
  return {
    id,
    token,
    quote,
    quoteConsent: r.quoteConsent === true,
    displayName: clip(r.displayName, RATING_LIMITS.displayName),
    displayRole: clip(r.displayRole, RATING_LIMITS.displayRole),
  };
}

/** Public summary shape served to the marketing site. */
export type RatingSummary = {
  count: number;
  average: number; // 1 decimal
  quotes: { quote: string; name: string; role: string }[];
};

/** Below this, an average is noise, not proof. The site hides the number. */
export const RATING_DISPLAY_MIN = 25;
