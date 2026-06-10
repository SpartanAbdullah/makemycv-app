// PDF import adapter.
// Requires: pdfjs-dist (npm install pdfjs-dist)
// Worker is loaded from CDN to avoid Next.js bundling complexity.
// unspecified: worker CDN URL must be reachable; swap for local path in offline envs.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import { ImportParseError } from "./adapter";
import { parseTextToDocument } from "./textParser";

// Below this many characters of extracted text, the PDF is almost
// certainly a scanned image with no usable text layer (mirrors the
// /resume-checker dropzone's guard).
const MIN_TEXT_LENGTH = 200;

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
    return out.replace(/[ \t]+/g, " ").trim();
  });
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
  if (typeof window === "undefined") {
    throw new Error("extractPdfTextInBrowser must run in the browser");
  }

  const pdfjsLib = await import("pdfjs-dist");

  // Point worker to CDN — avoids shipping the large worker bundle.
  // unspecified: replace with a local /public path if CDN is unavailable.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await input.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as PdfTextItemLike[];
    const lines = reconstructLines(items);
    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n\n");
}

export const pdfAdapter: ImportAdapter = {
  name: "PDF",

  async parse(input: File): Promise<ParsedDocument> {
    if (typeof window === "undefined") return {};

    // Failures THROW typed errors instead of resolving `{}` (audit UX-18) —
    // the old swallow-to-empty behavior made every failure mode (corrupt
    // file, scanned image, odd layout) land on the same dead-end "No fields
    // could be extracted" review screen, and BuilderShell's error UI was
    // unreachable.
    let fullText: string;
    try {
      fullText = await extractPdfTextInBrowser(input);
    } catch (err) {
      console.warn("[pdfAdapter] Extraction failed:", err);
      throw new ImportParseError(
        "corrupt-file",
        "This PDF could not be opened. It may be corrupted or password-protected.",
      );
    }
    if (fullText.trim().length < MIN_TEXT_LENGTH) {
      throw new ImportParseError(
        "empty-text",
        "This PDF has no readable text — it looks like a scanned image. Export a text-based PDF from Word or Google Docs and try again.",
      );
    }
    return parseTextToDocument(fullText);
  },
};
