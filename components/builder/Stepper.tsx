/**
 * The legacy dark-sidebar Stepper component was removed when the Focus Flow
 * redesign moved progress to a top-anchored bead strip. The StepStatus type
 * is still the source of truth for step states across BuilderShell and
 * StepBeads, so we keep it as a tiny type-only module.
 *
 * "attention" (guided feedback, 2026-06): a REQUIRED section the user has
 * visited and left incomplete — amber dot. Untouched sections stay
 * "incomplete" (neutral) so a fresh user isn't greeted by warnings.
 * "locked" is unused since the wave-2 navigation unlock but kept for
 * type-compat.
 */
export type StepStatus =
  | "done"
  | "active"
  | "incomplete"
  | "attention"
  | "locked";
