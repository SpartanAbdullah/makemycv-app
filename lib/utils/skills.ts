import type { CvSkill } from "../types/cv";

/**
 * Splits skills into general vs technical groups for rendering a separate
 * "Technical Skills" section. Order is preserved within each group. A skill
 * with no category (the default / all legacy CVs) is treated as general, so
 * templates that only render `general` still show everything when nobody has
 * tagged anything technical.
 */
export function splitSkills(skills: CvSkill[]): {
  general: CvSkill[];
  technical: CvSkill[];
} {
  const general: CvSkill[] = [];
  const technical: CvSkill[] = [];
  for (const skill of skills) {
    if (skill.category === "technical") technical.push(skill);
    else general.push(skill);
  }
  return { general, technical };
}
