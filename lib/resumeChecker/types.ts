// Shared types for the ATS resume checker feature.
// Keep ParseSignals separate from CvData — signals come from the parser, not the CV.

import type { CvData } from "../types/cv";

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

export type CheckerCategoryKey =
  | "content"
  | "sections"
  | "atsEssentials"
  | "design";

export type CheckerSeverity = "good" | "review" | "error";

export type CheckerIssue = {
  id: string;
  severity: CheckerSeverity;
  title: string;
  description: string;
  actionable: string;
};

export type CheckerFaq = {
  q: string;
  a: string;
};

export type CheckerCategory = {
  category: CheckerCategoryKey;
  label: string;
  score: number; // 0–100
  status: CheckerSeverity;
  weight: number; // contribution to overall score (0–1)
  issues: CheckerIssue[];
  faqs: CheckerFaq[];
};

export type CheckerScoreResult = {
  total: number; // 0–100, weighted
  status: CheckerSeverity;
  issueCount: number;
  categories: CheckerCategory[];
};

export type CheckerReport = {
  cv: CvData;
  parseSignals: ParseSignals;
  score: CheckerScoreResult;
  createdAt: number;
};

export type StoredReport = CheckerReport & {
  rawText: string; // server-only; never returned to client
};
