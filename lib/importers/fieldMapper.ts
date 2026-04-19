// Maps a ParsedDocument (from any import adapter) into a partial CvData object.
// The result is shown in MappingReview for user confirmation before merging.

import type { CvData } from "../types/cv";
import type { ParsedDocument, ParsedExperience } from "./adapter";
import { createId } from "../utils/id";
import { defaultCvData } from "../store/cvStore";

/**
 * Seed a professional headline when the parser didn't produce one.
 *
 * Heuristic (in order):
 *   1. Use experience[0].role if that entry is marked isCurrent.
 *   2. Otherwise pick the most recent experience — a missing endDate reads
 *      as "still there", else the entry with the latest endDate string.
 *   3. If no experience exists, leave headline blank (don't invent).
 *
 * We never concat role + company — recruiters read the headline as a
 * target job-title, not a past-role sentence.
 */
function seedHeadline(experience: ParsedExperience[] | undefined): string {
  if (!experience || experience.length === 0) return "";

  const currentRole = experience.find(
    (e) => e.isCurrent && (e.role ?? "").trim(),
  );
  if (currentRole?.role) return currentRole.role.trim();

  // Prefer an entry without an endDate (implicit "current").
  const openEnded = experience.find(
    (e) => (e.role ?? "").trim() && !e.endDate,
  );
  if (openEnded?.role) return openEnded.role.trim();

  // Fall back to the most recent endDate lexical-compare (YYYY-MM sorts correctly).
  const withEnd = experience
    .filter((e) => (e.role ?? "").trim() && (e.endDate ?? "").trim())
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));
  if (withEnd[0]?.role) return withEnd[0].role.trim();

  return experience[0].role?.trim() ?? "";
}

export const mapParsedToCv = (parsed: ParsedDocument): Partial<CvData> => {
  const result: Partial<CvData> = {};

  if (parsed.contact || parsed.summary) {
    const nameParts = (parsed.contact?.name ?? "").trim().split(/\s+/);
    result.personal = {
      ...defaultCvData.personal,
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      email: parsed.contact?.email ?? "",
      phone: parsed.contact?.phone ?? "",
      location: parsed.contact?.location ?? "",
      linkedin: parsed.contact?.linkedin ?? "",
      website: parsed.contact?.website ?? "",
      summary: parsed.summary ?? "",
      headline: seedHeadline(parsed.experience),
    };
  }

  if (parsed.experience?.length) {
    result.experience = parsed.experience
      .filter((exp) => exp.role || exp.company)
      .map((exp) => ({
        id: createId(),
        company: exp.company ?? "",
        role: exp.role ?? "",
        location: exp.location ?? "",
        startDate: exp.startDate ?? "",
        endDate: exp.endDate ?? "",
        isCurrent: exp.isCurrent ?? false,
        bullets: exp.bullets?.filter(Boolean) ?? [""],
      }));
  }

  if (parsed.education?.length) {
    result.education = parsed.education
      .filter((edu) => edu.school || edu.degree)
      .map((edu) => ({
        id: createId(),
        school: edu.school ?? "",
        degree: edu.degree ?? "",
        field: edu.field ?? "",
        startDate: edu.startDate ?? "",
        endDate: edu.endDate ?? "",
        notes: edu.notes ?? "",
      }));
  }

  if (parsed.skills?.length) {
    result.skills = parsed.skills
      .filter(Boolean)
      .map((name) => ({ id: createId(), name }));
  }

  if (parsed.languages?.length) {
    result.languages = parsed.languages
      .filter(Boolean)
      .map((name) => ({ id: createId(), name }));
  }

  if (parsed.certifications?.length) {
    result.certifications = parsed.certifications
      .filter((c) => c.name)
      .map((c) => ({
        id: createId(),
        name: c.name ?? "",
        issuer: c.issuer ?? "",
        date: c.date ?? "",
      }));
  }

  return result;
};
