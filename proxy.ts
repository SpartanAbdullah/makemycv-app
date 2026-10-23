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

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|logos).*)"],
};
