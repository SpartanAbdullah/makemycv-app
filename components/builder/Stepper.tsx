/**
 * The legacy dark-sidebar Stepper component was removed when the Focus Flow
 * redesign moved progress to a top-anchored bead strip. The StepStatus type
 * is still the source of truth for step states across BuilderShell and
 * StepBeads, so we keep it as a tiny type-only module.
 */
export type StepStatus = "done" | "active" | "incomplete" | "locked";
