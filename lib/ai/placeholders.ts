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
