import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { checkRateLimit, getClientIp, makeLimiter } from "@/lib/server/rateLimit";
import { sbSelect, sbUpsert, supabaseConfigured } from "@/lib/server/supabase";
import { confirmEmail, emailConfigured, sendEmail } from "@/lib/server/email";
import { hashToken, newToken } from "@/lib/server/tokens";
import { preflight, withCors } from "@/lib/server/cors";
import { CONSENT_TEXT_VERSION, parseSubscribe } from "@/lib/feedback/subscribe";
import { APP_ORIGIN } from "@/lib/server/origins";

/**
 * Email sign-up, step 1 of 2 (2026-10-24): store the address with the consent
 * text version, send a confirmation link. Nothing is "subscribed" until
 * /api/subscribe/confirm sets confirmed_at. Called from the builder, the
 * checker report and (cross-origin) the marketing site.
 *
 * The response is the same whether the address is new, pending or already
 * confirmed, so the endpoint cannot be used to test whether someone is on
 * the list.
 */

export const runtime = "nodejs";

const limits = {
  daily: makeLimiter({ limiter: Ratelimit.slidingWindow(5, "24 h"), prefix: "mmcv_sub_daily" }),
  burst: makeLimiter({ limiter: Ratelimit.slidingWindow(2, "60 s"), prefix: "mmcv_sub_burst" }),
};

const json = (request: Request, body: unknown, status = 200) =>
  withCors(request, NextResponse.json(body, { status }));

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    if (!supabaseConfigured() || !emailConfigured()) return json(request, { error: "unavailable" }, 503);
    const ip = getClientIp(request);
    const throttle = await checkRateLimit(ip, limits);
    if (!throttle.allowed) return json(request, { error: "rate_limited" }, 429);

    const body = await request.json().catch(() => null);
    const req = parseSubscribe(body);
    if (!req) return json(request, { error: "bad_request" }, 400);

    const existing = await sbSelect<{ confirmed_at: string | null; unsubscribed_at: string | null }>(
      "subscribers",
      `email=eq.${encodeURIComponent(req.email)}&select=confirmed_at,unsubscribed_at`,
    );
    const live = existing[0] && existing[0].confirmed_at && !existing[0].unsubscribed_at;
    if (!live) {
      const token = newToken();
      await sbUpsert(
        "subscribers",
        {
          email: req.email,
          source: req.source,
          consent_text_version: CONSENT_TEXT_VERSION,
          country: request.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null,
          confirm_token_hash: hashToken(token),
          confirm_sent_at: new Date().toISOString(),
        },
        "email",
        "id",
      );
      const url = `${APP_ORIGIN}/api/subscribe/confirm?t=${token}`;
      await sendEmail({ to: req.email, ...confirmEmail(url) });
    }
    return json(request, { ok: true });
  } catch {
    return json(request, { error: "server_error" }, 500);
  }
}
