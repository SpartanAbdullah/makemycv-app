/**
 * Analytics transport (app.makemycv.ae).
 *
 * Mirrors makemycv-site/lib/analytics.ts deliberately — the two surfaces share
 * ONE GTM container (GTM-5H2LMVJT) and ONE GA4 stream, so an event name sent
 * from here and from the marketing site must mean the same thing.
 *
 * GA4 here is delivered by Google Tag Manager, NOT a direct gtag install.
 * `window.gtag` DOES NOT EXIST on this domain: GTM injects gtag.js but never
 * defines the `function gtag(){dataLayer.push(arguments)}` wrapper that the
 * manual snippet would. Any `window.gtag(...)` call is a silent no-op. The
 * marketing site shipped exactly that bug and recorded nothing from 21 CTA
 * call sites until 10 Aug 2026 — don't repeat it. The correct transport is a
 * dataLayer push.
 *
 * IMPORTANT — this is only half the pipeline. A push with no matching Custom
 * Event trigger and GA4 Event tag inside the container goes nowhere: the code
 * looks right, the build passes, and GA4 stays empty. Every event name sent
 * from here needs a counterpart configured AND PUBLISHED in GTM.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Push a custom event to the GTM dataLayer.
 *
 * Safe to call from anywhere: no-ops during SSR and when the container is
 * absent (localhost and preview deploys, where NEXT_PUBLIC_GTM_ID is unset by
 * design — see app/layout.tsx — or when an ad blocker has removed GTM).
 * Analytics must never throw into product code.
 *
 * Never pass PII. This is a CV builder: no names, emails, phone numbers, or
 * any CV content. Parameters are enums, counts and outcomes only.
 */
export function track(
  event: string,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...PARAM_RESET, ...params });
}

/**
 * Every event-parameter key the GTM container reads as a Data Layer Variable
 * (container version 4, 2026-10-24). GTM keeps the last value of each key
 * across pushes, so without a reset a `tip_click` sent after a `share_click`
 * would carry `method=copy_link`. Pushing `undefined` clears the key in GTM's
 * data layer model and the GA4 tag omits the parameter. Add a key here when
 * a new DLV is created in the container.
 */
const PARAM_KEYS = ["stars", "surface", "consent", "source", "rail", "context", "method", "format", "template"] as const;
const PARAM_RESET: Record<(typeof PARAM_KEYS)[number], undefined> = Object.fromEntries(
  PARAM_KEYS.map((k) => [k, undefined]),
) as Record<(typeof PARAM_KEYS)[number], undefined>;

// Keys already claimed in this page lifetime. Backs up sessionStorage when it
// is unavailable (private mode, blocked storage) and absorbs React Strict
// Mode's double-run of effects in dev.
const claimedThisPage = new Set<string>();

/**
 * Push an event at most once per browser session (tab), keyed by `key`.
 *
 * sessionStorage makes it survive reloads and leaving/re-entering the builder;
 * the module-level Set covers the case where storage throws. Funnel events
 * (builder_start, builder_step) rely on this — a reload on step 3 must not
 * count step 3 twice.
 */
export function trackOncePerSession(
  key: string,
  event: string,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  if (claimedThisPage.has(key)) return;
  claimedThisPage.add(key);
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* sessionStorage unavailable — the Set still dedupes within this page */
  }
  track(event, params);
}
