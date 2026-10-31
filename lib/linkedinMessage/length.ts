/**
 * LinkedIn message length enforcement (backlog E5, 2026-10-31).
 *
 * The brief is 60–90 words; the staging e2e saw 101 and the production check
 * 102. The prompt states 90 as a hard ceiling, and when a draft still runs
 * over, the route cuts it here — whole sentences only, never mid-sentence —
 * and reports `outcome: "trimmed"` so the UI and analytics can say so. Pure,
 * so it is unit-testable from Node.
 */

import { countWords } from "./prompt";

export type TrimResult = { text: string; trimmed: boolean };

/** Paragraphs are kept as the model wrote them (a blank line between two). */
const PARAGRAPH_BREAK = /\n\s*\n/;

/** Terminal punctuation, optionally closed by a quote / bracket. */
const TERMINAL = /[.!?]+["”’)]*/g;

/**
 * Split a paragraph into sentences by scanning for boundaries. A boundary is
 * terminal punctuation followed by whitespace (or the end of the text) whose
 * next word does not start with a lower-case letter. So "2.5", "AED 1.2M" and
 * "Q1.5" never split (no whitespace after the dot), and neither do "e.g. the"
 * or "approx. three" (lower-case continuation). Text after the last boundary
 * is its own sentence.
 */
export const splitSentences = (paragraph: string): string[] => {
  const out: string[] = [];
  let start = 0;
  TERMINAL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERMINAL.exec(paragraph)) !== null) {
    const end = m.index + m[0].length;
    const rest = paragraph.slice(end);
    if (rest.length > 0 && !/^\s/.test(rest)) continue; // "2.5", "1.2M", "a.b"
    const next = rest.trimStart();
    if (/^[a-z]/.test(next)) continue; // "e.g. the", "approx. three" (messages are English)
    const s = paragraph.slice(start, end).trim();
    if (s) out.push(s);
    start = end;
  }
  const tail = paragraph.slice(start).trim();
  if (tail) out.push(tail);
  return out;
};

type Sentence = { text: string; para: number; words: number };

const join = (kept: Sentence[]): string => {
  const paras: string[][] = [];
  let lastPara = -1;
  for (const s of kept) {
    if (s.para !== lastPara) {
      paras.push([]);
      lastPara = s.para;
    }
    paras[paras.length - 1].push(s.text);
  }
  return paras.map((p) => p.join(" ")).join("\n\n");
};

/**
 * Cut `text` to at most `maxWords` words by dropping whole sentences.
 *
 * The message's last sentence is the next step the prompt asks for ("happy to
 * share my CV", "open to a short call"), so it is kept whenever it fits and
 * sentences are dropped from the end of the body before it. When it does not
 * fit, sentences are kept from the start. Paragraph breaks survive between
 * kept sentences from different paragraphs. Only when even the first
 * sentence is over the limit (one 95-word sentence) is it cut at `maxWords`
 * words and closed with a full stop — a fallback, not the normal path.
 */
export function trimToWordLimit(text: string, maxWords: number): TrimResult {
  const original = text.trim();
  if (countWords(original) <= maxWords) return { text: original, trimmed: false };

  const sentences: Sentence[] = [];
  original.split(PARAGRAPH_BREAK).forEach((paragraph, para) => {
    for (const s of splitSentences(paragraph)) sentences.push({ text: s, para, words: countWords(s) });
  });

  const greedy = (pool: Sentence[], budget: number): Sentence[] => {
    const kept: Sentence[] = [];
    let used = 0;
    for (const s of pool) {
      if (used + s.words > budget) break;
      kept.push(s);
      used += s.words;
    }
    return kept;
  };

  if (sentences.length > 1) {
    const last = sentences[sentences.length - 1];
    const body = greedy(sentences.slice(0, -1), maxWords - last.words);
    if (body.length > 0) return { text: join([...body, last]), trimmed: true };
  }

  const kept = greedy(sentences, maxWords);
  if (kept.length > 0) return { text: join(kept), trimmed: true };

  const words = original.match(/\S+/g) ?? [];
  const cut = words.slice(0, maxWords).join(" ").replace(/[,;:\s]+$/, "");
  return { text: /[.!?]["”’)]*$/.test(cut) ? cut : `${cut}.`, trimmed: true };
}
