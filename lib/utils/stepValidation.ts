import type { CvData, CvEducation, CvExperience, CvProject } from "../types/cv";
import {
  personalSchema,
  summarySchema,
  experienceSchema,
  educationSchema,
  skillsSchema,
  languagesSchema,
  certificationsSchema,
  projectsSchema,
} from "../schemas/cvSchemas";
import { BuilderStep, builderSteps } from "./steps";

const isEmptyArray = (arr: Array<{ [key: string]: unknown }> = []) =>
  arr.length === 0;

/*
 * Sanitization before validation (audit §4 symptom a).
 *
 * The store seeds every new experience with `bullets: [""]` and "Add
 * another role" appends a fully blank entry. The zod schemas validate
 * EVERY array element, so one leftover "" bullet or one untouched stub
 * marked the whole step incomplete — while the score engine (which
 * filters blank stubs, lib/scoreEngine.ts) called the same section
 * populated. "Missing sections: Work Experience" with a filled entry
 * was exactly this divergence. We mirror the engine's filtering here so
 * the two paths can never disagree about whether a section has content.
 */

const isBlankExperience = (e: CvExperience) =>
  !e.company.trim() &&
  !e.role.trim() &&
  !e.startDate.trim() &&
  !(e.endDate ?? "").trim() &&
  !e.bullets.some((b) => b.trim());

const sanitizeExperience = (entries: CvExperience[]) =>
  entries
    .filter((e) => !isBlankExperience(e))
    .map((e) => ({ ...e, bullets: e.bullets.filter((b) => b.trim()) }));

const isBlankEducation = (e: CvEducation) =>
  !e.school.trim() && !e.degree.trim() && !e.startDate.trim() && !(e.endDate ?? "").trim();

const sanitizeEducation = (entries: CvEducation[]) =>
  entries.filter((e) => !isBlankEducation(e));

const isBlankProject = (p: CvProject) =>
  !p.name.trim() && !p.bullets.some((b) => b.trim());

const sanitizeProjects = (entries: CvProject[]) =>
  entries
    .filter((p) => !isBlankProject(p))
    .map((p) => ({ ...p, bullets: p.bullets.filter((b) => b.trim()) }));

export const getStepCompletion = (step: BuilderStep, data: CvData): boolean => {
  switch (step.id) {
    case "personal":
      return personalSchema.safeParse(data.personal).success;
    case "uaeEssentials": {
      // Optional step. Counts as "done" if the user has filled at least one
      // UAE essential (visa / availability / driving licence). Extras (DOB,
      // nationality, etc.) live on the same step but don't count toward
      // completion — they're nice-to-haves, not the UAE-recruiter signal.
      const p = data.personal;
      return Boolean(
        (p.visaStatus && p.visaStatus.trim()) ||
          (p.availability && p.availability.trim()) ||
          (p.drivingLicense && p.drivingLicense.trim()),
      );
    }
    case "summary":
      if (!data.personal.summary) return false;
      return summarySchema.safeParse({ summary: data.personal.summary }).success;
    case "experience": {
      const sanitized = sanitizeExperience(data.experience);
      if (sanitized.length === 0) return false;
      return experienceSchema.safeParse({ experience: sanitized }).success;
    }
    case "education": {
      const sanitized = sanitizeEducation(data.education);
      if (sanitized.length === 0) return false;
      return educationSchema.safeParse({ education: sanitized }).success;
    }
    case "skills":
      return skillsSchema.safeParse({ skills: data.skills }).success;
    case "languages":
      if (isEmptyArray(data.languages)) return false;
      return languagesSchema.safeParse({ languages: data.languages }).success;
    case "certifications":
      if (isEmptyArray(data.certifications)) return false;
      return certificationsSchema.safeParse({ certifications: data.certifications }).success;
    case "projects": {
      const sanitized = sanitizeProjects(data.projects ?? []);
      if (sanitized.length === 0) return false;
      return projectsSchema.safeParse({ projects: sanitized }).success;
    }
    case "review":
      // A blank CV used to show a green Review check from first load
      // because this was hardcoded `true` (audit §4 symptom c). Review is
      // complete when every REQUIRED step is complete.
      return builderSteps
        .filter((s) => s.required && s.id !== "review")
        .every((s) => getStepCompletion(s, data));
    default:
      return false;
  }
};
