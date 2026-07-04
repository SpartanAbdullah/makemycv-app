/**
 * Role-family taxonomy + inference — the SINGLE source of truth for turning a
 * free-text job title / headline into a job domain.
 *
 * Before this module, ideaSuggestions.ts and softSkills.ts each carried their
 * OWN keyword table, and they could (and did) disagree. Both now delegate here,
 * so a title maps to exactly one family everywhere — the builder's idea bullets,
 * soft-skill chips, and the persisted `settings.domain` can never drift apart.
 *
 * Matching rules:
 *  - Keywords are lowercase. A keyword ending in a SPACE ("pro ", "hr ", "gm ")
 *    is a whole-word marker (matched only as a standalone word) so short/leaky
 *    abbreviations never bleed into a larger word ("pro " must not fire on
 *    "process"). Keywords without a trailing space are plain substrings.
 *  - inferRoleFamily picks the family whose LONGEST matched keyword wins (most
 *    specific), not first-in-list. This is what lets "software engineer" resolve
 *    to IT (compound keyword, len 17) instead of Engineering (bare "engineer",
 *    len 8) — a real mis-inference in the old first-match-wins scan.
 */
import type { RoleFamily } from "../types/cv";

export type { RoleFamily };

// All families incl. the "generic" fallback — used for the zod enum so any
// persisted value validates.
export const ROLE_FAMILIES = [
  "sales",
  "marketing",
  "finance",
  "accounting",
  "operations",
  "logistics",
  "hr",
  "admin",
  "engineering",
  "it",
  "hospitality",
  "retail",
  "realestate",
  "healthcare",
  "education",
  "customerservice",
  "generic",
] as const satisfies readonly RoleFamily[];

// Human-readable labels for the confirm chip + AI prompt.
export const ROLE_FAMILY_LABELS: Record<RoleFamily, string> = {
  sales: "Sales & Business Development",
  marketing: "Marketing & Digital",
  finance: "Finance",
  accounting: "Accounting & Audit",
  operations: "Operations & Management",
  logistics: "Logistics & Supply Chain",
  hr: "Human Resources",
  admin: "Administration & PRO",
  engineering: "Engineering & Construction",
  it: "IT & Software",
  hospitality: "Hospitality & F&B",
  retail: "Retail & Customer-Facing",
  realestate: "Real Estate",
  healthcare: "Healthcare",
  education: "Education & Training",
  customerservice: "Customer Service & Call Centre",
  generic: "General",
};

// Families a user can pick in the chip (everything except the fallback).
export const SELECTABLE_ROLE_FAMILIES: RoleFamily[] = ROLE_FAMILIES.filter(
  (f) => f !== "generic",
);

/**
 * Consolidated keyword table. Seeded verbatim from the old ideaSuggestions
 * ROLE_LIBRARY (the better-curated set), with two deliberate fixes for IT:
 *   - dropped the bare "engineer" keyword (it made every software engineer
 *     resolve to Engineering & Construction),
 *   - added the common "X engineer/developer" compounds so tech titles win by
 *     specificity over the generic "engineer".
 */
