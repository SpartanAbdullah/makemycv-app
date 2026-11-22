// OCR fallback for scanned PDFs (2026-11-21, growth tracker item 15).
//
// A PDF with no text layer (a phone scan, a "print to image" export) used to
// stop at `no_text_layer`: 20 of 31 import failures in the week of 9 Nov 2026.
// With NEXT_PUBLIC_OCR_IMPORT=1 the PDF adapter renders the first pages to a
// canvas and reads them with tesseract.js, in the browser, and the text takes
// the same road as any other import (parseTextToDocument → MappingReview).
//
// This file is the pure half: the flag, the budgets, the asset paths, the
// text clean-up and the fallback's control flow. No browser API and no
// tesseract import, so the Node suites compile and run it. The browser half
// (pdf.js canvas + tesseract worker) is ocrBrowser.ts, loaded only when a
// scan is actually picked.
//
// Privacy: the page images and the recognised text never leave the browser.
// The worker, the wasm core and the language data are served from /ocr/ on
// this origin (scripts/copy-ocr-assets.mjs); nothing is fetched from a CDN.
// Nothing here logs or reports document text: outcomes are enums.

import { ImportParseError, MIN_TEXT_LENGTH, withDeadline } from "./importErrors";

/** Must equal the installed tesseract.js version. scripts/copy-ocr-assets.mjs
 *  copies the worker and core into a folder named after it and fails the
 *  install when the two disagree, so a version bump cannot ship a worker that
 *  does not match the library. */
export const TESSERACT_VERSION = "7.0.0";
/** Worker script + wasm core (copied from node_modules at install time). */
export const OCR_ASSET_BASE = `/ocr/tesseract-${TESSERACT_VERSION}`;
/** English "fast" model (tessdata_fast 4.1.0, 1.96 MB gzipped, committed).
 *  Read the same fixture as the 2.95 MB default model, at two thirds the
 *  download. */
export const OCR_LANG_PATH = "/ocr/lang/4.0.0_fast";

/** A CV's substance is on its first pages; each page costs seconds on a phone. */
export const OCR_MAX_PAGES = 3;
/** OCR's own budget, counted from the moment the scan is detected (the 45 s
 *  PDF budget has usually been partly spent by then). Covers the one-off
 *  download of about 3.3 MB and up to three pages on a slow phone. */
export const OCR_TIMEOUT_MS = 90_000;
/** Below this mean confidence (0-100) the recognised "text" is noise (a
 *  photo, handwriting, a script the English model cannot read). */
export const OCR_MIN_CONFIDENCE = 45;

/** How an OCR attempt ended. `ocr_outcome` on `cv_import_failed`. */
export const OCR_OUTCOMES = [
  /** The worker, the core or the language data could not be loaded. */
  "load_failed",
  /** OCR_TIMEOUT_MS ran out. */
  "timeout",
  /** Read, but under MIN_TEXT_LENGTH characters or under OCR_MIN_CONFIDENCE. */
  "low_text",
  /** Rendering or recognition threw. */
  "error",
] as const;
export type OcrOutcome = (typeof OCR_OUTCOMES)[number];

/** The failure a recogniser throws. Carries an enum, never document text. */
export class OcrError extends Error {
  constructor(public outcome: OcrOutcome) {
    super(`ocr ${outcome}`);
    this.name = "OcrError";
  }
}

export type OcrProgress = { page: number; pages: number };

export type OcrResult = {
  /** Recognised text, pages joined by a blank line. */
  text: string;
  /** Mean confidence over the pages read, 0-100. */
  confidence: number;
  /** Pages in the document / pages actually read. */
  pages: number;
  pagesRead: number;
};

/** Bytes → recognised text. The browser implementation is ocrBrowser.ts; the
 *  Node suite injects its own. Throws OcrError. */
export type OcrRecogniser = (
  data: ArrayBuffer,
  ctx: {
    maxPages: number;
    /** Called before each page is read. */
    onProgress?: (p: OcrProgress) => void;
    /** Lets the caller stop the worker when the budget runs out. */
    onCancel: (cancel: () => void) => void;
  },
) => Promise<OcrResult>;

export type OcrFallback = {
  recognise: OcrRecogniser;
  /** The file turned out to be a scan and OCR is starting. */
  onStart?: () => void;
  onProgress?: (p: OcrProgress) => void;
  timeoutMs?: number;
};

/** The one switch. Off unless the build has NEXT_PUBLIC_OCR_IMPORT=1. */
export function ocrImportEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OCR_IMPORT === "1";
}

