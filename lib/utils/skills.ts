import { firstStrongDirection } from "../pdf/arabicText";
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

export type SkillGroup = {
  /**
   * Section key for first-section spacing. The first group printed is always
   * "skills", so a CV with only technical skills keeps the gap rules a lone
   * Skills section had; a technical group after a general one is
   * "technical-skills".
   */
  key: "skills" | "technical-skills";
  title: "Skills" | "Technical Skills";
  skills: CvSkill[];
};

/**
 * The skills sections a template prints, in order, empties dropped (backlog
 * F4, 2026-11-28): general skills under "Skills", then technical skills under
 * their own "Technical Skills" heading — the split ATS Clean, Classic and
 * Professional already printed, for the templates that list skills as chips
 * or rows. An untagged CV (every legacy one) gets one "Skills" group, exactly
 * as before.
 */
export function skillGroups(skills: CvSkill[]): SkillGroup[] {
  const { general, technical } = splitSkills(skills);
  const groups: SkillGroup[] = [];
  if (general.length > 0) groups.push({ key: "skills", title: "Skills", skills: general });
  if (technical.length > 0) {
    groups.push({
      key: general.length > 0 ? "technical-skills" : "skills",
      title: "Technical Skills",
      skills: technical,
    });
  }
  return groups;
}

/** The names a skills list prints: trimmed, empties dropped, order kept. */
export function skillNames(skills: CvSkill[]): string[] {
  return skills.map((skill) => skill.name.trim()).filter(Boolean);
}

/**
 * Direction a printed skills list flows in (backlog F3, 2026-11-28). The
 * list used to be ONE joined line whose direction came from its first strong
 * character (the preview's `unicode-bidi: plaintext`, the PDF's
 * `firstStrongDirection`). Printed as separate items, it keeps that rule for
 * the whole list, so an Arabic-first list still starts on the right in both
 * renderers. Each name keeps its own direction inside its item.
 */
export function skillListDirection(names: readonly string[]): "ltr" | "rtl" {
  return firstStrongDirection(names.join(" ")) === "rtl" ? "rtl" : "ltr";
}
