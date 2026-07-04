import type { CvExperience } from "../types/cv";

/**
 * An experience entry earns a place on the rendered CV only if it identifies
 * a real role — a job title, a company, or at least one non-empty bullet.
 *
 * The store seeds defaultCvData with one BLANK experience entry
 * (lib/store/cvStore.ts), so without this filter a user who skips the
 * Experience step ships a ghost "Experience" heading with a "Role"
 * placeholder. Mirrors lib/utils/projects.ts.
 */
export const isMeaningfulExperience = (role: CvExperience): boolean => {
  if (role.role?.trim()) return true;
  if (role.company?.trim()) return true;
  return (role.bullets ?? []).some((bullet) => Boolean(bullet?.trim()));
};

export const meaningfulExperience = (
  experience: CvExperience[],
): CvExperience[] => experience.filter(isMeaningfulExperience);