/** `no_text_layer` copy when OCR was tried and did not produce a usable read. */
export const OCR_FAILED_COPY =
  "This PDF is a scanned image, and its text could not be read clearly enough to import. Export a text-based PDF from Word or Google Docs and try again, or fill in your details below.";

/** A line that opens with what the English model makes of a bullet dot. */
const OCR_BULLET_RE = /^[+*«»■▪●◦°¢©®>~]\s+(?=\S)/;
/** "e Managed…" / "o Led…": a bullet read as a letter. Only trusted when the
 *  document has several such lines (see cleanOcrText). */
const OCR_LETTER_BULLET_RE = /^[eo]\s+(?=[A-Z])/;

/** " - " between two parts of a line. */
const SPACED_DASH_RE = / [-–—] /g;
/** The text before a dash ends like a date ("Mar 2021", "2019", "03/2021"). */
const DATE_BEFORE_RE = /(?:\b(?:19|20)\d{2}|\b\d{1,2}\/\d{2,4})$/;
/** The text after a dash starts like a date or an open end. */
const DATE_AFTER_RE =
  /^(?:(?:19|20)\d{2}\b|\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s|present\b|current\b|now\b|ongoing\b|to date\b|till\b|date\b)/i;

/**
 * A line with two or more " - " separators is, on the page, almost always a
 * row of items split by a middle dot or a bar ("Dubai · Mar 2021 - Present",
 * "Tendering · SAP Ariba · Cost Analysis"): the English model reads the dot
 * as a dash, and the parser then sees one long skill and "Abu Dhabi -" as a
 * location. Put the dot back, except inside a date range, which keeps its
 * dash. A line with a single dash ("Role - Company", "2013 - 2017") is left
 * exactly as read.
 */
function restoreSeparators(line: string): string {
  const dashes = line.match(SPACED_DASH_RE);
  if (!dashes || dashes.length < 2) return line;
  return line.replace(SPACED_DASH_RE, (m, offset: number) => {
    const before = line.slice(0, offset);
    const after = line.slice(offset + m.length);
    return DATE_BEFORE_RE.test(before) && DATE_AFTER_RE.test(after) ? m : " · ";
  });
}

/**
 * Tesseract's text → the shape a PDF text layer has: one visual line per
 * line, no blank lines inside a page, a bullet character where the page had a
 * bullet, a separator dot where the page had one (restoreSeparators). Only
 * marks are repaired; no word is changed and nothing is guessed
 * (an email read with a space in it stays as read: the review screen asks the
 * person to check it).
 */
export function cleanOcrText(raw: string): string {
  const lines = raw
    .normalize("NFKC")
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0);
  const letterBullets = lines.filter((l) => OCR_LETTER_BULLET_RE.test(l)).length >= 2;
  return lines
    .map((l) => {
      if (OCR_BULLET_RE.test(l)) return l.replace(OCR_BULLET_RE, "• ");
      if (letterBullets && OCR_LETTER_BULLET_RE.test(l)) {
        return l.replace(OCR_LETTER_BULLET_RE, "• ");
      }
      return l;
    })
    .map(restoreSeparators)
    .join("\n");
}

/**
 * Run the fallback for a PDF whose text layer is empty. Resolves with cleaned
 * text of at least MIN_TEXT_LENGTH characters, or throws
 * ImportParseError("no_text_layer") with `ocrOutcome` set, so a failed OCR
 * ends exactly where the import ended before OCR existed.
 */
export async function runOcrFallback(
  data: ArrayBuffer,
  ocr: OcrFallback,
): Promise<OcrResult> {
  const deadlineAt = Date.now() + (ocr.timeoutMs ?? OCR_TIMEOUT_MS);
  let cancel: (() => void) | undefined;
  const fail = (outcome: OcrOutcome) => {
    const err = new ImportParseError("no_text_layer", OCR_FAILED_COPY);
    err.ocrOutcome = outcome;
    return err;
  };
  let result: OcrResult;
  try {
    ocr.onStart?.();
    result = await withDeadline(
      ocr.recognise(data, {
        maxPages: OCR_MAX_PAGES,
        onProgress: ocr.onProgress,
        onCancel: (c) => {
          cancel = c;
        },
      }),
      deadlineAt,
      () => cancel?.(),
    );
  } catch (err) {
    if (err instanceof OcrError) throw fail(err.outcome);
    if (err instanceof ImportParseError && err.kind === "timeout") throw fail("timeout");
    // Never log the error object: it may quote recognised text.
    throw fail("error");
  }
  const text = cleanOcrText(result.text);
  if (text.length < MIN_TEXT_LENGTH || result.confidence < OCR_MIN_CONFIDENCE) {
    throw fail("low_text");
  }
  return { ...result, text };
}
