/**
 * Single entitlement checkpoint for the domain-personalization feature.
 *
 * Phase 1 ships it ON for everyone (returns true), matching the current
 * force-`isPro: true` posture (lib/store/cvStore.ts). The free-vs-Pro line is
 * "decide later" — when the paid tier is revived, flip this to read `isPro`
 * (Pro-only) or leave it `true` (free differentiator) in ONE place. Every
 * domain-tailoring branch (the confirm chip, headline inference, the AI
 * domain clause) checks this, so the gate never has to be hunted for.
 */
export function canTailorByDomain(): boolean {
  return true;
}
