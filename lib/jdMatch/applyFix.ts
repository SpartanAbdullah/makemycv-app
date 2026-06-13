/**
 * JD Match — Phase B apply-fix helpers (pure, immutable).
 *
 * Each helper takes a CvData and returns a NEW CvData; the panel persists the
 * result via the store. They are deliberately pure (no React, no store, no
 * network) so they unit-test in isolation. See docs/jd-match-spec.md (Phase B).
 *
 * Bullet addressing: a bullet is identified by { experienceId, bulletIndex }
 * resolved AT APPLY TIME. Bullets stay a string[] on CvExperience
 * (index-addressed) — we deliberately do NOT migrate bullets to objects with
 * stable ids here, because that would touch every PDF/DOCX/template render path
 * and the scoring engine (a separate, heavier refactor). Resolving {id,index}
 * against the live CV at click time keeps the blast radius to this module; a
 * concurrent reorder of the same role's bullets is the only (rare, user-driven)
 * staleness window, and the worst case is a no-op or rewriting a sibling bullet
 * the user can see and undo.
 *
 * Truthfulness: "weaving" a keyword always REPLACES an existing bullet in place
 * (applyBulletRewrite) — it never appends a new bullet, because a brand-new
 * bullet would be a fabricated achievement. Replacing in place also means
 * MAX_BULLETS can never be exceeded by a fix. Adding a skill/certification is a
 * user-confirmed assertion (they clicked "Add"), never an invented fact.
 */
import type { CvData, CvCertification, CvSkill } from "../types/cv";
import { createId } from "../utils/id";

const norm = (s: string) => s.trim().toLowerCase();

/** True if a skill with this name (case-insensitive) already exists. */
export function hasSkill(cv: CvData, term: string): boolean {
  const t = norm(term);
  return cv.skills.some((s) => norm(s.name) === t);
}

/** True if a certification with this name (case-insensitive) already exists. */
export function hasCertification(cv: CvData, term: string): boolean {
  const t = norm(term);
  return cv.certifications.some((c) => norm(c.name) === t);
}

/**
 * Append `term` as a new intermediate-level skill. Returns the SAME CvData
 * reference (a no-op) when the term is blank or already present — so the caller
 * can persist unconditionally and the store's identity check skips the write.
 */
export function addSkillToCv(cv: CvData, term: string): CvData {
  const name = term.trim();
  if (!name || hasSkill(cv, name)) return cv;
  const skill: CvSkill = { id: createId(), name, level: "intermediate" };
  return { ...cv, skills: [...cv.skills, skill] };
}

/**
 * Append `term` as a new certification with a BLANK issuer (we never invent an
 * issuer or date — the user fills those in the builder). No-op (same reference)
 * if blank or already present.
 */
export function addCertificationToCv(cv: CvData, term: string): CvData {
  const name = term.trim();
  if (!name || hasCertification(cv, name)) return cv;
  const cert: CvCertification = { id: createId(), name, issuer: "" };
  return { ...cv, certifications: [...cv.certifications, cert] };
}

/**
 * Replace bullet `bulletIndex` of experience `experienceId` with `newText`,
 * in place (never adds a bullet — so MAX_BULLETS is structurally respected).
 * No-op (same reference) when the experience or index is not found, the new
 * text is blank, or it is identical to the current bullet.
 */
export function applyBulletRewrite(
  cv: CvData,
  experienceId: string,
  bulletIndex: number,
  newText: string,
): CvData {
  const text = newText.trim();
  if (!text) return cv;
  const expIndex = cv.experience.findIndex((e) => e.id === experienceId);
  if (expIndex === -1) return cv;
  const exp = cv.experience[expIndex];
  if (bulletIndex < 0 || bulletIndex >= exp.bullets.length) return cv;
  if (exp.bullets[bulletIndex] === text) return cv;
  const bullets = exp.bullets.map((b, i) => (i === bulletIndex ? text : b));
  const experience = cv.experience.map((e, i) =>
    i === expIndex ? { ...e, bullets } : e,
  );
  return { ...cv, experience };
}
