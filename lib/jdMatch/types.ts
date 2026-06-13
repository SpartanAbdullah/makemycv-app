/**
 * JD Match — shared types (Phase A: free diagnosis).
 * See docs/jd-match-spec.md.
 */

// The five requirement buckets we extract from a job description. Ordered by
// how much they weigh in the match score (see match.ts WEIGHTS).
export type JdCategory =
  | "hardSkills"
  | "tools"
  | "certifications"
  | "softSkills"
  | "keywords";

export const JD_CATEGORY_LABELS: Record<JdCategory, string> = {
  hardSkills: "Hard skills",
  tools: "Tools & software",
  certifications: "Certifications & licences",
  softSkills: "Soft skills",
  keywords: "Other keywords",
};

// Structured requirements extracted from the JD by the server (Haiku).
// Every field is a plain string array so the client matcher stays simple and
// the API contract is trivial to validate.
export type JdRequirements = {
  jobTitle?: string;
  hardSkills: string[];
  tools: string[];
  certifications: string[];
  softSkills: string[];
  keywords: string[];
};

// One requirement term after matching against the CV.
export type JdTerm = {
  term: string;
  category: JdCategory;
  matched: boolean;
};

// Per-category rollup for the UI.
export type JdCategoryResult = {
  category: JdCategory;
  matched: string[];
  missing: string[];
};

export type JdMatchBand = "strong" | "good" | "partial" | "low";

export type JdMatchResult = {
  score: number; // 0–100, weighted
  band: JdMatchBand;
  jobTitle?: string;
  terms: JdTerm[];
  categories: JdCategoryResult[];
  totalRequirements: number;
  matchedCount: number;
};

export const JD_BAND_LABELS: Record<JdMatchBand, string> = {
  strong: "Strong match",
  good: "Good match — close the gaps",
  partial: "Partial — tailor your CV",
  low: "Low match — significant gaps",
};

export const JD_MIN_TEXT = 40; // chars; below this we ask for a fuller paste
