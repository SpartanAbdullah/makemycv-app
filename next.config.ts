import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // www.googletagmanager.com serves BOTH gtm.js and the gtag.js
              // that GTM's GA4 tag injects, so this one entry covers the whole
              // chain (2026-08-10, GA4 audit). Without it the browser blocks
              // the tag and this host stays unmeasured — which is the exact
              // state the audit found: zero GA4 hostname rows in 28 days.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              // *.ingest.de.sentry.io — the Sentry org is on the EU region, so
              // the ingest host is .de. and NOT the .us. host most docs show.
              // Getting this wrong fails silently: the browser blocks the
              // request and errors simply never arrive.
              //
              // The three google-analytics/analytics.google.com entries are
              // where GA4 POSTs its hits. The wildcards are not cosmetic: GA4
              // routes collection through REGIONAL endpoints
              // (region1.google-analytics.com and similar), so allowing only
              // the bare www host drops hits for some users and not others —
              // the worst failure mode, because the data looks present.
              // No frame-src entry is needed: unlike the marketing site, this
              // app deliberately ships no GTM <noscript> iframe.
              "connect-src 'self' https://cdnjs.cloudflare.com https://api.anthropic.com https://vitals.vercel-insights.com https://*.ingest.de.sentry.io https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// withSentryConfig WRAPS the config above — it does not replace it. Everything
// in `nextConfig` (notably the headers() block, which is this app's entire
// security-header set including the CSP) is preserved. If you ever refactor
// this line, verify the headers still ship: `curl -sI https://app.makemycv.ae
// | grep -i content-security-policy`.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source-map upload needs SENTRY_AUTH_TOKEN at BUILD time only; it is never
  // bundled. Without it the build still succeeds — you just get minified stack
  // traces instead of your real code.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Keep the build log readable; real failures still surface.
  silent: !process.env.CI,

  // Strip source maps from the client bundle after uploading them to Sentry.
  // Without this the .map files are served publicly, which would hand anyone
  // the app's original source.
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  // Do NOT proxy Sentry through our own domain. tunnelRoute would dodge
  // ad-blockers, but it also routes browser traffic through a Vercel function
  // (invocation cost) and, more importantly, would make requests carrying
  // error data appear same-origin — which is exactly the kind of thing the
  // CSP above exists to make visible. Explicit connect-src entry instead.
  tunnelRoute: undefined,

  // The React component-name annotation adds a data attribute to every element.
  // Off: it bloats the DOM and the builder already has large render trees.
  reactComponentAnnotation: { enabled: false },

  disableLogger: true,
});
