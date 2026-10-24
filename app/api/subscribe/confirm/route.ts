import { NextResponse } from "next/server";
import { sbPatch, sbSelect, supabaseConfigured } from "@/lib/server/supabase";
import { hashToken, newToken } from "@/lib/server/tokens";
import { SITE_ORIGIN } from "@/lib/server/origins";
import { logRouteError } from "@/lib/server/logRouteError";

/**
 * Email sign-up, step 2 of 2: the link in the confirmation email. Sets
 * confirmed_at, mints the unsubscribe token that every later email will
 * carry, and lands the person on www/thanks. Links older than 7 days or
 * already used are "expired" — the form simply asks again.
 */

export const runtime = "nodejs";

const CONFIRM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  const expired = NextResponse.redirect(`${SITE_ORIGIN}/thanks?subscribed=expired`, 302);
  if (!supabaseConfigured() || !/^[A-Za-z0-9_-]{20,64}$/.test(t)) return expired;
  try {
    const rows = await sbSelect<{ id: string; confirm_sent_at: string | null; unsubscribe_token: string | null }>(
      "subscribers",
      `confirm_token_hash=eq.${hashToken(t)}&select=id,confirm_sent_at,unsubscribe_token`,
    );
    const row = rows[0];
    if (!row || !row.confirm_sent_at || Date.now() - Date.parse(row.confirm_sent_at) > CONFIRM_WINDOW_MS) return expired;
    await sbPatch(
      "subscribers",
      `id=eq.${row.id}`,
      {
        confirmed_at: new Date().toISOString(),
        unsubscribed_at: null,
        confirm_token_hash: null,
        unsubscribe_token: row.unsubscribe_token ?? newToken(),
      },
      "id",
    );
    return NextResponse.redirect(`${SITE_ORIGIN}/thanks?subscribed=1`, 302);
  } catch (err) {
    logRouteError("api/subscribe/confirm", err);
    return expired;
  }
}
