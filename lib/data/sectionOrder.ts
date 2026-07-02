/**
 * Domain-conditional section order (Phase 3).
 *
 * Some domains read better with a different section sequence. The clearest,
 * best-evidenced case: IT / software CVs lead with a keyword-dense SKILLS block
 * (recruiters and ATS screen the stack first), so skills is hoisted directly
 * after the summary, above experience. Everything else keeps the default order.
 *
 * Kept intentionally narrow: construction-flavored "engineering" stays
 * experience-first (action/impact), so it is NOT skills-first. Certification-
 * prominent ordering for healthcare/trades is a separate future move (those
 * templates group languages+certs, which needs its own handling).
 *
 * Only the single-column templates honor this (classic, ats-clean, and their
 * PDF layouts) — two-column/sidebar templates have fixed structural layouts.
 */
import type { RoleFamily } from "./roleFamily";

// Canonical top-level section order (matches the CvSettings.sectionOrder seed).
export const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
  "projects",
] as const;

export type SectionId = (typeof DEFAULT_SECTION_ORDER)[number];

// Domains whose CVs lead with the skills block.
const SKILLS_FIRST: ReadonlySet<RoleFamily> = new Set<RoleFamily>(["it"]);

export function isSkillsFirst(domain: RoleFamily | undefined): boolean {
  return domain ? SKILLS_FIRST.has(domain) : false;
}

/**
 * Full ordered section list for a domain. Returns a fresh array (safe to
 * mutate). Currently the only override is skills-first.
 */
export function domainSectionOrder(domain: RoleFamily | undefined): SectionId[] {
  const base: SectionId[] = [...DEFAULT_SECTION_ORDER];
  if (!isSkillsFirst(domain)) return base;
  // Explicit type: TS 5.5 infers a type predicate from `s !== "skills"`, which
  // would narrow the element type and reject the splice below.
  const withoutSkills: SectionId[] = base.filter((s) => s !== "skills");
  const afterSummary = withoutSkills.indexOf("summary") + 1; // 1 (summary is [0])
  withoutSkills.splice(afterSummary, 0, "skills");
  return withoutSkills;
}
