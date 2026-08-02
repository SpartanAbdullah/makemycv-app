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

// Instruments client-side navigation errors in the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
