/**
 * Which single row the post-export card shows.
 *
 * The card used to stack the karak line, stars and an email form on every
 * export. Since 2026-11-07 it shows one sentence and one row per export,
 * rotating by a per-browser export count.
 *
 * Order (owner decision 2026-11-21, product audit Q12 — it supersedes the
 * 2026-11-07 "follow first"): the moment after a download is when a person
 * most wants the next useful step, so the FIRST export points to it — tailor
 * the CV to a job, write the cover letter. The asks that serve us come after:
 * email, then stars, then a follow. A person who exports once is helped, not
 * asked.
 *
 * The count lives beside `mmcv_rated_at` and `mmcv_subscribed_at`, not in the
 * CV store: it describes this browser's asks, never the CV.
 */

export type ExportAsk = "next" | "email" | "stars" | "follow";
export type ExportSentence = "karak" | "service";

/** The two asks that can have nothing to show (answered already, or switched off). */
export type AnswerableAsk = "email" | "stars";

const KEY = "mmcv_export_asks";
const VERSION = 1;
const ORDER: readonly ExportAsk[] = ["next", "email", "stars", "follow"];

const indexFor = (n: number) => (Math.max(1, Math.floor(n)) - 1) % ORDER.length;

/** The row SCHEDULED for export `n` (1-based; below 1 counts as the first). */
export function askForExport(n: number): ExportAsk {
  return ORDER[indexFor(n)];
}

/**
 * The row actually shown for export `n`: the scheduled one, or — when that
 * one has nothing to ask — the next in the order that does. "next" and
 * "follow" always have something to show, so the walk always ends.
 */
export function resolveExportAsk(n: number, canAsk: (ask: AnswerableAsk) => boolean): ExportAsk {
  const start = indexFor(n);
  for (let step = 0; step < ORDER.length; step += 1) {
    const ask = ORDER[(start + step) % ORDER.length];
    if (ask === "next" || ask === "follow" || canAsk(ask)) return ask;
  }
  return "follow";
}

/**
 * The sentence above the row. With the paid review on, odd exports mention it,
 * so a person who exports once still sees it and the exposure test stays whole.
 */
export function sentenceForExport(n: number, serviceOn: boolean): ExportSentence {
  if (!serviceOn) return "karak";
  return Math.max(1, Math.floor(n)) % 2 === 1 ? "service" : "karak";
}

/** Discards rather than guesses: anything that isn't this shape reads as 0. */
export function parseExportCount(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; count?: unknown };
    if (parsed?.v !== VERSION) return 0;
    const { count } = parsed;
    return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : 0;
  } catch {
    return 0;
  }
}

export function serializeExportCount(count: number): string {
  return JSON.stringify({ v: VERSION, count });
}

/** Records one export and returns its 1-based number. Treated as the first without storage. */
export function nextExportNumber(): number {
  try {
    const count = parseExportCount(window.localStorage.getItem(KEY)) + 1;
    window.localStorage.setItem(KEY, serializeExportCount(count));
    return count;
  } catch {
    return 1;
  }
}
