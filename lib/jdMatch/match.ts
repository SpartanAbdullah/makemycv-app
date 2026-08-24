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
import { extractCvCorpus, normalizeText, PHRASE_BOUNDARY } from "./extractCvText";
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
export const WEIGHTS: Record<JdCategory, number> = {
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
 * True synonym / variant groups — fully SYMMETRIC. Every member is the same
 * thing as the key and as its siblings (Excel = MS Excel = spreadsheets), so a
 * requirement matching any one of them is satisfied by any other. Keys and
 * values are normalized (lowercase).
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
  javascript: ["js", "es6", "ecmascript"],
  typescript: ["ts"],
  "react": ["react.js", "reactjs"],
  "node": ["node.js", "nodejs"],
  ifrs: ["international financial reporting standards"],
  vat: ["value added tax", "fta vat"],
  communication: ["communication skills", "verbal communication", "written communication"],
  leadership: ["team leadership", "people management", "team management"],
  "customer service": ["client service", "customer support", "client relations"],
};

/**
 * Category (hypernym) groups — DELIBERATELY ONE-DIRECTIONAL. The key is a broad
 * category; the values are distinct, non-interchangeable products under it.
 * A requirement for the CATEGORY is satisfied by any member in the CV
 * ("CRM" ← a CV that lists "Salesforce"), but a requirement for a SPECIFIC
 * product is NOT satisfied by a sibling: a JD asking for "Salesforce" must not
 * be reported covered because the CV mentions "HubSpot", nor "SAP" by "Odoo",
 * nor the cert "PMP" by the role title "Project Manager". Specific members
 * therefore expand only to themselves (matched literally).
 */
const CATEGORY_MEMBERS: Record<string, string[]> = {
  crm: ["salesforce", "hubspot", "zoho crm"],
  erp: ["sap", "oracle erp", "odoo", "ms dynamics", "microsoft dynamics"],
  "project management": ["pmp", "prince2", "project manager"],
  sql: ["mysql", "postgresql", "t sql", "pl sql"],
};

/**
 * Alias forms that are ALSO ordinary English words. "React.js" expands to the
 * bare form "react", and a bullet reading "ability to react quickly to
 * changing conditions" then satisfied a JD asking for React — a false "your CV
 * covers this" on a technology the candidate has never touched.
 *
 * These forms are therefore looked up ONLY in the CV's DISCRETE named phrases
 * (skills, certifications, role titles, headline) — places where a word is a
 * claim, not prose. The unambiguous spellings ("react.js", "reactjs",
 * "node.js") still match anywhere in the CV, so a bullet that genuinely names
 * the technology is not lost.
 *
 * The trade-off is deliberate: "Built microservices in Go" no longer covers a
 * Go requirement unless Go is also listed as a skill. A missed match costs the
 * user one chip to add; a false match costs them the interview.
 */
const AMBIGUOUS_TECH_FORMS = new Set([
  "react",
  "node",
  "go",
  "rust",
  "swift",
  "ruby",
  "spring",
  "dart",
  "scratch",
  "processing",
]);

function aliasForms(term: string): string[] {
  const t = normalizeText(term);
  const forms = new Set<string>([t]);
  // Symmetric synonyms: key → variants, and variant → {key, siblings}.
  if (ALIASES[t]) ALIASES[t].forEach((a) => forms.add(normalizeText(a)));
  for (const [key, vals] of Object.entries(ALIASES)) {
    if (vals.map(normalizeText).includes(t)) {
      forms.add(normalizeText(key));
      vals.forEach((v) => forms.add(normalizeText(v)));
    }
  }
  // Category hypernyms: ONLY a requirement that IS the category key expands to
  // its members ("CRM" → salesforce/hubspot/…). A specific member never pulls
  // in its key or siblings, so "Salesforce" ≠ "HubSpot".
  if (CATEGORY_MEMBERS[t]) CATEGORY_MEMBERS[t].forEach((m) => forms.add(normalizeText(m)));
  return [...forms].filter(Boolean);
}