const FAMILY_KEYWORDS: Array<{ family: RoleFamily; keywords: string[] }> = [
  {
    family: "sales",
    keywords: ["sales", "business development", "account manager", "bd ", "key account", "relationship manager"],
  },
  { family: "marketing", keywords: ["marketing", "digital", "brand", "social media", "content", "seo", "growth"] },
  { family: "finance", keywords: ["finance", "financial", "fp&a", "treasury", "investment", "credit"] },
  { family: "accounting", keywords: ["account", "audit", "bookkeep", "ledger", "ifrs", "vat", "tax"] },
  { family: "operations", keywords: ["operations", "operation", "general manager", "gm ", "coo", "ops "] },
  {
    family: "logistics",
    keywords: ["logistics", "supply chain", "procurement", "warehouse", "fleet", "import", "export", "freight"],
  },
  { family: "hr", keywords: ["hr ", "human resources", "recruit", "talent", "people", "hr manager", "hr officer"] },
  {
    family: "admin",
    keywords: ["admin", "secretary", "executive assistant", "personal assistant", "pro ", "public relations", "office manager", "coordinator", "receptionist"],
  },
  {
    family: "engineering",
    keywords: ["engineer", "engineering", "construction", "civil", "mechanical", "electrical", "mep", "project engineer", "site"],
  },
  {
    family: "it",
    keywords: [
      "developer",
      "software",
      "it ",
      "data",
      "system",
      "network",
      "devops",
      "qa ",
      "analyst",
      "programmer",
      // Compounds so tech "X engineer" titles beat bare "engineer" by length.
      "software engineer",
      "software developer",
      "web developer",
      "full stack",
      "front-end",
      "frontend",
      "back-end",
      "backend",
      "devops engineer",
      "data engineer",
      "cloud engineer",
      "mobile developer",
    ],
  },
  {
    family: "hospitality",
    keywords: ["hospitality", "hotel", "f&b", "food", "beverage", "chef", "restaurant", "guest", "concierge", "front office", "housekeeping"],
  },
  { family: "retail", keywords: ["retail", "store", "sales associate", "merchandis", "cashier", "boutique", "mall"] },
  { family: "realestate", keywords: ["real estate", "property", "leasing", "broker", "realtor", "rera"] },
  { family: "healthcare", keywords: ["nurse", "doctor", "medical", "health", "clinic", "patient", "pharmac", "dha", "haad", "moh"] },
  { family: "education", keywords: ["teacher", "tutor", "lecturer", "trainer", "education", "academic", "instructor", "kg ", "school"] },
  { family: "customerservice", keywords: ["customer service", "call center", "call centre", "support", "csr", "client service", "help desk"] },
];

// A single-word match this short or shorter is too ambiguous to auto-apply
// confidently (e.g. "hr", "bd", "pro", "gm") — inference still returns the
// family, but flags it low-confidence so the chip asks instead of guessing.
const MIN_CONFIDENT_KEYWORD_LEN = 4;

/**
 * Whole-word-aware keyword test honoring the trailing-space convention.
 * @param title   already lowercased + trimmed job title
 * @param keyword a keyword (may carry a trailing space marking a whole word)
 */
export function matchesRoleKeyword(title: string, keyword: string): boolean {
  if (keyword.endsWith(" ")) {
    return ` ${title} `.includes(` ${keyword.trim()} `);
  }
  return title.includes(keyword);
}

export type RoleFamilyInference = {
  family: RoleFamily;
  confidence: "high" | "low";
};

/**
 * Infers the job domain from a title/headline. Longest matched keyword wins;
 * confidence is "low" when nothing matches (→ generic), when the best match is
 * a very short abbreviation, or when two families tie for the top score — the
 * three cases where we'd rather have the user confirm than guess wrong.
 */
export function inferRoleFamily(title: string | undefined): RoleFamilyInference {
  const normalized = (title ?? "").toLowerCase().trim();
  if (!normalized) return { family: "generic", confidence: "low" };

  let bestFamily: RoleFamily = "generic";
  let bestLen = 0;
  let tie = false;

  for (const { family, keywords } of FAMILY_KEYWORDS) {
    let familyBest = 0;
    for (const kw of keywords) {
      if (matchesRoleKeyword(normalized, kw)) {
        familyBest = Math.max(familyBest, kw.trim().length);
      }
    }
    if (familyBest > bestLen) {
      bestLen = familyBest;
      bestFamily = family;
      tie = false;
    } else if (familyBest > 0 && familyBest === bestLen) {
      tie = true;
    }
  }

  if (bestLen === 0) return { family: "generic", confidence: "low" };
  const confident = bestLen >= MIN_CONFIDENT_KEYWORD_LEN && !tie;
  return { family: bestFamily, confidence: confident ? "high" : "low" };
}
