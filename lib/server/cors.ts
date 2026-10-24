import { NextResponse } from "next/server";

/**
 * CORS for the few routes the marketing site calls directly (email sign-up).
 * Allow-list, not reflection: only our own origins, plus localhost for the
 * site's dev server. Everything else gets no CORS headers and the browser
 * blocks the response.
 */
const ALLOWED = new Set([
  "https://www.makemycv.ae",
  "https://makemycv.ae",
  "http://localhost:3001",
  "http://localhost:3000",
]);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(request: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export function withCors(request: Request, res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(request))) res.headers.set(k, v);
  return res;
}
