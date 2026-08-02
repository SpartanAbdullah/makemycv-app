// Sentry — server + edge runtimes. (2026-08-02, audit A-W5-031: no error
// tracking existed in either repo, so a server route throwing at 3am told
// nobody.)
//
// Next.js calls register() once per runtime at boot, and routes React Server
// Component / route-handler errors to onRequestError.
//
// PRIVACY POSTURE — read before changing any option below.
// This app handles CVs: names, phone numbers, addresses, employment history,
// and sometimes passport / visa / Emirates ID numbers. An error monitor is a
// third-party data processor, and a careless default here would ship that PII
// to Sentry and straight into a PDPL/GDPR problem. So:
//   - sendDefaultPii is FALSE. That is the whole ballgame: it stops Sentry
//     attaching IP addresses, cookies and request headers automatically.
//   - beforeSend strips request bodies and query strings, because the AI
//     routes take raw CV text as their POST body.
//   - Breadcrumbs from fetch/xhr carry URLs only, never payloads.
// The org is on Sentry's EU region (ingest host is *.ingest.de.sentry.io), so
// what does get sent stays in the EU.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Remove anything that could carry CV content out of the event.
 *
 * Sentry does not send request bodies by default, but route handlers here read
 * `rawText` / `jobDescription` / bullet text, and any of those can end up in an
 * exception message or in `request.data` once a framework integration attaches
 * it. Belt and braces: drop the body and the query string outright. An error
 * report is useful without them; a CV in a third-party dashboard is not.
 */
function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      // Keep nothing that identifies the person or authorises anything.
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-forwarded-for"];
      delete event.request.headers["x-real-ip"];
    }
  }
  delete event.user;
  return event;
}

const shared = {
  dsn,
  // Errors only. Tracing is a separate quota and this product's value from
  // Sentry is "tell me it broke", not span waterfalls. Turn it up deliberately
  // if you ever need latency data.
  tracesSampleRate: 0,
  // Never attach IP / cookies / headers automatically. See header comment.
  sendDefaultPii: false,
  // Truncate long strings so a stray CV paste cannot ride along in a message.
  maxValueLength: 2000,
  // Local runs would otherwise burn the 5k/month error quota.
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  beforeSend: scrub,
};

export async function register() {
  if (!dsn) return; // Not configured (local dev without .env.local) — no-op.

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(shared);
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(shared);
  }
}

// Captures errors thrown in React Server Components and route handlers.
// Without this export, server-side errors never reach Sentry at all.
export const onRequestError = Sentry.captureRequestError;