/**
 * Collapse phrase boundaries back to spaces. Applied to the REQUIREMENT side
 * only — asymmetry is the point. Punctuation in the CV means the words really
 * were separated ("washing machine; learning curve" is not machine learning),
 * but punctuation inside a requirement is just how the JD wrote it, and must
 * not stop it matching a CV that says the same thing without the brackets
 * ("Six Sigma (Green Belt)" ⟷ a CV listing "Six Sigma Green Belt").
 */
function flattenBoundaries(form: string): string {
  return form.split(PHRASE_BOUNDARY).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Whole-token / phrase containment. Builds a space-padded corpus so single
 * tokens match on word boundaries (avoids "java" matching "javascript"),
 * while multi-word phrases use plain substring containment.
 *
 * The corpus keeps its PHRASE_BOUNDARY sentinels, so the substring check can
 * no longer bridge punctuation the normalizer used to flatten away — the
 * false-positive class recorded in docs/jd-match-evidence-pass.md.
 */
function corpusHas(paddedCorpus: string, form: string): boolean {
  const f = flattenBoundaries(form);
  if (!f) return false;
  if (f.includes(" ")) {
    return paddedCorpus.includes(f);
  }
  return paddedCorpus.includes(` ${f} `);
}

/**
 * `paddedPhraseCorpus` is the narrow corpus (skills / certs / role titles /
 * headline). Only common-English alias forms are routed to it — see
 * AMBIGUOUS_TECH_FORMS.
 */
function isMatched(
  paddedCorpus: string,
  paddedPhraseCorpus: string,
  term: string,
): boolean {
  return aliasForms(term).some((f) =>
    corpusHas(
      AMBIGUOUS_TECH_FORMS.has(flattenBoundaries(f)) ? paddedPhraseCorpus : paddedCorpus,
      f,
    ),
  );
}

// ── Variant / abbreviation matching ──────────────────────────────────────────
//
// The corpus check above is literal (token / phrase containment). Real CVs word
// the same competency differently — "M365" vs "Microsoft 365", "Odoo
// Administration" vs "Odoo ERP Administration". So we ALSO compare each
// requirement against the CV's discrete skill / cert / role phrases by
// significant-token overlap, after expanding common abbreviations and
// light-stemming word families (administration↔administrator, etc.).
// Deliberately conservative: a match needs one phrase's significant tokens to
// be a SUBSET of the other's, so "java" never matches "javascript" and
// "Data Engineering" never matches "Data Management".

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bm[\s-]?365\b/g, "microsoft 365"],
  [/\bms[\s-]?365\b/g, "microsoft 365"],
  [/\bo[\s-]?365\b/g, "office 365"],
  [/\bms office\b/g, "microsoft office"],
  [/\bms teams\b/g, "microsoft teams"],
  [/\bms dynamics\b/g, "microsoft dynamics"],
  [/\bgcp\b/g, "google cloud platform"],
  [/\bk8s\b/g, "kubernetes"],
];

// Light, curated stems — collapse a word family to a shared root so
// "administration"/"administrator" and "management"/"manager" line up. NOT a
// general stemmer (too false-positive-prone).
const STEM_RULES: Array<[RegExp, string]> = [
  [/^admin(?:istrat(?:ion|or|ors|ive)|ister(?:ing)?)?$/, "admin"],
  [/^manag(?:ement|er|ers|ing|e)$/, "manage"],
  [/^develop(?:ment|er|ers|ing)?$/, "develop"],
  [/^engineer(?:ing|s)?$/, "engineer"],
  [/^analy(?:sis|st|sts|tics|ze|se|zing|sing)$/, "analy"],
  [/^config(?:uration|ure|uring)?$/, "config"],
  [/^implement(?:ation|ing|s)?$/, "implement"],
  [/^operat(?:ions?|ional|e|ing)$/, "operate"],
];

