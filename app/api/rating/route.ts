import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { checkRateLimit, getClientIp, makeLimiter } from "@/lib/server/rateLimit";
import { sbInsert, sbPatch, sbSelect, supabaseConfigured } from "@/lib/server/supabase";
import { hashToken, newToken, tokenMatches } from "@/lib/server/tokens";
import { preflight, withCors } from "@/lib/server/cors";
import { RATING_LIMITS, parseRatingQuote, parseRatingSubmit } from "@/lib/feedback/rating";
import { logRouteError } from "@/lib/server/logRouteError";

/**
 * Ratings (2026-10-24).
 *   POST  { stars, surface }                      → { id, token }   one-tap star
 *   PATCH { id, token, quote, quoteConsent, … }   → { ok }          optional follow-up line, within 24h
 *
 * No IP is stored. The per-IP limiter runs in KV with its own prefix and the
 * IP never reaches the database. Country comes from Vercel's edge header
 * (two letters), which is all the summary needs.
 */

export const runtime = "nodejs";

const limits = {
  daily: makeLimiter({ limiter: Ratelimit.slidingWindow(6, "24 h"), prefix: "mmcv_rate_daily" }),
  burst: makeLimiter({ limiter: Ratelimit.slidingWindow(3, "60 s"), prefix: "mmcv_rate_burst" }),
};

const json = (request: Request, body: unknown, status = 200) =>
  withCors(request, NextResponse.json(body, { status }));

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    if (!supabaseConfigured()) return json(request, { error: "unavailable" }, 503);
    const ip = getClientIp(request);
    const throttle = await checkRateLimit(ip, limits);
    if (!throttle.allowed) return json(request, { error: "rate_limited" }, 429);

    const body = await request.json().catch(() => null);
    const req = parseRatingSubmit(body);
    if (!req) return json(request, { error: "bad_request" }, 400);

    const token = newToken();
    const row = await sbInsert<{ id: string }>(
      "ratings",
      {
        stars: req.stars,
        surface: req.surface,
        country: request.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null,
        edit_token_hash: hashToken(token),
      },
      "id",
    );
    return json(request, { id: row.id, token });
  } catch (err) {
    logRouteError("api/rating POST", err);
    return json(request, { error: "server_error" }, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!supabaseConfigured()) return json(request, { error: "unavailable" }, 503);
    const body = await request.json().catch(() => null);
    const req = parseRatingQuote(body);
    if (!req) return json(request, { error: "bad_request" }, 400);

    const rows = await sbSelect<{ id: string; created_at: string; edit_token_hash: string | null; quote: string | null }>(
      "ratings",
      `id=eq.${req.id}&select=id,created_at,edit_token_hash,quote`,
    );
    const row = rows[0];
    if (!row || !tokenMatches(req.token, row.edit_token_hash)) return json(request, { error: "forbidden" }, 403);
    if (Date.now() - Date.parse(row.created_at) > RATING_LIMITS.quoteWindowMs) return json(request, { error: "expired" }, 410);

    await sbPatch(
      "ratings",
      `id=eq.${req.id}`,
      {
        quote: req.quote,
        quote_consent: req.quoteConsent,
        display_name: req.quoteConsent && req.displayName ? req.displayName : null,
        display_role: req.quoteConsent && req.displayRole ? req.displayRole : null,
        // One edit only: the token is spent.
        edit_token_hash: null,
      },
      "id",
    );
    return json(request, { ok: true });
  } catch (err) {
    logRouteError("api/rating PATCH", err);
    return json(request, { error: "server_error" }, 500);
  }
}
