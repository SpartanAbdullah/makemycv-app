/**
 * Per-job CV tailoring (skills focus). Builds a FOCUSED copy of the CV for one
 * job — keeping only the skills relevant to that JD (plus any the user chooses
 * to keep) and dropping the rest — so the skills section stays sharp instead of
 * ballooning as gaps are added.
 *
 * NON-DESTRUCTIVE: the input CV is never mutated. The master CV in the store
 * keeps every skill; this produces a separate copy used only for preview and
 * download, regenerated per job. Only the SKILLS section is tailored (v1);
 * everything else (experience, education, summary…) is passed through untouched.
 */
import type { CvData, CvSkill } from "../types/cv";
import { skillVariantMatch } from "./match";

const norm = (s: string) => s.trim().toLowerCase();

/**
 * True if a CV skill corresponds to any JD requirement — exact (case-insensitive)
 * or a wording variant (so "M365" is relevant to a "Microsoft 365" requirement,
 * "Excel" to "Microsoft Excel", "SQL" to "SQL Server"). Conservative by design:
 * a near-miss leaves the skill out of the focused copy, but the user can restore
 * it in one tap — so erring toward hiding is safe (nothing is lost).
 */
export function skillIsRelevant(skillName: string, reqTerms: string[]): boolean {
  const sn = norm(skillName);
  if (!sn) return false;
  return reqTerms.some((rt) => norm(rt) === sn || skillVariantMatch(skillName, rt));
}

export type TailoredResult = {
  /** A focused copy of the CV (skills curated). Never the same reference as input. */
  tailoredCv: CvData;
  /** Skills dropped from the focused copy (still in the master CV). */
  hiddenSkills: CvSkill[];
};

export function buildTailoredCv(
  cv: CvData,
  reqTerms: string[],
  keepNames: Set<string> = new Set(),
): TailoredResult {
  const keep: CvSkill[] = [];
  const hidden: CvSkill[] = [];
  for (const s of cv.skills) {
    if (skillIsRelevant(s.name, reqTerms) || keepNames.has(s.name)) {
      keep.push(s);
    } else {
      hidden.push(s);
    }
  }
  return {
    tailoredCv: { ...cv, skills: keep },
    hiddenSkills: hidden,
  };
}
