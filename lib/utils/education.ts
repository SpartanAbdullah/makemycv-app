import type { CvEducation } from "../types/cv";

/**
 * An education entry earns a place on the rendered CV only if it names a real
 * qualification — a school, a degree, or a field of study.
 *
 * The store seeds defaultCvData with one BLANK education entry
 * (lib/store/cvStore.ts), so without this filter a user who skips the
 * Education step ships a ghost "Education" heading with a "Degree"
 * placeholder. Mirrors lib/utils/projects.ts.
 */
export const isMeaningfulEducation = (edu: CvEducation): boolean =>
  Boolean(edu.school?.trim() || edu.degree?.trim() || edu.field?.trim());

export const meaningfulEducation = (
  education: CvEducation[],
): CvEducation[] => education.filter(isMeaningfulEducation);
