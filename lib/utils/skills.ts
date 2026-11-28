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
