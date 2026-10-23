/**
 * Cover letter — what leaves the browser (2026-10-24, WP-9, cover letter v1).
 *
 * This is the ONE place that decides which parts of the CV are sent to
 * /api/cover-letter. It is deliberately an excerpt, not the CV: headline,
 * summary, the most recent role (title, company, dates, up to 4 bullets), up
 * to 12 skill names, and the UAE essentials that a UAE cover letter normally
 * states (visa, availability). No contact details, no photo, no education,
 * no certifications, no languages. The disclosure copy on the page describes
 * exactly this list; keep the two in sync.
 *
 * Pure and dependency-free so it is unit-testable from Node.
 */

import type { CvData } from "../types/cv";

export const COVER_LETTER_LIMITS = {
  bullets: 4,
  skills: 12,
  bulletChars: 300,
  summaryChars: 800,
  jobTextChars: 6000,
  company: 120,
  jobTitle: 120,
  hiringManager: 80,
} as const;

export type CoverLetterCvExcerpt = {
  firstName: string;
  headline: string;
  summary: string;
  latestRole: {
    title: string;
    company: string;
    period: string;
    bullets: string[];
  } | null;
  skills: string[];
  visaStatus: string;
  availability: string;
};

export type CoverLetterRequest = {
  company: string;
  jobTitle: string;
  hiringManager: string;
  jobText: string;
  cv: CoverLetterCvExcerpt;
};

const clip = (v: string | undefined, max: number) =>
  (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const isBlankRole = (e: CvData["experience"][number]) =>
  !(e.role ?? "").trim() && !(e.company ?? "").trim() && !e.bullets.some((b) => b.trim());

/** Build the excerpt the letter is written from. */
export function buildCvExcerpt(cv: CvData): CoverLetterCvExcerpt {
  const roles = cv.experience.filter((e) => !isBlankRole(e));
  const latest = roles[0];
  const latestRole = latest
    ? {
        title: clip(latest.role, 120),
        company: clip(latest.company, 120),
        period: [clip(latest.startDate, 20), latest.isCurrent ? "Present" : clip(latest.endDate, 20)]
          .filter(Boolean)
          .join(" – "),
        bullets: latest.bullets
          .map((b) => clip(b, COVER_LETTER_LIMITS.bulletChars))
          .filter(Boolean)
          .slice(0, COVER_LETTER_LIMITS.bullets),
      }
    : null;
  return {
    firstName: clip(cv.personal.firstName, 60),
    headline: clip(cv.personal.headline, 120),
    summary: clip(cv.personal.summary, COVER_LETTER_LIMITS.summaryChars),
    latestRole,
    skills: cv.skills
      .map((s) => clip(s.name, 60))
      .filter(Boolean)
      .slice(0, COVER_LETTER_LIMITS.skills),
    visaStatus: clip(cv.personal.visaStatus, 40),
    availability: clip(cv.personal.availability, 40),
  };
}

/** True when the CV has enough for a letter to be about something. */
export function excerptIsUsable(x: CoverLetterCvExcerpt): boolean {
  return Boolean(x.latestRole || x.summary || x.skills.length > 0);
}

export function buildCoverLetterRequest(
  cv: CvData,
  input: { company: string; jobTitle: string; hiringManager?: string; jobText?: string },
): CoverLetterRequest {
  return {
    company: clip(input.company, COVER_LETTER_LIMITS.company),
    jobTitle: clip(input.jobTitle, COVER_LETTER_LIMITS.jobTitle),
    hiringManager: clip(input.hiringManager, COVER_LETTER_LIMITS.hiringManager),
    jobText: (input.jobText ?? "").trim().slice(0, COVER_LETTER_LIMITS.jobTextChars),
    cv: buildCvExcerpt(cv),
  };
}

/**
 * Server-side: coerce an unknown JSON body into a CoverLetterRequest, or null.
 * Every string is clipped again here — the limits are enforced on the server,
 * not trusted from the client.
 */
export function parseCoverLetterRequest(raw: unknown): CoverLetterRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? clip(v, max) : "");
  const cvRaw = (r.cv && typeof r.cv === "object" ? r.cv : {}) as Record<string, unknown>;
  const roleRaw =
    cvRaw.latestRole && typeof cvRaw.latestRole === "object"
      ? (cvRaw.latestRole as Record<string, unknown>)
      : null;
  const list = (v: unknown, max: number, each: number) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").map((x) => clip(x, each)).filter(Boolean).slice(0, max)
      : [];
  const cv: CoverLetterCvExcerpt = {
    firstName: str(cvRaw.firstName, 60),
    headline: str(cvRaw.headline, 120),
    summary: str(cvRaw.summary, COVER_LETTER_LIMITS.summaryChars),
    latestRole: roleRaw
      ? {
          title: str(roleRaw.title, 120),
          company: str(roleRaw.company, 120),
          period: str(roleRaw.period, 48),
          bullets: list(roleRaw.bullets, COVER_LETTER_LIMITS.bullets, COVER_LETTER_LIMITS.bulletChars),
        }
      : null,
    skills: list(cvRaw.skills, COVER_LETTER_LIMITS.skills, 60),
    visaStatus: str(cvRaw.visaStatus, 40),
    availability: str(cvRaw.availability, 40),
  };
  const req: CoverLetterRequest = {
    company: str(r.company, COVER_LETTER_LIMITS.company),
    jobTitle: str(r.jobTitle, COVER_LETTER_LIMITS.jobTitle),
    hiringManager: str(r.hiringManager, COVER_LETTER_LIMITS.hiringManager),
    jobText: typeof r.jobText === "string" ? r.jobText.trim().slice(0, COVER_LETTER_LIMITS.jobTextChars) : "",
    cv,
  };
  if (!req.company || !req.jobTitle) return null;
  if (!excerptIsUsable(cv)) return null;
  return req;
}
