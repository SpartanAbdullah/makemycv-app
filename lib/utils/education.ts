import type { CvEducation } from "../types/cv";

/**
 * An education entry earns a place on the rendered CV only if it names a real
 * qualification — a school, a degree, or a field of study.
 *
 * The store seeds defaultCvData with one BLANK education entry
 * (lib/store/cvStore.ts), so without this filter a user who skips the
 * Education step ships a ghost "Education" heading with a "Degree"
 * placeholder. Mirrors lib/utils/projects.ts.
 */
export const isMeaningfulEducation = (edu: CvEducation): boolean =>
  Boolean(edu.school?.trim() || edu.degree?.trim() || edu.field?.trim());

export const meaningfulEducation = (
  education: CvEducation[],
): CvEducation[] => education.filter(isMeaningfulEducation);

/**
 * The field of study, or "" when the degree text already names it.
 *
 * Users type "BSc Finance" as the degree and "Finance" as the field, and
 * every template used to print both ("BSc Finance · Finance"). Template
 * audit 2026-10 defect 36. Case-insensitive substring match, mirroring the
 * rule Gulf Standard and Banner shipped with.
 */
export const distinctField = (degree?: string, field?: string): string => {
  const d = degree?.trim() ?? "";
  const f = field?.trim() ?? "";
  if (!f) return "";
  if (d && d.toLowerCase().includes(f.toLowerCase())) return "";
  return f;
};

/**
 * The degree line of an education entry: degree, then the field joined with
 * the template's own joiner (" · ", " — ", " in ", " - ") unless the degree
 * already contains it. Falls back to the field alone, then to "Degree".
 * Shared by the live templates and the PDF so both print the same words.
 */
export const educationTitle = (
  degree: string | undefined,
  field: string | undefined,
  joiner: string,
): string => {
  const d = degree?.trim() ?? "";
  const f = distinctField(d, field);
  if (!d) return f || "Degree";
  return f ? `${d}${joiner}${f}` : d;
};

/**
 * The attestation marker, identical in the preview and the download.
 *
 * No tick glyph: U+2713 has no glyph in any embedded PDF face (Inter,
 * Bricolage, Instrument Serif), so the download printed a notdef box before
 * "Attested" while the preview printed a tick (template audit 2026-10
 * defect 21). "Attested — body" when an attesting body was given, else the
 * bare word; `uppercase` is for the Executive pill ("ATTESTED — body").
 */
export const attestedLabel = (
  attestingBody?: string,
  uppercase = false,
): string => {
  const word = uppercase ? "ATTESTED" : "Attested";
  const body = attestingBody?.trim() ?? "";
  return body ? `${word} — ${body}` : word;
};
