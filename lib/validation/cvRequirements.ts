// THE single source of truth for "what is required" and "what is complete"
// in the builder (guided-feedback work, 2026-06).
//
// Consumers — all of them, by design:
//   - field-level blur feedback (green check / quiet error) in the steps
//   - section completion in the stepper (via getStepCompletion, which is a
//     thin wrapper over isSectionComplete)
//   - the section-leave and section-done toasts
//   - the export-gate dialog's "what's missing" list
//
// computeScore() in lib/scoreEngine.ts is a SCORING rubric, not a
// completeness definition — no UI surface derives "complete" from it. If a
// future feature needs both, it consumes this module.
//
// Rule of the house: only REQUIRED things may warn. Optional sections and
// fields never produce red borders, amber dots, or missing-list entries.

import type {
  CvData,
  CvEducation,
  CvExperience,
  CvProject,
} from "../types/cv";
import {
  summarySchema,
  languagesSchema,
  certificationsSchema,
  projectsSchema,
} from "../schemas/cvSchemas";
import type { BuilderStep } from "../utils/steps";
import { builderSteps } from "../utils/steps";

export type SectionId = BuilderStep["id"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Field-level validators (shared by blur feedback + missing list) ────────

const filled = (v: string | undefined) => Boolean(v && v.trim());

export const fieldValidators = {
  /** Personal */
  firstName: (v: string) => filled(v),
  lastName: (v: string) => filled(v),
  email: (v: string) => filled(v) && EMAIL_RE.test(v.trim()),
  /** Experience / education entry fields */
  entryText: (v: string | undefined) => filled(v),
  /** A usable bullet — mirrors the zod min(3) rule. */
  bullet: (v: string | undefined) => Boolean(v && v.trim().length >= 3),
} as const;

// ── Blank-stub detection (mirrors lib/utils/stepValidation semantics:
//    an untouched "Add another" card must not poison anything) ──────────────

export const isBlankExperience = (e: CvExperience) =>
  !filled(e.company) &&
  !filled(e.role) &&
  !filled(e.startDate) &&
  !filled(e.endDate ?? "") &&
  !e.bullets.some((b) => b.trim());

export const isBlankEducation = (e: CvEducation) =>
  !filled(e.school) && !filled(e.degree) && !filled(e.startDate) && !filled(e.endDate ?? "");

const isBlankProject = (p: CvProject) =>
  !filled(p.name) && !p.bullets.some((b) => b.trim());

const realExperience = (data: CvData) =>
  data.experience.filter((e) => !isBlankExperience(e));

const realEducation = (data: CvData) =>
  data.education.filter((e) => !isBlankEducation(e));

// ── Missing items ──────────────────────────────────────────────────────────

export type MissingItem = {
  sectionId: SectionId;
  sectionTitle: string;
  /** Short, plain-English description of the missing thing. Used verbatim in
   *  the export dialog and (first item only) in the leave toast — keep it
   *  encouraging and specific, never scolding. */
  label: string;
};

const sectionTitle = (id: SectionId): string =>
  builderSteps.find((s) => s.id === id)?.title ?? id;

const item = (sectionId: SectionId, label: string): MissingItem => ({
  sectionId,
  sectionTitle: sectionTitle(sectionId),
  label,
});

/**
 * Everything required that is still missing, in builder-step order.
 * Empty array ⇔ the CV is export-ready (all required content present).
 */
export function getMissingItems(data: CvData): MissingItem[] {
  const missing: MissingItem[] = [];
  const p = data.personal;

  // Personal Info
  if (!fieldValidators.firstName(p.firstName)) {
    missing.push(item("personal", "First name is still empty"));
  }
  if (!fieldValidators.lastName(p.lastName)) {
    missing.push(item("personal", "Last name is still empty"));
  }
  if (!filled(p.email)) {
    missing.push(item("personal", "Email is still empty"));
  } else if (!fieldValidators.email(p.email)) {
    missing.push(item("personal", "Email doesn't look complete yet"));
  }

  // Work Experience — at least one real role with title, company, start
  // date and one usable bullet. Blank stub cards are ignored.
  const roles = realExperience(data);
  if (roles.length === 0) {
    missing.push(
      item(
        "experience",
        "No roles yet — internships and volunteer work count too",
      ),
    );
  } else {
    roles.forEach((e, i) => {
      const nth = roles.length > 1 ? ` (role ${i + 1})` : "";
      if (!fieldValidators.entryText(e.role)) {
        missing.push(item("experience", `Job title is still empty${nth}`));
      }
      if (!fieldValidators.entryText(e.company)) {
        missing.push(item("experience", `Company is still empty${nth}`));
      }
      if (!fieldValidators.entryText(e.startDate)) {
        missing.push(item("experience", `Start date is still empty${nth}`));
      }
      if (!e.bullets.some((b) => fieldValidators.bullet(b))) {
        missing.push(
          item("experience", `Add at least one bullet${nth} — what did you do?`),
        );
      }
    });
  }

  // Education — at least one real entry with school, degree, start year.
  const schools = realEducation(data);
  if (schools.length === 0) {
    missing.push(item("education", "No education entries yet"));
  } else {
    schools.forEach((e, i) => {
      const nth = schools.length > 1 ? ` (entry ${i + 1})` : "";
      if (!fieldValidators.entryText(e.school)) {
        missing.push(item("education", `School is still empty${nth}`));
      }
      if (!fieldValidators.entryText(e.degree)) {
        missing.push(item("education", `Degree is still empty${nth}`));
      }
      if (!fieldValidators.entryText(e.startDate)) {
        missing.push(item("education", `Start year is still empty${nth}`));
      }
    });
  }

  // Skills — at least one.
  if (!data.skills.some((s) => filled(s.name))) {
    missing.push(item("skills", "Add at least one skill"));
  }

  return missing;
}

export function getSectionMissing(
  sectionId: SectionId,
  data: CvData,
): MissingItem[] {
  return getMissingItems(data).filter((m) => m.sectionId === sectionId);
}

export function getFirstIncompleteSection(data: CvData): SectionId | null {
  return getMissingItems(data)[0]?.sectionId ?? null;
}

// ── Section completeness — for ALL sections, required and optional ─────────
//
// Required sections: complete ⇔ no missing items.
// Optional sections: "complete" means "has real content" (drives the green
// check bead) and can never be *incomplete-with-warnings* — they are either
// done or neutral. Semantics ported 1:1 from the previous
// lib/utils/stepValidation implementation so bead behavior is unchanged.

export function isSectionComplete(
  sectionId: SectionId,
  data: CvData,
): boolean {
  switch (sectionId) {
    case "personal":
    case "experience":
    case "education":
    case "skills":
      return getSectionMissing(sectionId, data).length === 0;
    case "uaeEssentials": {
      const p = data.personal;
      return Boolean(
        filled(p.visaStatus) ||
          filled(p.availability) ||
          filled(p.drivingLicense) ||
          filled(p.nationality),
      );
    }
    case "summary":
      if (!filled(data.personal.summary)) return false;
      return summarySchema.safeParse({ summary: data.personal.summary }).success;
    case "languages":
      if (data.languages.length === 0) return false;
      return languagesSchema.safeParse({ languages: data.languages }).success;
    case "certifications":
      if (data.certifications.length === 0) return false;
      return certificationsSchema.safeParse({ certifications: data.certifications }).success;
    case "projects": {
      const sanitized = (data.projects ?? [])
        .filter((p) => !isBlankProject(p))
        .map((p) => ({ ...p, bullets: p.bullets.filter((b) => b.trim()) }));
      if (sanitized.length === 0) return false;
      return projectsSchema.safeParse({ projects: sanitized }).success;
    }
    case "review":
      // Review is complete when every required section is (audit §4c —
      // a blank CV must never show a green Review bead).
      return getMissingItems(data).length === 0;
    default:
      return false;
  }
}

/** True for sections whose incompleteness is allowed to warn (amber dot,
 *  leave toast, export dialog). Optional sections never warn. */
export function isRequiredSection(sectionId: SectionId): boolean {
  return Boolean(builderSteps.find((s) => s.id === sectionId)?.required);
}
