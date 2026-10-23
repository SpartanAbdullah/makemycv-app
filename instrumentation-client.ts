// Sentry — browser runtime. Next.js loads this once on the client.
//
// Same privacy posture as instrumentation.ts (read the header comment there
// before changing anything): sendDefaultPii false, no request bodies, EU
// ingest region.
//
// The client is the higher-risk surface here, because the CV lives in this
// browser's localStorage and every builder keystroke passes through React
// state. Two extra guards below that the server config does not need.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    maxValueLength: 2000,
    enabled: process.env.NODE_ENV === "production",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

    // NO Session Replay. It would record the user typing their passport
    // number, salary history and home address into the builder, then ship
    // that recording to a third party. Sentry's masking is opt-out and
    // best-effort; for this product the only safe setting is "off".
    // Do not enable it without a PDPL/GDPR review and a privacy-policy update.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    beforeSend(event) {
      // localStorage keys hold the whole CV — make sure nothing walked into
      // the event via extra context.
      delete event.user;
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
      }
      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Drop console breadcrumbs: the app console.warns parser and storage
      // failures, and those messages can quote CV text.
      if (breadcrumb.category === "console") return null;
      // Keep fetch/xhr breadcrumbs (URL + status are genuinely useful for
      // debugging the AI routes) but never their bodies.
      if (breadcrumb.data) delete breadcrumb.data.body;
      return breadcrumb;
    },
  });
}

// CSP violations are otherwise invisible: the browser refuses the request,
// logs to a console nobody is watching, and the product keeps "working" —
// which is exactly how GA4 collection stayed blocked for ten weeks (audit
// F23, 2026-10-24). Report the first few per page to Sentry. The event
// carries only the blocked host and the directive — never request bodies,
// never CV content. Capped per page so a blocked third-party tag cannot
// flood the error quota.
if (typeof window !== "undefined" && dsn) {
  let reported = 0;
  window.addEventListener("securitypolicyviolation", (e) => {
    if (reported >= 3) return;
    reported += 1;
    let host = e.blockedURI;
    try {
      host = new URL(e.blockedURI).host || e.blockedURI;
    } catch {
      /* "inline", "eval", "data" and friends have no host */
    }
    Sentry.captureMessage(`CSP violation: ${e.violatedDirective} blocked ${host}`, {
      level: "warning",
      tags: { csp_directive: e.violatedDirective, csp_host: host },
      fingerprint: ["csp", e.violatedDirective, host],
    });
  });
}

// Instruments client-side navigation errors in the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
