import { NextResponse } from "next/server";
import { sbPatch, supabaseConfigured } from "@/lib/server/supabase";
import { SITE_ORIGIN } from "@/lib/server/origins";
import { logRouteError } from "@/lib/server/logRouteError";

/**
 * One-click unsubscribe. The token is the one printed into every email
 * (List-Unsubscribe header + footer link). GET for humans, POST for mail
 * clients that implement RFC 8058 one-click. Idempotent; never errors to the
 * user — an unknown token still lands on the "you're off the list" page,
 * because the alternative is telling a stranger which tokens are real.
 */

export const runtime = "nodejs";

async function unsubscribe(request: Request) {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  if (supabaseConfigured() && /^[A-Za-z0-9_-]{20,64}$/.test(t)) {
    try {
      await sbPatch("subscribers", `unsubscribe_token=eq.${t}&unsubscribed_at=is.null`, { unsubscribed_at: new Date().toISOString() }, "id");
    } catch (err) {
      logRouteError("api/subscribe/unsubscribe", err);
      /* fall through to the same page */
    }
  }
  return NextResponse.redirect(`${SITE_ORIGIN}/thanks?unsubscribed=1`, 302);
}

export const GET = unsubscribe;
export const POST = unsubscribe;
