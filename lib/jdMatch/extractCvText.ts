/**
 * Flatten a CvData object into a normalized text corpus for JD matching.
 * Runs client-side only — the CV never leaves the browser (PDPL, see spec).
 */
import type { CvData } from "../types/cv";

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ") // keep + # . (c++, c#, node.js, ga4)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build one normalized string containing everything a JD requirement might
 * match against: headline, summary, role titles + companies + bullets,
 * skills, certifications, education fields, project names + bullets,
 * languages, and UAE-essentials (visa/nationality/driving licence).
 */
export function extractCvCorpus(cv: CvData): string {
  const parts: string[] = [];

  const p = cv.personal;
  parts.push(p.headline, p.summary, p.nationality ?? "", p.visaStatus ?? "");
  if (p.drivingLicense) parts.push("driving licence", p.drivingLicense);

  for (const role of cv.experience) {
    parts.push(role.role, role.company, role.location);
    parts.push(...role.bullets);
  }
  for (const edu of cv.education) {
    parts.push(edu.school, edu.degree, edu.field, edu.notes ?? "");
    if (edu.attested) parts.push("attested", edu.attestingBody ?? "");
  }
  for (const skill of cv.skills) parts.push(skill.name);
  for (const lang of cv.languages) parts.push(lang.name);
  for (const cert of cv.certifications) parts.push(cert.name, cert.issuer);
  for (const proj of cv.projects) {
    parts.push(proj.name);
    parts.push(...proj.bullets);
  }

  return normalizeText(parts.filter(Boolean).join(" "));
}
