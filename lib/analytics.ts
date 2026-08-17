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
  window.dataLayer.push({ event, ...params });
}
