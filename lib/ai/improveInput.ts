/**
 * Input limits for /api/ai-improve.
 *
 * The route charges one spend unit per call on the assumption of a small
 * prompt, so the daily guard only bounds tokens if the prompt really is small.
 * Without these limits a single call could forward any amount of text.
 *
 * Fields are clipped rather than rejected, as the other AI routes do: the caps
 * sit well above a normal CV, and an unusually long one still gets suggestions.
 * Roles keep their order, so the shared bullet budget goes to the first roles.
 * Values of the wrong type are dropped here, before any spend is charged.
 *
 * Pure and dependency-free, so it can be unit tested without the route.
 */

export const IMPROVE_LIMITS = {
  /** Job title, company and headline. */
  shortField: 200,
  /** One bullet. Matches the limit in /api/jd-match/rewrite-bullet. */
  bullet: 600,
  bulletsPerRole: 20,
  roles: 15,
  /** All bullets across experienceRoles, combined. */
  roleBulletsTotal: 12_000,
  summary: 2_000,
  skill: 80,
  skills: 60,
} as const;

export type ImproveRole = { title: string; company: string; bullets: string[] };

export type ClippedImproveInput = {
  jobTitle: string;
  company: string;
  existingBullets: string[];
  headline: string;
  experienceRoles: ImproveRole[];
  existingSkills: string[];
  existingSummary: string;
};

function clipText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function clipList(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxChars));
}

function clipRoles(value: unknown): ImproveRole[] {
  if (!Array.isArray(value)) return [];
  let budget: number = IMPROVE_LIMITS.roleBulletsTotal;
  const roles: ImproveRole[] = [];
  for (const raw of value) {
    if (roles.length === IMPROVE_LIMITS.roles) break;
    if (typeof raw !== "object" || raw === null) continue;
    const role = raw as Record<string, unknown>;
    const bullets: string[] = [];
    const candidates = clipList(
      role.bullets,
      IMPROVE_LIMITS.bulletsPerRole,
      IMPROVE_LIMITS.bullet,
    );
    for (const bullet of candidates) {
      if (budget <= 0) break;
      const kept = bullet.slice(0, budget);
      bullets.push(kept);
      budget -= kept.length;
    }
    roles.push({
      title: clipText(role.title, IMPROVE_LIMITS.shortField),
      company: clipText(role.company, IMPROVE_LIMITS.shortField),
      bullets,
    });
  }
  return roles;
}

/** Returns only the fields the prompts read, each one bounded and well typed. */
export function clipImproveInput(body: Record<string, unknown>): ClippedImproveInput {
  return {
    jobTitle: clipText(body.jobTitle, IMPROVE_LIMITS.shortField),
    company: clipText(body.company, IMPROVE_LIMITS.shortField),
    existingBullets: clipList(
      body.existingBullets,
      IMPROVE_LIMITS.bulletsPerRole,
      IMPROVE_LIMITS.bullet,
    ),
    headline: clipText(body.headline, IMPROVE_LIMITS.shortField),
    experienceRoles: clipRoles(body.experienceRoles),
    existingSkills: clipList(
      body.existingSkills,
      IMPROVE_LIMITS.skills,
      IMPROVE_LIMITS.skill,
    ),
    existingSummary: clipText(body.existingSummary, IMPROVE_LIMITS.summary),
  };
}
