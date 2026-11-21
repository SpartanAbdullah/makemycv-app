/**
 * Single source of truth for the user-facing support URL.
 * Surfaced from: BuilderShell footer, ATS report page footer, the AI
 * route's 429 response, and AIResultsModal's rate-limited state.
 *
 * See DECISION_LOG.md 2026-05-31 — pricing model pivot to free + tips.
 */
export const SUPPORT_URL = "https://www.makemycv.ae/support";

/**
 * The tip page itself. The post-export card links here directly (2026-11-21):
 * /support was an extra page between the ask and the tip. Same username
 * override as components/TipJar.tsx.
 */
export const KOFI_URL = `https://ko-fi.com/${process.env.NEXT_PUBLIC_KOFI_USERNAME || "makemycv_ae"}`;
