/**
 * Paste a list of skills — split it into separate skills instead of one.
 *
 * The problem this fixes: the Skills search box strips commas and line breaks
 * as you type (sanitizeSkillLive), so pasting "Excel, SAP, Negotiation" from an
 * old CV or a LinkedIn profile used to add ONE skill named
 * "Excel SAP Negotiation" — and it printed on the CV like that.
 *
 * Pure and synchronous. The component decides what to do with the plan; this
 * file only decides what the paste contains.
 *
 * Rules, each for a reason:
 *   - The user's own wording is kept. A pasted alias ("SFDC") is not rewritten
 *     to our canonical name — never reshape what the user wrote silently. The
 *     bank is consulted only to classify (category, licence guard, duplicate).
 *   - Licences are NOT added directly. They come back in `credentials` so the
 *     step can route each one through the same "only add it if you hold it"
 *     guard a single add goes through. A paste must not be a way around it.
 *   - Sentences are not skills. A piece longer than a skill name is reported
 *     back, not added — pasting a whole CV section must not fill the list
 *     with bullets.
 *   - Commas inside parentheses do not split: "Microsoft Office (Word, Excel)"
 *     stays one skill, printed as "Microsoft Office (Word/Excel)".
 */
import { allDomainSkills, type DomainSkill } from "../data/domainSkills";
import { sanitizeSkill } from "../sanitize";
import { categoryFor } from "./suggest";

const norm = (s: string) => s.trim().toLowerCase();

/** Longer than this reads as a sentence, not a skill name. */
export const MAX_SKILL_CHARS = 50;
export const MAX_SKILL_WORDS = 6;
/** Most a single paste adds; the rest are reported, not dropped silently. */
export const MAX_PASTE_ADDS = 30;

export type PastedSkill = {
  name: string;
  category?: "technical" | "general";
};

export type PastedCredential = {
  /** As the user wrote it. */
  name: string;
};

export type PastePlan = {
  /** Safe to add now, in paste order. */
  add: PastedSkill[];
  /** Licences — need an explicit "I hold it" each before they are added. */
  credentials: PastedCredential[];
  /** Already on the list (or repeated within the paste). `as` names the
   *  existing entry when it matched through an alias. */
  duplicates: Array<{ name: string; as?: string }>;
  /** Too long to be a skill name. */
  tooLong: string[];
  /** Valid, but past MAX_PASTE_ADDS. */
  overLimit: string[];
};

// Separators between skills. Slash is deliberately absent: "CI/CD",
// "AutoCAD/Revit" and "P&L / budgeting" are too ambiguous to split.
const SEPARATORS = new Set([",", ";", "|", "\n", "\r", "\t", "•", "·", "▪", "●", "◦", "‣", "■", "□", "►", "✓", "✔"]);

/**
 * Split pasted text into raw pieces. Separators inside parentheses or
 * brackets are ignored so a qualified skill stays whole. A comma in there
 * becomes "/": skill names never hold commas (templates print the list
 * comma-separated, and sanitizeSkill strips them), so "(Word, Excel)" would
 * otherwise print as "(Word Excel)".
 */
export function splitPastedText(text: string): string[] {
  const pieces: string[] = [];
  let current = "";
  let depth = 0;
  let afterInnerComma = false;
  for (const ch of text) {
    if (afterInnerComma && ch === " ") continue;
    afterInnerComma = false;
    if (ch === "(" || ch === "[") depth++;
    if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (depth > 0 && ch === ",") {
      current += "/";
      afterInnerComma = true;
      continue;
    }
    if (depth === 0 && SEPARATORS.has(ch)) {
      pieces.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  pieces.push(current);
  return pieces.map(cleanPiece).filter((p) => p.length > 0);
}

// List tails that are not skills: "Excel, Word, etc."
const FILLER = new Set(["etc", "and more", "more", "others", "and others", "and so on", "n/a", "na", "skills"]);

/** Strip list markers, a "Label:" prefix, and trailing punctuation. */
function cleanPiece(raw: string): string {
  let s = raw.trim();
  // Leading bullets, dashes, arrows, and "1." / "1)" / "a)" numbering.
  s = s.replace(/^(?:[-–—*>+~]\s+|[-–—*>]+(?=\S)|(?:\d{1,2}|[a-z])[.)]\s+)+/i, "");
  // "Technical Skills: Excel" -> "Excel"; a bare heading "Skills:" -> "".
  const colon = s.match(/^([^:]{1,40}):\s*(.*)$/);
  if (colon) s = colon[2];
  s = s.replace(/[.\s]+$/, "");
  s = sanitizeSkill(s);
  return FILLER.has(norm(s)) ? "" : s;
}

function buildBankLookup(): Map<string, DomainSkill> {
  const byTerm = new Map<string, DomainSkill>();
  for (const entry of allDomainSkills()) {
    for (const term of [entry.name, ...(entry.aliases ?? [])]) {
      const k = norm(term);
      if (!byTerm.has(k)) byTerm.set(k, entry);
    }
  }
  return byTerm;
}

let bankLookup: Map<string, DomainSkill> | null = null;
function bankEntry(name: string): DomainSkill | undefined {
  bankLookup ??= buildBankLookup();
  return bankLookup.get(norm(name));
}

/**
 * Decide what a pasted list adds, given the skills already on the list.
 * Returns null when the paste is not a list (fewer than two pieces) — the
 * step then lets a single term paste into the search box as it always did.
 */
export function planPastedSkills(text: string, existing: string[]): PastePlan | null {
  const pieces = splitPastedText(text);
  if (pieces.length < 2) return null;

  // Everything already held, keyed by name AND by any bank alias of it, so
  // pasting "SFDC" onto a list holding "Salesforce" is caught as a duplicate.
  const held = new Map<string, string>();
  const hold = (name: string) => {
    held.set(norm(name), name);
    const entry = bankEntry(name);
    if (entry) {
      for (const term of [entry.name, ...(entry.aliases ?? [])]) {
        if (!held.has(norm(term))) held.set(norm(term), name);
      }
    }
  };
  existing.forEach(hold);

  const plan: PastePlan = { add: [], credentials: [], duplicates: [], tooLong: [], overLimit: [] };

  for (const name of pieces) {
    const words = name.split(/\s+/).length;
    if (name.length > MAX_SKILL_CHARS || words > MAX_SKILL_WORDS) {
      plan.tooLong.push(name);
      continue;
    }

    const already = held.get(norm(name));
    if (already !== undefined) {
      plan.duplicates.push(norm(already) === norm(name) ? { name } : { name, as: already });
      continue;
    }

    const entry = bankEntry(name);
    if (entry?.kind === "credential") {
      plan.credentials.push({ name });
      hold(name);
      continue;
    }

    if (plan.add.length >= MAX_PASTE_ADDS) {
      plan.overLimit.push(name);
      continue;
    }

    const category = entry ? categoryFor({ kind: entry.kind, source: "bank" }) : undefined;
    plan.add.push(category ? { name, category } : { name });
    hold(name);
  }

  return plan;
}
