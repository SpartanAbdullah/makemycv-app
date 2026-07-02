/**
 * UAE soft-skills mapping — culture-aware suggestions for the Skills step.
 *
 * The UAE workforce is ~88% expatriate and spans 200+ nationalities, so the
 * soft skills that actually matter on a UAE CV differ from a single-culture
 * market: cross-cultural collaboration, multilingual communication, and
 * stakeholder management across nationalities are screened for explicitly.
 *
 * This is a static taxonomy (zero runtime cost, reviewable by HR partners in
 * the future partner program). It surfaces as one-tap chips beneath the
 * skills input. Every entry is a real, screenable soft skill — no filler like
 * "hard-working" that recruiters skip.
 *
 * UNIVERSAL skills suit any UAE role; FAMILY skills are layered in when the
 * job title matches, reusing the same RoleFamily keys as ideaSuggestions.
 */
import { inferRoleFamily, type RoleFamily } from "./roleFamily";

// Soft skills relevant to virtually every UAE role, regardless of function.
export const UNIVERSAL_SOFT_SKILLS: string[] = [
  "Cross-Cultural Collaboration",
  "Multicultural Team Leadership",
  "English Communication",
  "Stakeholder Management",
  "Adaptability",
  "Problem Solving",
  "Time Management",
  "Customer Focus",
];

// Layered on top when the role family matches. Kept short and screenable.
const FAMILY_SOFT_SKILLS: Partial<Record<RoleFamily, string[]>> = {
  sales: ["Negotiation", "Relationship Building", "Client Retention", "Consultative Selling"],
  marketing: ["Brand Storytelling", "Data-Driven Decision Making", "Campaign Management", "Creativity"],
  finance: ["Analytical Thinking", "Attention to Detail", "Regulatory Awareness", "Commercial Acumen"],
  accounting: ["Attention to Detail", "Integrity", "Deadline Management", "Compliance Focus"],
  operations: ["Process Optimisation", "Decision Making", "Conflict Resolution", "Resource Planning"],
  logistics: ["Coordination", "Vendor Management", "Problem Solving Under Pressure", "Planning"],
  hr: ["Confidentiality", "Conflict Resolution", "Empathy", "Cultural Sensitivity"],
  admin: ["Organisation", "Discretion", "Multitasking", "Diplomacy"],
  engineering: ["Safety Awareness", "Technical Communication", "Team Coordination", "Attention to Detail"],
  it: ["Analytical Thinking", "Continuous Learning", "Collaboration", "Problem Solving"],
  hospitality: ["Guest Service Excellence", "Composure Under Pressure", "Teamwork", "Cultural Sensitivity"],
  retail: ["Upselling", "Patience", "Product Knowledge", "Customer Engagement"],
  realestate: ["Persuasion", "Market Awareness", "Client Advisory", "Networking"],
  healthcare: ["Patient Empathy", "Composure", "Attention to Detail", "Teamwork"],
  education: ["Patience", "Mentoring", "Clear Communication", "Cultural Sensitivity"],
  customerservice: ["Active Listening", "Patience", "Multilingual Communication", "De-escalation"],
};

/**
 * Returns UAE soft-skill suggestions: universal skills first, then any that
 * match the role family. The family is the caller-supplied `domain`
 * (user-confirmed) when given, otherwise inferred from the role title via the
 * shared matcher (lib/data/roleFamily.ts), so idea bullets and soft skills can
 * never disagree on which family a title belongs to. Excludes skills already
 * added.
 *
 * @param roleTitle most recent job title (drives family layer); optional
 * @param exclude   skill names already present (case-insensitive)
 * @param limit     max suggestions to return (default 10)
 * @param domain    optional confirmed domain that overrides title inference
 */
export function softSkillSuggestions(
  roleTitle: string | undefined,
  exclude: string[] = [],
  limit = 10,
  domain?: RoleFamily,
): string[] {
  const excludeSet = new Set(exclude.map((s) => s.toLowerCase().trim()));

  const family =
    domain && domain !== "generic"
      ? domain
      : inferRoleFamily(roleTitle).family;
  const familySkills =
    family !== "generic" ? (FAMILY_SOFT_SKILLS[family] ?? []) : [];

  // Family skills first (more specific), then universal — de-duplicated.
  const ordered = [...familySkills, ...UNIVERSAL_SOFT_SKILLS];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const skill of ordered) {
    const key = skill.toLowerCase();
    if (seen.has(key) || excludeSet.has(key)) continue;
    seen.add(key);
    result.push(skill);
    if (result.length >= limit) break;
  }
  return result;
}
