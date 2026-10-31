// PDF import adapter.
// Requires: pdfjs-dist (npm install pdfjs-dist)
//
// Extraction is split in two since 2026-10-31: `extractPdfText` takes bytes
// plus an injected pdf.js module and worker URL (so the Node fixture suite can
// run the real code with the legacy build), and the `...InBrowser` wrappers
// supply the dynamic import, the self-hosted worker and the CDN fallback.
// Every failure is an ImportParseError with a reason from importErrors.ts.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import {
  ImportParseError,
  MAX_PDF_PAGES,
  MIN_TEXT_LENGTH,
  PDF_TIMEOUT_MS,
  classifyPdfError,
  toImportParseError,
  withDeadline,
} from "./importErrors";
import { parseTextToDocument } from "./textParser";

type PdfTextItemLike = {
  str: string;
  // pdfjs transform: [a, b, c, d, e=x, f=y] (matrix coefficients)
  transform: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

/**
 * Reconstruct visual lines from a stream of PDF text items.
 *
 * Why: pdfjs returns items at the text-fragment level (every span / glyph
 * group is a separate item). Joining them with " " collapses the whole
 * document into one giant line, which defeats line-by-line section
 * detection downstream. We group items by Y coordinate (PDF origin is
 * bottom-left; top of page = HIGH Y, bottom = LOW Y) and sort by X within
 * each line.
 *
 * Tolerance: items on the same visual line have Y values within ~half
 * the median glyph height. Larger tolerances merge wrapped lines; smaller
 * tolerances split kerned text.
 */
function reconstructLines(items: PdfTextItemLike[]): string[] {
  if (items.length === 0) return [];

  // Drop pure-whitespace items but keep their X gaps via spacing in the join.
  const real = items.filter(
    (i) => typeof i.str === "string" && i.str.length > 0,
  );
  if (real.length === 0) return [];

  // Median glyph height → line-grouping tolerance.
  const heights = real
    .map((i) => i.height ?? Math.abs(i.transform?.[3] ?? 10))
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;
  const lineTolerance = Math.max(medianHeight * 0.5, 2);

  // Sort items: by Y descending (top of page first), then X ascending.
  const sorted = [...real].sort((a, b) => {
    const ay = a.transform?.[5] ?? 0;
    const by = b.transform?.[5] ?? 0;
    if (Math.abs(by - ay) > lineTolerance) return by - ay;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  const lines: PdfTextItemLike[][] = [];
  let currentY = Number.POSITIVE_INFINITY;
  let bucket: PdfTextItemLike[] = [];

  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0;
    if (bucket.length === 0) {
      bucket.push(item);
      currentY = y;
    } else if (Math.abs(y - currentY) <= lineTolerance) {
      bucket.push(item);
    } else {
      lines.push(bucket);
      bucket = [item];
      currentY = y;
    }
  }
  if (bucket.length > 0) lines.push(bucket);

  // Stitch each line's items, inserting a space when the X gap suggests one.
  return lines.map((line) => {
    // Re-sort by X within the line just to be safe.
    line.sort(
      (a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0),
    );
    let out = "";
    let prevEndX = -Infinity;
    for (const item of line) {
      const startX = item.transform?.[4] ?? 0;
      const text = item.str;
      if (out.length === 0) {
        out = text;
      } else {
        const endsWithSpace = /\s$/.test(out);
        const startsWithSpace = /^\s/.test(text);
        const gap = startX - prevEndX;
        // Use the item's own width when available to compute glyph density;
        // otherwise fall back to a generous tolerance.
        const needsSpace =
          !endsWithSpace && !startsWithSpace && gap > medianHeight * 0.25;
        out += needsSpace ? " " + text : text;
      }
      const w = item.width ?? text.length * (medianHeight * 0.5);
      prevEndX = startX + w;
    }
    // NFKC (D4 / backlog E8.3, 2026-10-31): Arabic set by our own PDF export
    // (and by Chrome's print) comes out of pdf.js as presentation forms
    // (U+FB50–U+FEFF), which no parser regex counts as Arabic letters — the
    // real name was skipped and every Arabic value was stored as glyph codes.
    // NFKC maps them back to the base letters (and unfolds Latin ligatures
    // such as "ﬁ"). Visual word order of RTL runs is NOT repaired here.
    return out.normalize("NFKC").replace(/[ \t]+/g, " ").trim();
  });
}

/** A line that is only a page number: "Page 2 of 31", "Page 3", "2 / 5", "- 4 -". */
const PAGE_FOOTER_RE =
  /^(?:page\s+\d+(?:\s*(?:of|\/)\s*\d+)?|\d+\s*(?:of|\/)\s*\d+|[-–—]\s*\d+\s*[-–—])$/i;

/* ── pdf.js plumbing ────────────────────────────────────────────────────── */

/** The slice of pdfjs-dist this module uses. Structural so the Node suite can
 *  pass the legacy build and a test can pass a stub. */
export type PdfjsModule = {
  version?: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer | Uint8Array; password?: string }): {
    promise: Promise<PdfDocumentLike>;
    destroy(): Promise<void> | void;
  };
};

