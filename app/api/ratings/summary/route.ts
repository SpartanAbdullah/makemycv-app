import { NextResponse } from "next/server";
import { sbSelect, supabaseConfigured } from "@/lib/server/supabase";
import type { RatingSummary } from "@/lib/feedback/rating";

/**
 * Public, cached summary for the marketing site (2026-10-24): how many stars,
 * the average, and the quotes a human has approved. Nothing per-user, nothing
 * identifying beyond the first name + role the person chose to attach.
 * Cached at the edge for an hour; the site also revalidates hourly.
 */

export const runtime = "nodejs";

const EMPTY: RatingSummary = { count: 0, average: 0, quotes: [] };

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
  if (!supabaseConfigured()) return NextResponse.json(EMPTY, { headers });
  try {
    const [stars, quotes] = await Promise.all([
      sbSelect<{ stars: number }>("ratings", "select=stars&order=created_at.desc&limit=5000"),
      sbSelect<{ quote: string; display_name: string | null; display_role: string | null }>(
        "ratings",
        "select=quote,display_name,display_role&approved_at=not.is.null&quote_consent=eq.true&quote=not.is.null&order=approved_at.desc&limit=6",
      ),
    ]);
    const count = stars.length;
    const average = count ? Math.round((stars.reduce((a, r) => a + r.stars, 0) / count) * 10) / 10 : 0;
    const body: RatingSummary = {
      count,
      average,
      quotes: quotes.map((q) => ({ quote: q.quote, name: q.display_name ?? "", role: q.display_role ?? "" })),
    };
    return NextResponse.json(body, { headers });
  } catch {
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  }
}
