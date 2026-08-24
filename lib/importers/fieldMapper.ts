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

  const hasUae =
    parsed.uae &&
    Object.values(parsed.uae).some((v) => (v ?? "").trim().length > 0);

  if (parsed.contact || parsed.summary || hasUae) {
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
      headline: parsed.contact?.headline?.trim() || seedHeadline(parsed.experience),
      // UAE recruiter signals from labeled lines (wave-3 parser work) —
      // these land directly in the UAE Essentials fields.
      nationality: parsed.uae?.nationality ?? "",
      visaStatus: parsed.uae?.visaStatus ?? "",
      availability: parsed.uae?.availability ?? "",
      drivingLicense: parsed.uae?.drivingLicense ?? "",
      dateOfBirth: parsed.uae?.dateOfBirth ?? "",
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
        attested: edu.attested ?? false,
        attestingBody: edu.attestingBody ?? "",
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

  // Projects were detected by the parser but silently discarded before the
  // 2026-06 wave-3 work — now they round-trip into the builder.
  if (parsed.projects?.length) {
    result.projects = parsed.projects
      .filter((p) => (p.name ?? "").trim() || p.bullets?.length)
      .map((p) => ({
        id: createId(),
        name: p.name ?? "",
        link: p.link ?? "",
        bullets: p.bullets?.filter(Boolean).length
          ? p.bullets.filter(Boolean)
          : [""],
      }));
  }

  return result;
};

/**
 * Inverse mapping: CvData → ParsedDocument. Used by the report→builder
 * handoff so the AI-parsed CV flows through the SAME MappingReview screen
 * as the heuristic import, instead of landing in the store unreviewed
 * (audit UX-8). Skill/language levels aren't representable in
 * ParsedDocument, but the checker's CVs never carry them anyway — they
 * were produced by mapParsedToCv in the first place.
 */
export const mapCvToParsed = (cv: CvData): ParsedDocument => ({
  contact: {
    name:
      [cv.personal.firstName, cv.personal.lastName]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" ") || undefined,
    headline: cv.personal.headline || undefined,
    email: cv.personal.email || undefined,
    phone: cv.personal.phone || undefined,
    location: cv.personal.location || undefined,
    linkedin: cv.personal.linkedin || undefined,
    website: cv.personal.website || undefined,
  },
  summary: cv.personal.summary ?? "",
  experience: cv.experience.map((e) => ({
    company: e.company,
    role: e.role,
    location: e.location,
    startDate: e.startDate,
    endDate: e.endDate,
    isCurrent: e.isCurrent,
    bullets: e.bullets.filter(Boolean),
  })),
  education: cv.education.map((e) => ({
    school: e.school,
    degree: e.degree,
    field: e.field,
    startDate: e.startDate,
    endDate: e.endDate,
    notes: e.notes,
    attested: e.attested,
    attestingBody: e.attestingBody,
  })),
  skills: cv.skills.map((s) => s.name).filter(Boolean),
  languages: cv.languages.map((l) => l.name).filter(Boolean),
  certifications: cv.certifications.map((c) => ({
    name: c.name,
    issuer: c.issuer,
    date: c.date,
  })),
  projects: (cv.projects ?? []).map((p) => ({
    name: p.name,
    link: p.link,
    bullets: p.bullets.filter(Boolean),
  })),
  uae: {
    nationality: cv.personal.nationality || undefined,
    visaStatus: cv.personal.visaStatus || undefined,
    availability: cv.personal.availability || undefined,
    drivingLicense: cv.personal.drivingLicense || undefined,
    dateOfBirth: cv.personal.dateOfBirth || undefined,
  },
});
