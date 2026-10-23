/**
 * UAE Essentials vocabularies — ONE source for the select options in the
 * UAE Essentials step and for the import parser's value mapping
 * (2026-10-24, audit F17/F24 / WP-2).
 *
 * Why this exists: the checker/import parser used to copy whatever text
 * followed "Visa:" straight into `personal.visaStatus`. A builder-made CV
 * prints all four essentials on one line, so the whole line
 * ("Employment visa · Available: 30 days notice · DL: …") landed in the visa
 * field: the select showed nothing selected while every template printed the
 * garbage. Values must be one of the options the step can display, or they
 * must not be stored at all — they go to the review screen's "couldn't place"
 * bucket instead, where the user can re-enter them.
 *
 * Mapping is conservative by design (detect, never assert): a bare
 * "Driving licence: Valid" is NOT turned into "Light Vehicle", because the
 * CV did not say so. Nationality stays free text.
 */

export const VISA_STATUS_OPTIONS = [
  "UAE National",
  "GCC National",
  "Family sponsorship",
  "Employment visa",
  "Golden Visa",
  "Green Visa",
  "Freelance permit",
  "Investor visa",
  "Visit visa",
  "Cancelled / transferable",
] as const;

export const AVAILABILITY_OPTIONS = [
  "Immediate",
  "2 weeks notice",
  "30 days notice",
  "60 days notice",
  "90 days notice",
] as const;

export const DRIVING_LICENCE_OPTIONS = [
  "Light Vehicle",
  "Heavy Vehicle",
  "Motorcycle",
  "International licence",
  "None",
] as const;

export type VisaStatusOption = (typeof VISA_STATUS_OPTIONS)[number];
export type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[number];
export type DrivingLicenceOption = (typeof DRIVING_LICENCE_OPTIONS)[number];

const clean = (raw: string) => raw.trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "");

function exactOption<T extends readonly string[]>(options: T, raw: string): T[number] | null {
  const c = clean(raw).toLowerCase();
  for (const o of options) if (o.toLowerCase() === c) return o;
  return null;
}

/** "Employment Visa", "employment", "golden visa holder" → an option, else null. */
export function normalizeVisaStatus(raw: string): VisaStatusOption | null {
  const exact = exactOption(VISA_STATUS_OPTIONS, raw);
  if (exact) return exact;
  const v = clean(raw).toLowerCase();
  if (!v) return null;
  if (/\b(uae national|emirati|uae citizen)\b/.test(v)) return "UAE National";
  if (/\bgcc\b/.test(v)) return "GCC National";
  if (/\b(family|spouse|husband|wife|father|parent|dependent|dependant)\b/.test(v)) return "Family sponsorship";
  if (/\bgolden\b/.test(v)) return "Golden Visa";
  if (/\bgreen\b/.test(v)) return "Green Visa";
  if (/\bfreelanc/.test(v)) return "Freelance permit";
  if (/\b(investor|partner)\b/.test(v)) return "Investor visa";
  if (/\b(visit|tourist)\b/.test(v)) return "Visit visa";
  // "Cancelled" wins outright; "transferable" alone only when no live visa
  // type is named — "Employment visa (transferable)" is still an employment
  // visa (the word-export fixture).
  if (/\b(cancel\w*|nol)\b/.test(v)) return "Cancelled / transferable";
  if (/\b(employment|work|company)\b/.test(v)) return "Employment visa";
  if (/\b(transferable|transferrable)\b/.test(v)) return "Cancelled / transferable";
  return null;
}

/** "Immediately", "1 month", "30 days", "two weeks" → an option, else null. */
export function normalizeAvailability(raw: string): AvailabilityOption | null {
  const exact = exactOption(AVAILABILITY_OPTIONS, raw);
  if (exact) return exact;
  const v = clean(raw).toLowerCase();
  if (!v) return null;
  if (/\b(immediate|immediately|now|asap|available now)\b/.test(v)) return "Immediate";
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, six: 6, twelve: 12 };
  const num = (s: string) => (words[s] ?? Number.parseInt(s, 10));
  const m = v.match(/(\d+|one|two|three|four|six|twelve)\s*(-|to)?\s*(\d+)?\s*(day|days|week|weeks|month|months)\b/);
  if (!m) return null;
  const n = num(m[1]);
  const unit = m[4];
  let days = unit.startsWith("day") ? n : unit.startsWith("week") ? n * 7 : n * 30;
  if (unit.startsWith("month") && n === 1) days = 30;
  if (days <= 0) return null;
  if (days <= 16) return "2 weeks notice";
  if (days <= 45) return "30 days notice";
  if (days <= 75) return "60 days notice";
  if (days <= 120) return "90 days notice";
  return null;
}

/** "Light vehicle", "LMV", "Heavy", "international" → an option, else null. */
export function normalizeDrivingLicence(raw: string): DrivingLicenceOption | null {
  const exact = exactOption(DRIVING_LICENCE_OPTIONS, raw);
  if (exact) return exact;
  const v = clean(raw).toLowerCase();
  if (!v) return null;
  if (/\b(none|no|not yet|n\/a|nil)\b/.test(v)) return "None";
  if (/\b(heavy|hgv|truck|bus|lorry)\b/.test(v)) return "Heavy Vehicle";
  if (/\b(motor ?cycle|motorbike|bike|two[- ]wheeler)\b/.test(v)) return "Motorcycle";
  if (/\b(international|idp)\b/.test(v)) return "International licence";
  if (/\b(light|lmv|automatic|manual|car|saloon)\b/.test(v)) return "Light Vehicle";
  return null;
}
