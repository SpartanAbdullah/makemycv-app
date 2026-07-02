import type { CvProject } from "../types/cv";

/**
 * A project earns a place on the rendered CV only if it carries real
 * content — a name, or at least one non-empty bullet. Empty shells (a card
 * added on the Projects step and then left blank, skipped over, or carried
 * in from an import) must never surface a ghost "Projects" heading on the CV
 * or in the PDF/DOCX exports.
 *
 * The Projects step lets the user delete the last card down to zero, but
 * this filter is the safety net for data that already holds a blank shell
 * (skipped, imported, or restored from older localStorage).
 */
export const isMeaningfulProject = (project: CvProject): boolean => {
  if (project.name?.trim()) return true;
  return (project.bullets ?? []).some((bullet) => Boolean(bullet?.trim()));
};

export const meaningfulProjects = (projects: CvProject[]): CvProject[] =>
  projects.filter(isMeaningfulProject);
