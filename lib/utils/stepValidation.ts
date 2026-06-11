import type { CvData } from "../types/cv";
import { BuilderStep } from "./steps";
import { isSectionComplete } from "../validation/cvRequirements";

/**
 * Thin compatibility wrapper. The actual definition of "complete" lives in
 * lib/validation/cvRequirements.ts — the ONE module that field-level blur
 * feedback, the stepper, the section toasts, and the export-gate dialog all
 * consume (guided-feedback work, 2026-06). Do not add completeness logic
 * here; extend cvRequirements instead.
 */
export const getStepCompletion = (step: BuilderStep, data: CvData): boolean =>
  isSectionComplete(step.id, data);
