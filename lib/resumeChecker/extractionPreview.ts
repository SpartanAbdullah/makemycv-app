/**
 * "What the ATS sees" — analysis of the text the browser extracted from a CV
 * file before the /resume-checker upload (FEATURE_BACKLOG B3, 2026-10-31).
 *
 * Everything in here runs in the browser on text that is already in the
 * browser: the panel shows the SAME string the dropzone is about to send to
 * /api/resume-checker/parse, and nothing extra leaves the device for it. The
 * sessionStorage carry-over below exists only so the report page can show the
 * same panel next to the server's findings; it is per-tab and never read by
 * a server route.
 *
 * Copy rule (CLAUDE.md, truthfulness): every note describes the extracted
 * TEXT ("the text has no email address"), never the person, and never claims
 * to know what the original file contained.
 */

export type ExtractionKind = "pdf" | "docx";

export type ExtractionInput = {
  text: string;
  kind: ExtractionKind;
  /** PDF page count from pdf.js. Unknown for DOCX (mammoth has no pages). */
  pages?: number;
};

export type ExtractionNote = {
  id:
    | "empty"
    | "sparse-pages"
    | "unmapped-glyphs"
    | "spaced-letters"
    | "no-email"
    | "no-phone"
    | "docx-headers";
  severity: "error" | "review";
  text: string;
};

export type ExtractionStats = {
  chars: number;
  words: number;
  lines: number;
  pages?: number;
  notes: ExtractionNote[];
};

/** Below this many words per page a text-based PDF almost certainly lost
 *  content to images, text boxes or an unembedded font. A sparse but honest
 *  one-page CV has ~200 words; a full page of CV text is 350–600. */
const SPARSE_WORDS_PER_PAGE = 120;

/** Unicode ranges a text layer uses when a glyph has no character mapping:
 *  U+FFFD (replacement), the Private Use Area (icon fonts such as Font
 *  Awesome put their symbols there) and C0/C1 controls. */
const UNMAPPED_RE = /[�-\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** "E X P E R I E N C E" — five or more single letters separated by single
 *  spaces on one line. ATS parsers read it as five words, not one heading. */
const SPACED_LETTERS_RE = /(?:^|\s)(?:[A-Za-z] ){4,}[A-Za-z](?=\s|$)/m;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+|00)?\d[\d\s().-]{6,}\d/g;

/** A phone-shaped run with at least 9 digits. The digit floor keeps a date
 *  range ("2019 - 2021", 8 digits) from passing as a phone number; a
 *  "no-phone" note is only suppressed by something that really looks like one. */
function hasPhoneNumber(text: string): boolean {
  for (const m of text.match(PHONE_RE) ?? []) {
    if (m.replace(/\D/g, "").length >= 9) return true;
  }
  return false;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function analyseExtraction(input: ExtractionInput): ExtractionStats {
  const text = input.text ?? "";
  const chars = text.length;
  const words = countWords(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  const notes: ExtractionNote[] = [];

  if (words === 0) {
    notes.push({
      id: "empty",
      severity: "error",
      text:
        input.kind === "pdf"
          ? "No text came out of this PDF. It is probably a scanned image or an exported picture — an ATS gets nothing from it."
          : "No text came out of this document. An ATS gets nothing from it.",
    });
    return { chars, words, lines, pages: input.pages, notes };
  }

  if (input.kind === "pdf" && input.pages && input.pages >= 2) {
    const perPage = words / input.pages;
    if (perPage < SPARSE_WORDS_PER_PAGE) {
      notes.push({
        id: "sparse-pages",
        severity: "error",
        text: `Only ${words} words across ${input.pages} pages. A PDF that long normally yields far more — text inside images, shapes or text boxes does not come through.`,
      });
    }
  }

  const unmapped = (text.match(UNMAPPED_RE) ?? []).length;
  if (unmapped > 0) {
    notes.push({
      id: "unmapped-glyphs",
      severity: "review",
      text: `${unmapped} ${unmapped === 1 ? "character" : "characters"} could not be mapped to a letter (shown as � or blank). Icon fonts and symbol bullets read this way.`,
    });
  }

  if (SPACED_LETTERS_RE.test(text)) {
    notes.push({
      id: "spaced-letters",
      severity: "review",
      text: "At least one heading reads as separate letters (e.g. E X P E R I E N C E). Wide letter-spacing breaks section detection.",
    });
  }

  if (!EMAIL_RE.test(text)) {
    notes.push({
      id: "no-email",
      severity: "review",
      text:
        input.kind === "docx"
          ? "The text has no email address. Word headers and footers are not part of the extracted text — contact details placed there are lost."
          : "The text has no email address. If the file shows one, it sits in an image or a header the text layer skipped.",
    });
  }

  if (!hasPhoneNumber(text)) {
    notes.push({
      id: "no-phone",
      severity: "review",
      text: "The text has no phone number.",
    });
  }

  return { chars, words, lines, pages: input.pages, notes };
}

// --- Carry-over to the report page (sessionStorage, same tab only) ---

export const PREVIEW_STORAGE_KEY = "makemycv:checkerPreview";
const PREVIEW_SHAPE_VERSION = 1;

export type StoredExtractionPreview = {
  v: typeof PREVIEW_SHAPE_VERSION;
  reportId: string;
  fileName: string;
  kind: ExtractionKind;
  pages?: number;
  text: string;
};

export function saveExtractionPreview(
  entry: Omit<StoredExtractionPreview, "v">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredExtractionPreview = { v: PREVIEW_SHAPE_VERSION, ...entry };
    window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage blocked (private mode) — the report page simply has no panel */
  }
}

/**
 * Read the carried-over text for `reportId`. Discards (and removes) anything
 * with another shape version or another report id — a stale record must never
 * be shown against the wrong report.
 */
export function loadExtractionPreview(
  reportId: string,
): StoredExtractionPreview | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredExtractionPreview> | null;
    if (
      !parsed ||
      parsed.v !== PREVIEW_SHAPE_VERSION ||
      typeof parsed.text !== "string" ||
      typeof parsed.reportId !== "string" ||
      (parsed.kind !== "pdf" && parsed.kind !== "docx")
    ) {
      window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      return null;
    }
    if (parsed.reportId !== reportId) return null;
    return {
      v: PREVIEW_SHAPE_VERSION,
      reportId: parsed.reportId,
      fileName: typeof parsed.fileName === "string" ? parsed.fileName : "",
      kind: parsed.kind,
      pages: typeof parsed.pages === "number" ? parsed.pages : undefined,
      text: parsed.text,
    };
  } catch {
    return null;
  }
}