const TOKEN_STOPWORDS = new Set(["the", "of", "and", "in", "with", "for", "to", "on", "an", "a", "at", "by"]);

function stemToken(t: string): string {
  for (const [re, rep] of STEM_RULES) if (re.test(t)) return rep;
  return t;
}

// A phrase tokenised two ways: `raw` is the significant words after
// abbreviation expansion but BEFORE stemming; `stem` is the same words with
// word-families collapsed. We keep both so a variant match can require a
// verbatim shared anchor (raw) while still aligning families via the stem.
type TokenSets = { raw: Set<string>; stem: Set<string> };

function tokenize(s: string): TokenSets {
  let expanded = ` ${normalizeText(s)} `;
  for (const [re, rep] of ABBREVIATIONS) expanded = expanded.replace(re, ` ${rep} `);
  const raw = new Set<string>();
  for (const piece of expanded.split(/\s+/)) {
    const t = piece.trim();
    // The boundary sentinel is punctuation, not a word — variant matching
    // compares meaning, so it never participates. (The length guard below
    // would drop it too; this is explicit so lowering that guard can't
    // silently turn every comma into a shared "token".)
    if (t === PHRASE_BOUNDARY) continue;
    if (t.length < 2 || TOKEN_STOPWORDS.has(t)) continue;
    raw.add(t);
  }
  const stem = new Set<string>();
  for (const t of raw) stem.add(stemToken(t));
  return { raw, stem };
}

function isSubset(small: Set<string>, big: Set<string>): boolean {
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

function variantMatchTokens(a: TokenSets, b: TokenSets): boolean {
  if (a.stem.size === 0 || b.stem.size === 0) return false;
  const [small, big] = a.stem.size <= b.stem.size ? [a.stem, b.stem] : [b.stem, a.stem];
  if (!isSubset(small, big)) return false;
  // The match must rest on a DISTINCTIVE token (len ≥ 3) the two phrases share
  // VERBATIM (before stemming) — so stemming only aligns the *other* words
  // around a real shared anchor. This keeps "Project Manager" ↔ "Project
  // Management" (shared "project") and "Odoo Administration" ↔ "Odoo ERP
  // Administration" (shared "odoo"), but rejects "Manager" ↔ "Management",
  // whose only overlap is the collapsed stem "manage".
  for (const t of a.raw) if (t.length >= 3 && b.raw.has(t)) return true;
  return false;
}

/** True when two skill phrases are the same competency up to wording — used by
 *  the matcher (requirement ↔ CV phrase) and by add-skill de-dupe. */
export function skillVariantMatch(a: string, b: string): boolean {
  return variantMatchTokens(tokenize(a), tokenize(b));
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

  // Discrete CV phrases — skills, certs, role titles, headline. Places where a
  // word is a CLAIM rather than prose. Used twice: tokenised for variant
  // matching, and as the narrow corpus for common-English alias forms.
  const cvPhrases = [
    ...cv.skills.map((s) => s.name),
    ...cv.certifications.map((c) => c.name),
    ...cv.experience.map((e) => e.role),
    cv.personal.headline,
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);

  const paddedPhraseCorpus = ` ${cvPhrases
    .map((phrase) => normalizeText(phrase))
    .filter(Boolean)
    .join(` ${PHRASE_BOUNDARY} `)} `;

  // Pre-tokenised once so the per-term check is cheap.
  const cvPhraseTokens = cvPhrases
    .map(tokenize)
    .filter((ts) => ts.stem.size > 0);

  const variantMatches = (term: string): boolean => {
    const tt = tokenize(term);
    if (tt.stem.size === 0) return false;
    return cvPhraseTokens.some((p) => variantMatchTokens(tt, p));
  };

  const terms: JdTerm[] = [];
  for (const category of CATEGORY_ORDER) {
    for (const term of cleanList(requirements[category])) {
      const matched =
        isMatched(paddedCorpus, paddedPhraseCorpus, term) || variantMatches(term);
      terms.push({ term, category, matched });
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
