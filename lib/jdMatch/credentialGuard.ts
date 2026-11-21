/**
 * JD Match — when does adding a missing requirement need "I hold it" first?
 *
 * JD Match offers a one-tap "Add" for every requirement a job advert names and
 * the CV does not. For a skill that is the user's call. For a licence or a
 * certification it is a claim an employer can check against a register, and a
 * knockout question on UAE application forms — the same reason the Skills step
 * has asked for confirmation since the credential bank shipped (CLAUDE.md,
 * "Truthfulness rules").
 *
 * Until 2026-11 that confirmation lived only in the Skills step, so the same
 * DHA licence that needed a yes there could be staged here in one tap, with
 * the coach showing a score lift for doing it (audit 2026-11 A2).
 *
 * Two triggers:
 *   - the advert lists it under certifications. Everything in that bucket is a
 *     credential by definition, whether or not our bank knows the name;
 *   - the bank knows the term as a credential, whatever bucket the extractor
 *     put it in ("PMP" regularly arrives as a hard skill).
 *
 * Pure, so the rule is testable without the panel.
 */

import { isCredentialTerm } from "../data/domainSkills";
import type { JdCategory } from "./types";

export function jdAddNeedsCredentialGuard(category: JdCategory, term: string): boolean {
  return category === "certifications" || isCredentialTerm(term);
}
