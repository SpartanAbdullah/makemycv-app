/**
 * JD Match — deterministic matcher (Phase A). Runs client-side.
 *
 * Given structured requirements (extracted from the JD by the server) and the
 * user's CV, decides which requirements the CV satisfies, produces a weighted
 * 0–100 score, and groups matched/missing terms by category.
 *
 * This is deliberately NOT computeScore() — that measures CV *quality*; this
 * measures *overlap* with one JD. Different metric, separate module.
 */
import type { CvData } from "../types/cv";
import { extractCvCorpus, normalizeText } from "./extractCvText";
import {
  type JdCategory,
  type JdCategoryResult,
  type JdMatchBand,
  type JdMatchResult,
  type JdRequirements,
  type JdTerm,
} from "./types";

// How much each category counts toward the score. Hard skills and tools are
// what ATS keyword filters weight most; generic keywords least.
const WEIGHTS: Record<JdCategory, number> = {
  hardSkills: 3,
  tools: 3,
  certifications: 2,
  softSkills: 1,
  keywords: 1,
};

const CATEGORY_ORDER: JdCategory[] = [
  "hardSkills",
  "tools",
  "certifications",
  "softSkills",
  "keywords",
];

/**
 * Small alias map so common variants count as a match. Keys and values are
 * normalized (lowercase). If a requirement term equals a key, any of its
 * aliases also counts as present in the CV (and vice-versa).
 */
const ALIASES: Record<string, string[]> = {
  excel: ["microsoft excel", "ms excel", "spreadsheets"],
  "microsoft excel": ["excel", "ms excel"],
  powerpoint: ["microsoft powerpoint", "ms powerpoint", "ppt"],
  word: ["microsoft word", "ms word"],
  "ms office": ["microsoft office", "office 365", "msoffice"],
  photoshop: ["adobe photoshop"],
  illustrator: ["adobe illustrator"],
  "google ads": ["adwords", "google adwords"],
  ga4: ["google analytics", "google analytics 4"],
  "google analytics": ["ga4"],
  sql: ["mysql", "postgresql", "t sql", "pl sql"],
  javascript: ["js", "es6", "ecmascript"],
  typescript: ["ts"],
  "react": ["react.js", "reactjs"],
  "node": ["node.js", "nodejs"],
  ifrs: ["international financial reporting standards"],
  vat: ["value added tax", "fta vat"],
  "project management": ["pmp", "prince2", "project manager"],
  crm: ["salesforce", "hubspot", "zoho crm"],
  erp: ["sap", "oracle erp", "odoo", "ms dynamics", "microsoft dynamics"],
  communication: ["communication skills", "verbal communication", "written communication"],
  leadership: ["team leadership", "people management", "team management"],
  "customer service": ["client service", "customer support", "client relations"],
};

function aliasForms(term: string): string[] {
  const t = normalizeText(term);
  const forms = new Set<string>([t]);
  if (ALIASES[t]) ALIASES[t].forEach((a) => forms.add(normalizeText(a)));
  // Reverse lookup: term might be an alias of a canonical key.
  for (const [key, vals] of Object.entries(ALIASES)) {
    if (vals.map(normalizeText).includes(t)) {
      forms.add(normalizeText(key));
      vals.forEach((v) => forms.add(normalizeText(v)));
    }
  }
  return [...forms].filter(Boolean);
}

/**
 * Whole-token / phrase containment. Builds a space-padded corpus so single
 * tokens match on word boundaries (avoids "java" matching "javascript"),
 * while multi-word phrases use plain substring containment.
 */
function corpusHas(paddedCorpus: string, form: string): boolean {
  if (!form) return false;
  if (form.includes(" ")) {
    return paddedCorpus.includes(form);
  }
  return paddedCorpus.includes(` ${form} `);
}

function isMatched(paddedCorpus: string, term: string): boolean {
  return aliasForms(term).some((f) => corpusHas(paddedCorpus, f));
}

function bandFor(score: number): JdMatchBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "partial";
  return "low";
}

/** Dedupe + trim a requirement list, dropping empties and overlong noise. */
function cleanList(list: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    const term = raw.trim();
    if (!term || term.length > 60) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export function matchRequirementsToCv(
  requirements: JdRequirements,
  cv: CvData,
): JdMatchResult {
  const paddedCorpus = ` ${extractCvCorpus(cv)} `;

  const terms: JdTerm[] = [];
  for (const category of CATEGORY_ORDER) {
    for (const term of cleanList(requirements[category])) {
      terms.push({ term, category, matched: isMatched(paddedCorpus, term) });
    }
  }

  // Weighted score.
  let weightedTotal = 0;
  let weightedMatched = 0;
  for (const t of terms) {
    const w = WEIGHTS[t.category];
    weightedTotal += w;
    if (t.matched) weightedMatched += w;
  }
  const score =
    weightedTotal === 0
      ? 0
      : Math.round((weightedMatched / weightedTotal) * 100);

  // Per-category rollup, preserving category order and dropping empty ones.
  const categories: JdCategoryResult[] = CATEGORY_ORDER.map((category) => {
    const inCat = terms.filter((t) => t.category === category);
    return {
      category,
      matched: inCat.filter((t) => t.matched).map((t) => t.term),
      missing: inCat.filter((t) => !t.matched).map((t) => t.term),
    };
  }).filter((c) => c.matched.length + c.missing.length > 0);

  return {
    score,
    band: bandFor(score),
    jobTitle: requirements.jobTitle?.trim() || undefined,
    terms,
    categories,
    totalRequirements: terms.length,
    matchedCount: terms.filter((t) => t.matched).length,
  };
}
