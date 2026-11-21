/**
 * Placeholder contract for AI-written text (2026-10-24, audit F31 / WP-4).
 *
 * The AI suggestion routes may not invent facts. Where a figure would make a
 * sentence stronger but the user never supplied one, the model writes a
 * placeholder token instead, and the UI refuses to insert text that still
 * carries one. The user fills in the real number; nothing fabricated ever
 * lands on a CV that goes to an employer.
 *
 * `{{number}}` is what the prompts ask for. `[X]` and `[X]%` are tolerated
 * because models produce them spontaneously — treating them as placeholders
 * (rather than letting "[X]%" ship inside a summary) is the safe reading.
 *
 * Pure, dependency-free, and shared by the server routes and the UI.
 */

export const NUMBER_PLACEHOLDER = "{{number}}";

/** Any unresolved placeholder: {{number}}, {{…}}, [X], [x], [X]%. */
export const PLACEHOLDER_RE = /\{\{\s*[a-z][a-z _-]*\s*\}\}|\[\s*x\s*\]/gi;

export function hasPlaceholder(text: string): boolean {
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(text);
}

export function countPlaceholders(text: string): number {
  return (text.match(PLACEHOLDER_RE) ?? []).length;
}

export type TextPart = { text: string; placeholder: boolean };

/**
 * Split text into plain and placeholder runs so the UI can highlight the
 * spots that still need a real figure.
 */
export function splitPlaceholders(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), placeholder: false });
    parts.push({ text: m[0], placeholder: true });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), placeholder: false });
  return parts;
}

/**
 * Normalise the variants a model emits ([X], [x], {{ number }}, {{metric}})
 * to the one token the UI explains, so the user sees a single convention.
 */
export function normalizePlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, NUMBER_PLACEHOLDER);
}

/* ── Blanks in the builder's own ready-made text (2026-11, audit A1) ─────────
 *
 * The idea bullets (lib/data/ideaSuggestions.ts) and summary starters
 * (lib/data/summaryStarters.ts) are not AI output, but they follow the same
 * principle: where a figure or a personal detail belongs they leave a blank —
 * "Closed __ new accounts, exceeding target by __%", "[Your role] with __
 * years in [your industry]" — for the user to fill in.
 *
 * The AI path refuses to insert a line that still carries a placeholder. The
 * ready-made path inserted its blanks in one tap and nothing looked at them
 * again, so a CV could be exported reading "Managed a team of __ staff".
 * These helpers let the form and the export dialog see them.
 *
 * Kept apart from PLACEHOLDER_RE on purpose: that one defines what an AI
 * route may emit and what blocks an insert, and widening it would change
 * that contract. BLANK_RE only ever counts and warns.
 *
 * What it matches:
 *   __                    two or more underscores
 *   [your industry]       a bracketed prompt starting with "your"
 *   [domain]              the one bare prompt word the starters use
 *   [Dubai / Abu Dhabi]   a bracketed either-or choice
 * Ordinary bracketed text ("[Confidential]", "[1]") is deliberately not a
 * blank.
 */
export const BLANK_RE =
  /_{2,}|\[\s*(?:your\b[^\]\n]{0,40}|domain|[a-z][a-z ]{0,24}\s\/\s[a-z][a-z ]{0,24})\s*\]/gi;

const UNFILLED_RE = new RegExp(`${PLACEHOLDER_RE.source}|${BLANK_RE.source}`, "gi");

/**
 * How many spots in this text still wait for the user's own words: AI
 * placeholders and ready-made blanks together. 0 for text that is finished.
 */
export function countUnfilled(text: string | undefined | null): number {
  if (!text) return 0;
  return (text.match(UNFILLED_RE) ?? []).length;
}
