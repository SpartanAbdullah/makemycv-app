import { NextResponse, type NextRequest } from "next/server";
import { GEO_COOKIE, geoBucket } from "./lib/consent";

/**
 * Edge proxy (2026-10-24): one job — stamp the visitor's region bucket into a
 * cookie so the consent bootstrap in app/layout.tsx can pick the right
 * default BEFORE Google Tag Manager loads (EU/UK/CH: denied; elsewhere:
 * granted). Country comes from Vercel's header; locally it is absent and the
 * bucket is "row". Only the bucket is stored, never the country.
 */
export default function proxy(request: NextRequest) {
  const res = NextResponse.next();
  if (!request.cookies.get(GEO_COOKIE)) {
    res.cookies.set(GEO_COOKIE, geoBucket(request.headers.get("x-vercel-ip-country")), {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return res;
}

/*
 * Matcher (narrowed 2026-11-04). In Next 16 the proxy runs as a Vercel
 * function, so every match spends Fluid Active CPU — and the old pattern ran
 * on every page view, prefetch, icon and manifest request, with the free team
 * at its 4-hour CPU limit. Now: page paths only (no dot in the path), and
 * only while the region cookie is missing, i.e. once per visitor per 30 days.
 *
 * Named crawlers skip the page entry (2026-11-07). They never keep cookies, so
 * each of their page requests ran the proxy to stamp a cookie nobody reads.
 * The list names crawlers on purpose. Do NOT replace it with a bare "bot"
 * match: a missing cookie reads as non-EU in lib/consent.ts, so a real EU
 * visitor caught by the rule would get analytics on by default, and real
 * phones such as Cubot have "bot" in their user agent.
 */
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|.*\\..*).*)",
      // = GEO_COOKIE; Next reads `config` statically, so it must be a literal.
      missing: [
        { type: "cookie", key: "mmcv_geo" },
        {
          type: "header",
          key: "user-agent",
          value:
            ".*(Googlebot|GoogleOther|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|Storebot-Google|bingbot|BingPreview|msnbot|adidxbot|GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|ClaudeBot|Claude-User|Claude-SearchBot|meta-webindexer|meta-externalagent|meta-externalfetcher|facebookexternalhit|Amazonbot|Applebot|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|YandexBot|Baiduspider|DuckDuckBot|Bytespider|CCBot|DataForSeoBot|BLEXBot|LinkedInBot|Twitterbot|TelegramBot|Slackbot|Discordbot|SentryUptimeBot).*",
        },
      ],
    },
  ],
};