export type PdfDocumentLike = {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: unknown[] }>;
  }>;
  destroy?(): Promise<void> | void;
};

export type ExtractPdfOptions = {
  pdfjs: PdfjsModule;
  /** Resolved worker URL — same-origin path in the browser, file: URL in Node. */
  workerSrc: string;
  /** Budget from the start of THIS call. Ignored when `deadlineAt` is set. */
  timeoutMs?: number;
  /** Absolute deadline (epoch ms) fixed by the caller when the pick started,
   *  so the time spent loading pdf.js and probing the worker counts (D10). */
  deadlineAt?: number;
  maxPages?: number;
};

export type ExtractedPdf = {
  text: string;
  /** Pages in the document. */
  pages: number;
  /** Pages actually read: `min(pages, maxPages)`. */
  pagesRead: number;
  /** True when pages past `maxPages` were skipped (D7a, session 6). */
  truncated: boolean;
};

/**
 * Text + page count from PDF bytes. Throws ImportParseError with
 * encrypted_pdf / corrupt_pdf / worker_load_failed / timeout / parse_exception.
 *
 * The deadline covers the whole run (open + every page), and on expiry the
 * loading task is destroyed so the worker stops chewing on the file. When the
 * caller passes `deadlineAt`, the budget also covers what it did before.
 */
export async function extractPdfText(
  data: ArrayBuffer,
  opts: ExtractPdfOptions,
): Promise<ExtractedPdf> {
  const { pdfjs } = opts;
  const deadlineAt = opts.deadlineAt ?? Date.now() + (opts.timeoutMs ?? PDF_TIMEOUT_MS);
  const maxPages = opts.maxPages ?? MAX_PDF_PAGES;
  // The caller's steps already used the whole budget: do not start pdf.js.
  if (Date.now() >= deadlineAt) throw new ImportParseError("timeout");
  pdfjs.GlobalWorkerOptions.workerSrc = opts.workerSrc;

  // pdf.js transfers (detaches) the buffer it receives — hand it a copy so
  // a caller can still read the original afterwards.
  const task = pdfjs.getDocument({ data: data.slice(0) });
  const destroyTask = () => {
    void Promise.resolve(task.destroy()).catch(() => {});
  };

  const run = async (): Promise<ExtractedPdf> => {
    const pdf = await task.promise;
    const pages = pdf.numPages;
    const pagesRead = Math.min(pages, maxPages);
    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pagesRead; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      // D7b (session 5): "Page 2 of 3" footers sat inside the Experience
      // section and became phantom roles; a page-number line carries nothing.
      const lines = reconstructLines(content.items as PdfTextItemLike[]).filter(
        (l) => !PAGE_FOOTER_RE.test(l),
      );
      pageTexts.push(lines.join("\n"));
    }
    return {
      text: pageTexts.join("\n\n"),
      pages,
      pagesRead,
      truncated: pages > pagesRead,
    };
  };

  try {
    return await withDeadline(run(), deadlineAt, destroyTask);
  } catch (err) {
    const reason = classifyPdfError(err);
    if (reason !== "timeout") {
      // Never log the error object: a FormatError can quote stream bytes.
      console.warn(`[pdfAdapter] extraction failed: ${reason}`);
    }
    throw new ImportParseError(reason);
  }
}

// Worker is self-hosted (audit PERF-8): the old cdnjs URL failed at the exact
// moment a user uploads on corporate networks and under ad/privacy blockers —
// common for job seekers uploading from office machines. The vendored copy in
// /public is version-locked to the installed pdfjs-dist; after upgrading the
// package, re-run:
//   Copy-Item node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
//
// The CDN is a fallback that has to be chosen BEFORE the first getDocument:
// once a worker script fails to load, pdf.js disables real workers for the
// page and memoises the failed fake-worker import, so a "retry with another
// workerSrc" after the fact can never succeed (that is what the previous
// catch-and-retry did). We probe the local file with a HEAD request instead
// and fall back to the CDN only when it is unreachable. The result is cached
// for the page lifetime.
const LOCAL_WORKER = "/pdf.worker.min.mjs";
let workerSrcPromise: Promise<string> | null = null;

