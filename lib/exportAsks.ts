/**
 * Which single row the post-export card shows (2026-11-07).
 *
 * The card used to stack the karak line, stars and an email form on every
 * export. It now shows one sentence and one row per export, rotating by a
 * per-browser export count. Follow comes first by owner decision, so a person
 * who exports once still sees it.
 *
 * The count lives beside `mmcv_rated_at` and `mmcv_subscribed_at`, not in the
 * CV store: it describes this browser's asks, never the CV.
 */

export type ExportAsk = "follow" | "stars" | "email";

const KEY = "mmcv_export_asks";
const VERSION = 1;
const ORDER: readonly ExportAsk[] = ["follow", "stars", "email"];

/** `n` is 1-based. Anything below 1 is treated as the first export. */
export function askForExport(n: number): ExportAsk {
  const i = Math.max(1, Math.floor(n)) - 1;
  return ORDER[i % ORDER.length];
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

/** Records one export and returns its ask. Falls back to the first ask without storage. */
export function nextExportAsk(): ExportAsk {
  try {
    const count = parseExportCount(window.localStorage.getItem(KEY)) + 1;
    window.localStorage.setItem(KEY, serializeExportCount(count));
    return askForExport(count);
  } catch {
    return askForExport(1);
  }
}
