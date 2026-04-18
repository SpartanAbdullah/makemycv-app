// Shared types for the unified scoring engine and ATS resume checker feature.
// Keep ParseSignals separate from CvData — signals come from the parser, not the CV.

import type { CvData } from "../types/cv";

// --- Parser signals (checker-only) ---

export type ExtractionConfidence = "high" | "medium" | "low";

export type SpellingIssue = {
  word: string;
  context: string;
  suggestion: string;
};

export type ParseSignals = {
  hasTables: boolean;
  hasImages: boolean;
  hasUnusualFormatting: boolean;
  spellingIssues: SpellingIssue[];
  extractionConfidence: ExtractionConfidence;
};

// --- Unified score engine types ---

export type ScoreCategoryId =
  | "content"
  | "sections"
  | "atsEssentials"
  | "design";

export type ScoreSeverity = "good" | "review" | "error";

export type ScoreGrade = "excellent" | "good" | "needs-work" | "poor";

export type ScoreIssue = {
  id: string;
  severity: ScoreSeverity;
  title: string;
  description: string;
  actionable: string;
  /** Which sub-signal this ties to — stable key for weight tuning and tests. */
  signal?: string;
};

export type ScoreFaq = {
  q: string;
  a: string;
};

export type ScoreCategory = {
  id: ScoreCategoryId;
  name: string;
  /** 0–100 within the category, normalised for the applicable point budget. */
  score: number;
  /** Canonical contribution to total (0..1). Independent of parseSignals presence. */
  weight: number;
  status: ScoreSeverity;
  issues: ScoreIssue[];
  faqs: ScoreFaq[];
  // Legacy aliases — kept so older UI that reads `.category` / `.label`
  // keeps working until every consumer is migrated to `.id` / `.name`.
  /** @deprecated use .id */
  category: ScoreCategoryId;
  /** @deprecated use .name */
  label: string;
};

export type ScoreReport = {
  /** 0–100 weighted total. Normalised so builder mode (no parseSignals) and
   *  checker mode (parseSignals present) produce the same number when the
   *  non-conditional sub-signals match. */
  total: number;
  grade: ScoreGrade;
  /** Non-good issues broken down by severity — drives sidebar counters. */
  issueCounts: { error: number; review: number; good: number };
  categories: ScoreCategory[];
  // Legacy aliases — kept so older UI that reads `.status` (severity-like)
  // or `.issueCount` as a flat integer keeps working until migration completes.
  /** @deprecated use .grade; kept as a category-like severity for legacy UI. */
  status: ScoreSeverity;
  /** @deprecated use .issueCounts.error + .issueCounts.review */
  issueCount: number;
};

// --- Persistence shapes ---

export type CheckerReport = {
  cv: CvData;
  parseSignals: ParseSignals;
  score: ScoreReport;
  createdAt: number;
};

export type StoredReport = CheckerReport & {
  rawText: string; // server-only; never returned to client
};

// --- Legacy aliases (kept so existing imports keep compiling during migration) ---

/** @deprecated use ScoreCategoryId */
export type CheckerCategoryKey = ScoreCategoryId;
/** @deprecated use ScoreSeverity */
export type CheckerSeverity = ScoreSeverity;
/** @deprecated use ScoreIssue */
export type CheckerIssue = ScoreIssue;
/** @deprecated use ScoreFaq */
export type CheckerFaq = ScoreFaq;
/** @deprecated use ScoreCategory */
export type CheckerCategory = ScoreCategory;
/** @deprecated use ScoreReport */
export type CheckerScoreResult = ScoreReport;
