import type { CvData } from "../types/cv";
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
import { BuilderStep } from "./steps";

const isEmptyArray = (arr: Array<{ [key: string]: unknown }> = []) =>
  arr.length === 0;

export const getStepCompletion = (step: BuilderStep, data: CvData) => {
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
    case "experience":
      return experienceSchema.safeParse({ experience: data.experience }).success;
    case "education":
      return educationSchema.safeParse({ education: data.education }).success;
    case "skills":
      return skillsSchema.safeParse({ skills: data.skills }).success;
    case "languages":
      if (isEmptyArray(data.languages)) return false;
      return languagesSchema.safeParse({ languages: data.languages }).success;
    case "certifications":
      if (isEmptyArray(data.certifications)) return false;
      return certificationsSchema.safeParse({ certifications: data.certifications }).success;
    case "projects":
      if (isEmptyArray(data.projects)) return false;
      return projectsSchema.safeParse({ projects: data.projects }).success;
    case "review":
      return true;
    default:
      return false;
  }
};
