/**
 * The paid human CV review stays off until the release gate in
 * docs/human-review-launch-2026-11/PLAN.md is met. NEXT_PUBLIC_* is inlined at
 * build time, so turning this on or off needs a redeploy of both projects.
 */
export const HUMAN_REVIEW_ON = process.env.NEXT_PUBLIC_HUMAN_REVIEW === "1";

export const HUMAN_REVIEW_URL = "https://www.makemycv.ae/human-cv-review";