export function resolveWorkerSrc(pdfjs: Pick<PdfjsModule, "version">): Promise<string> {
  if (!workerSrcPromise) {
    workerSrcPromise = (async () => {
      try {
        const res = await fetch(LOCAL_WORKER, { method: "HEAD", cache: "force-cache" });
        if (res.ok) return LOCAL_WORKER;
      } catch {
        /* fall through to the CDN */
      }
      console.warn("[pdfAdapter] local worker unreachable, using the CDN copy");
      return `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    })();
  }
  return workerSrcPromise;
}

/**
 * pdf.js module + worker URL, both under the pick's deadline (D10, session
 * 6). Before, the chunk import and the HEAD probe ran on no clock and the
 * 45 s budget only started afterwards (case 12a: 57 s with no timeout).
 */
async function loadPdfjs(
  deadlineAt: number,
): Promise<{ pdfjs: PdfjsModule; workerSrc: string }> {
  let pdfjs: PdfjsModule;
  try {
    pdfjs = (await withDeadline(
      import("pdfjs-dist") as Promise<unknown>,
      deadlineAt,
    )) as PdfjsModule;
  } catch (err) {
    if (err instanceof ImportParseError) throw err; // timeout
    // The library chunk itself did not load (offline mid-session, blocker).
    throw new ImportParseError("worker_load_failed");
  }
  try {
    return { pdfjs, workerSrc: await withDeadline(resolveWorkerSrc(pdfjs), deadlineAt) };
  } catch (err) {
    // A probe that never answered stays pending; let the next pick probe again
    // instead of awaiting the same stuck request.
    workerSrcPromise = null;
    throw err;
  }
}

/**
 * Extract raw text from a PDF in the browser using pdfjs-dist.
 *
 * Reconstructs lines from item Y-positions so downstream parsers see one
 * paragraph per line, not the whole document on a single line.
 *
 * Browser-only — throws if called from the server.
 * Used by:
 *   - the builder Import flow (via pdfAdapter.parse)
 *   - the /resume-checker client-side pre-extraction
 */
export async function extractPdfTextInBrowser(input: File): Promise<string> {
  const { text } = await extractPdfTextInBrowserDetailed(input);
  return text;
}

/**
 * Same extraction as `extractPdfTextInBrowser`, plus the page count — the
 * /resume-checker "what the ATS sees" panel needs it to say "very few words
 * for a 2-page PDF" without reading the file twice. The text is byte-identical
 * to what the builder import and the checker upload already use.
 */
export async function extractPdfTextInBrowserDetailed(
  input: File,
): Promise<ExtractedPdf> {
  if (typeof window === "undefined") {
    throw new Error("extractPdfTextInBrowser must run in the browser");
  }
  const deadlineAt = Date.now() + PDF_TIMEOUT_MS;
  const { pdfjs, workerSrc } = await loadPdfjs(deadlineAt);
  const arrayBuffer = await input.arrayBuffer();
  return extractPdfText(arrayBuffer, { pdfjs, workerSrc, deadlineAt });
}

/** Bytes → ParsedDocument, shared by the browser adapter and the Node fixture
 *  suite. Throws ImportParseError only. */
export async function parsePdfBytes(
  data: ArrayBuffer,
  opts: ExtractPdfOptions,
): Promise<ParsedDocument> {
  const { text, pages, pagesRead, truncated } = await extractPdfText(data, opts);
  if (text.trim().length < MIN_TEXT_LENGTH) {
    throw new ImportParseError("no_text_layer");
  }
  let parsed: ParsedDocument;
  try {
    // A PDF text layer is soft-wrapped at the right margin (D9, session 6).
    parsed = parseTextToDocument(text, { softWrapped: true });
  } catch (err) {
    throw toImportParseError(err);
  }
  // D7a (session 6): pages past MAX_PDF_PAGES used to vanish without a word
  // (a 31-page file lost its last page, skills and education, silently). The
  // review now says how many pages were read. Counts only, no analytics.
  if (truncated) parsed.pagesSkipped = { read: pagesRead, total: pages };
  return parsed;
}

export const pdfAdapter: ImportAdapter = {
  name: "PDF",

  async parse(input: File, opts?: { deadlineAt?: number }): Promise<ParsedDocument> {
    // Failures THROW typed errors instead of resolving `{}` (audit UX-18) —
    // the old swallow-to-empty behavior made every failure mode (corrupt
    // file, scanned image, odd layout) land on the same dead-end "No fields
    // could be extracted" review screen, and BuilderShell's error UI was
    // unreachable.
    if (typeof window === "undefined") {
      throw new ImportParseError("parse_exception");
    }
    // D10: BuilderShell fixes the deadline when the pick starts, before it
    // loads this chunk; one budget then covers chunk, pdf.js, probe and read.
    const deadlineAt = opts?.deadlineAt ?? Date.now() + PDF_TIMEOUT_MS;
    const { pdfjs, workerSrc } = await loadPdfjs(deadlineAt);
    const data = await input.arrayBuffer();
    return parsePdfBytes(data, { pdfjs, workerSrc, deadlineAt });
  },
};
