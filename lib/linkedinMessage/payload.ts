/**
 * LinkedIn recruiter message — what leaves the browser (2026-10-31, product #3).
 *
 * This is the ONE place that decides which parts of the CV are sent to
 * /api/linkedin-message. It mirrors lib/coverLetter/payload.ts but is a
 * smaller excerpt still, because a 60–90-word message needs less: headline,
 * the most recent role (title, company, up to 2 bullets), up to 3 skill
 * names, and the visa / availability lines a UAE recruiter asks about first.
 * No name, no contact details, no photo, no summary, no education, no
 * certifications, no languages. The disclosure copy on the page describes
 * exactly this list; keep the two in sync.
 *
 * The pasted job / recruiter text is REQUIRED — the message is a reply to
 * something, and without it the model has nothing to be about.
 *
 * Pure and dependency-free so it is unit-testable from Node.
 */

import type { CvData } from "../types/cv";

export const LINKEDIN_MESSAGE_LIMITS = {
  bullets: 2,
  skills: 3,
  bulletChars: 200,
  headline: 120,
  role: 120,
  jobTextChars: 3000,
  /** Below this the paste is a title, not a job or a recruiter's note. */
  jobTextMinChars: 30,
} as const;

/**
 * "message" — an InMail / direct message, 60–90 words.
 * "connection_note" — the note attached to a connection request; LinkedIn
 * caps it at 200 characters, so the model is asked for ≤200.
 */
export type LinkedinMessageVariant = "message" | "connection_note";

export const LINKEDIN_VARIANTS: readonly LinkedinMessageVariant[] = ["message", "connection_note"];

export const CONNECTION_NOTE_MAX_CHARS = 200;
export const MESSAGE_WORDS = { min: 60, max: 90 } as const;

export type LinkedinMessageCvExcerpt = {
  headline: string;
  latestRole: {
    title: string;
    company: string;
    bullets: string[];
  } | null;
  skills: string[];
  visaStatus: string;
  availability: string;
};

export type LinkedinMessageRequest = {
  jobText: string;
  variant: LinkedinMessageVariant;
  cv: LinkedinMessageCvExcerpt;
};

const clip = (v: string | undefined, max: number) =>
  (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const isBlankRole = (e: CvData["experience"][number]) =>
  !(e.role ?? "").trim() && !(e.company ?? "").trim() && !e.bullets.some((b) => b.trim());

/** Build the excerpt the message is written from. */
export function buildLinkedinCvExcerpt(cv: CvData): LinkedinMessageCvExcerpt {
  const roles = cv.experience.filter((e) => !isBlankRole(e));
  const latest = roles[0];
  const latestRole = latest
    ? {
        title: clip(latest.role, LINKEDIN_MESSAGE_LIMITS.role),
        company: clip(latest.company, LINKEDIN_MESSAGE_LIMITS.role),
        bullets: latest.bullets
          .map((b) => clip(b, LINKEDIN_MESSAGE_LIMITS.bulletChars))
          .filter(Boolean)
          .slice(0, LINKEDIN_MESSAGE_LIMITS.bullets),
      }
    : null;
  return {
    headline: clip(cv.personal.headline, LINKEDIN_MESSAGE_LIMITS.headline),
    latestRole,
    skills: cv.skills
      .map((s) => clip(s.name, 60))
      .filter(Boolean)
      .slice(0, LINKEDIN_MESSAGE_LIMITS.skills),
    visaStatus: clip(cv.personal.visaStatus, 40),
    availability: clip(cv.personal.availability, 40),
  };
}

/** True when the CV has enough for a message to be about something. */
export function linkedinExcerptIsUsable(x: LinkedinMessageCvExcerpt): boolean {
  return Boolean(x.latestRole || x.headline || x.skills.length > 0);
}

/** True when the paste is long enough to be a job or a recruiter's note. */
export function jobTextIsUsable(jobText: string): boolean {
  return jobText.trim().length >= LINKEDIN_MESSAGE_LIMITS.jobTextMinChars;
}

const asVariant = (v: unknown): LinkedinMessageVariant =>
  v === "connection_note" ? "connection_note" : "message";

export function buildLinkedinMessageRequest(
  cv: CvData,
  input: { jobText: string; variant?: LinkedinMessageVariant },
): LinkedinMessageRequest {
  return {
    jobText: (input.jobText ?? "").trim().slice(0, LINKEDIN_MESSAGE_LIMITS.jobTextChars),
    variant: asVariant(input.variant),
    cv: buildLinkedinCvExcerpt(cv),
  };
}

/**
 * Server-side: coerce an unknown JSON body into a LinkedinMessageRequest, or
 * null. Every string is clipped again here — the limits are enforced on the
 * server, not trusted from the client.
 */
export function parseLinkedinMessageRequest(raw: unknown): LinkedinMessageRequest | null {
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
  const cv: LinkedinMessageCvExcerpt = {
    headline: str(cvRaw.headline, LINKEDIN_MESSAGE_LIMITS.headline),
    latestRole: roleRaw
      ? {
          title: str(roleRaw.title, LINKEDIN_MESSAGE_LIMITS.role),
          company: str(roleRaw.company, LINKEDIN_MESSAGE_LIMITS.role),
          bullets: list(roleRaw.bullets, LINKEDIN_MESSAGE_LIMITS.bullets, LINKEDIN_MESSAGE_LIMITS.bulletChars),
        }
      : null,
    skills: list(cvRaw.skills, LINKEDIN_MESSAGE_LIMITS.skills, 60),
    visaStatus: str(cvRaw.visaStatus, 40),
    availability: str(cvRaw.availability, 40),
  };
  const req: LinkedinMessageRequest = {
    jobText: typeof r.jobText === "string" ? r.jobText.trim().slice(0, LINKEDIN_MESSAGE_LIMITS.jobTextChars) : "",
    variant: asVariant(r.variant),
    cv,
  };
  if (!jobTextIsUsable(req.jobText)) return null;
  if (!linkedinExcerptIsUsable(cv)) return null;
  return req;
}
