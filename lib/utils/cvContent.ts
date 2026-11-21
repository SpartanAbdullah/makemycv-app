import type { CvData } from "../types/cv";

/**
 * True when the CV has no real content yet — nothing a user would miss if it
 * were replaced.
 *
 * The store seeds one blank experience and one blank education card
 * (defaultCvData), so "has entries" is not the test; an entry counts only when
 * something was typed into it.
 *
 * Two callers rely on the same answer: JD Match (nothing to match a job
 * against, so guide the visitor to the builder), and the import review screen
 * (an empty builder can be replaced freely; a CV with content must not be
 * overwritten by default — audit 2026-11 O3).
 */
export const isCvEmpty = (cv: CvData): boolean => {
  const p = cv.personal;
  if (p.firstName?.trim() || p.lastName?.trim() || p.headline?.trim() || p.summary?.trim()) return false;
  if (cv.skills.length > 0) return false;
  if ((cv.certifications?.length ?? 0) > 0) return false;
  if ((cv.projects?.length ?? 0) > 0) return false;
  if (cv.experience.some((e) => e.role?.trim() || e.company?.trim() || (e.bullets ?? []).some((b) => b.trim())))
    return false;
  if (cv.education.some((e) => e.school?.trim() || e.degree?.trim() || e.field?.trim())) return false;
  return true;
};
