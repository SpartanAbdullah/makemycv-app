// CV-import failure taxonomy (2026-10-31).
//
// One closed set of `error_reason` values for the `cv_import_failed` analytics
// event, the pre-parse file gate, the classification of pdf.js / mammoth
// exceptions, and the user-facing copy for each reason. Pure TypeScript, no
// browser APIs — unit-tested in Node (importErrors.test.ts) and exercised
// against the synthetic fixtures by scripts/import-fixtures.test.mjs.
//
// Privacy: everything here is an enum or a count. The file NAME never leaves
// this module's callers (only its extension bucket does), and no text from
// the document is ever part of a reason or a message. See docs/import-errors.md.

/** Every value `cv_import_failed.error_reason` may carry. Adding one means
 *  adding its copy below and a row in docs/import-errors.md. */
export const IMPORT_ERROR_REASONS = [
  // --- pre-parse gate (BuilderShell, before any adapter runs)
  /** Extension is not .pdf / .docx — includes legacy .doc, images/HEIC, .pages, .txt. */
  "unsupported_type",
  /** 0-byte file (a failed download, a cloud placeholder not yet synced). */
  "empty_file",
  /** Larger than MAX_IMPORT_BYTES. */
  "too_large",
  // --- PDF adapter
  /** pdf.js asked for a password (PasswordException). */
  "encrypted_pdf",
  /** PDF opened but its text layer is under MIN_TEXT_LENGTH chars — a scan. */
  "no_text_layer",
  /** pdf.js could not parse the bytes (InvalidPDFException and friends). */
  "corrupt_pdf",
  /** The pdf.js worker script could not be loaded (local and CDN). */
  "worker_load_failed",
  /** Extraction exceeded PDF_TIMEOUT_MS / DOCX_TIMEOUT_MS. */
  "timeout",
  // --- DOCX adapter
  /** Not a zip / no document part — a damaged or mislabelled .docx. */
  "corrupt_docx",
  /** DOCX opened but carries under MIN_TEXT_LENGTH chars (picture-only). */
  "empty_text",
  // --- after extraction
  /** The text parser or the field mapper threw. */
  "parse_exception",
  /** Parsed fine, but not one importable section came out. */
  "mapping_empty",
  // --- report→builder hand-off (ImportFromReportBanner, file_type ats_report)
  "report_expired",
  "report_fetch_failed",
  "report_no_cv",
  "report_network",
] as const;

export type ImportErrorReason = (typeof IMPORT_ERROR_REASONS)[number];

/** `file_type` buckets. An extension, never a name — and bucketed, so an odd
 *  extension ("cv.john-smith") cannot smuggle a token into analytics. */
export const IMPORT_FILE_TYPES = [
  "pdf",
  "docx",
  "doc",
  "image",
  "text",
  "other",
  "none",
  "ats_report",
] as const;
export type ImportFileType = (typeof IMPORT_FILE_TYPES)[number];

/** Above this the picker refuses the file before reading it. Text CVs are
 *  well under 2 MB; 15 MB admits a PDF with an embedded photo and keeps a
 *  phone from chewing on a 100-page scan for a minute. */
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
/** Below this many characters of extracted text the document is treated as
 *  having no usable text layer (mirrors the /resume-checker guard). */
export const MIN_TEXT_LENGTH = 200;
/** Whole-document budget for pdf.js extraction. */
export const PDF_TIMEOUT_MS = 45_000;
/** The same budget for a Word file: mammoth chunk + read + parse (session 7;
 *  until then a DOCX read had no deadline at all). */
export const DOCX_TIMEOUT_MS = PDF_TIMEOUT_MS;
/** Pages read past this are ignored — a CV never needs them and a 300-page
 *  mis-pick would otherwise run into the timeout instead of importing. */
export const MAX_PDF_PAGES = 30;

/** After this long on "Reading your PDF/DOCX" the import overlay adds a
 *  "still reading your file…" line (D10, session 6). */
export const SLOW_READ_HINT_MS = 8_000;

/**
 * Race `work` against an absolute deadline (epoch ms). On expiry the promise
 * rejects with ImportParseError("timeout") and `onExpire` runs (e.g. to
 * destroy a pdf.js task). A deadline already past rejects at once.
 *
 * D10 (session 6): the PDF budget used to start inside `extractPdfText`, so
 * the adapter chunk, the pdf.js import and the worker probe that precede it
 * were unbounded (57 s seen on a slow link with no timeout). Callers now fix
 * the deadline when the pick starts and pass it down through every step.
 */
export function withDeadline<T>(
  work: Promise<T>,
  deadlineAt: number,
  onExpire?: () => void,
  /** Copy for the timeout; the PDF wording when omitted. */
  message?: string,
): Promise<T> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) {
    onExpire?.();
    // Keep a late rejection of `work` from surfacing as unhandled.
    work.catch(() => {});
    return Promise.reject(new ImportParseError("timeout", message));
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ImportParseError("timeout", message));
      onExpire?.();
    }, remaining);
  });
  return Promise.race([work, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export class ImportParseError extends Error {
  constructor(
    public kind: ImportErrorReason,
    message?: string,
  ) {
    super(message ?? importErrorMessage(kind));
    this.name = "ImportParseError";
  }
}

/** Any thrown value → ImportParseError. Unknown errors become
 *  `parse_exception`; the original message is NOT carried (it could quote
 *  document text). */
export function toImportParseError(err: unknown): ImportParseError {
  return err instanceof ImportParseError
    ? err
    : new ImportParseError("parse_exception");
}

const IMAGE_EXT = new Set([
  "jpg", "jpeg", "png", "heic", "heif", "gif", "webp", "bmp", "tif", "tiff",
]);
const TEXT_EXT = new Set(["txt", "rtf", "md", "odt", "pages", "html", "htm"]);

/** Lower-cased extension bucket of a file name. */
export function importFileType(name: string): ImportFileType {
  // Anything after the last dot counts as the extension candidate, so an odd
  // tail ("cv.final-v2") lands in "other" rather than "none".
  const m = /\.([^.\/\s]{1,16})$/.exec(name.trim());
  if (!m) return "none";
  const ext = m[1].toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "docm") return "docx";
  if (ext === "doc" || ext === "dot") return "doc";
  if (IMAGE_EXT.has(ext)) return "image";
  if (TEXT_EXT.has(ext)) return "text";
  return "other";
}

/** Pre-parse gate on name + size. Returns the error to surface, or null when
 *  the file may go to an adapter. Order matters: a 0-byte .jpg is reported
 *  as unsupported (the type is the thing the user can act on), a 0-byte .pdf
 *  as empty. */
export function gateImportFile(file: {
  name: string;
  size: number;
}): ImportParseError | null {
  const type = importFileType(file.name);
  if (type !== "pdf" && type !== "docx") {
    return new ImportParseError(
      "unsupported_type",
      unsupportedTypeMessage(type),
    );
  }
  if (file.size === 0) return new ImportParseError("empty_file");
  if (file.size > MAX_IMPORT_BYTES) return new ImportParseError("too_large");
  return null;
}

export type Container = "pdf" | "zip" | "ole" | "unknown";

/** What the first bytes say the file is, regardless of its extension.
 *  `%PDF` may sit after up to 1 KB of junk (pdf.js tolerates the same). */
export function sniffContainer(bytes: Uint8Array): Container {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return "zip";
    }
    if (
      bytes.length >= 8 &&
      bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
    ) {
      return "ole";
    }
  }
  const head = bytes.subarray(0, Math.min(bytes.length, 1024));
  for (let i = 0; i + 4 <= head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) {
      return "pdf";
    }
  }
  return "unknown";
}

/** A zip whose entries include `word/…` — a Word .docx (as opposed to an
 *  .xlsx, .pptx or any other zip). Entry names sit in plain ASCII in the
 *  local file headers, which Word writes at the start of the archive. */
export function zipLooksLikeDocx(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  // "word/" = 77 6f 72 64 2f
  for (let i = 0; i + 5 <= head.length; i++) {
    if (
      head[i] === 0x77 && head[i + 1] === 0x6f && head[i + 2] === 0x72 &&
      head[i + 3] === 0x64 && head[i + 4] === 0x2f
    ) {
      return true;
    }
  }
  return false;
}

/**
 * D11 (session 5): the extension says one format, the bytes another. The
 * byte sniff already knows which, so the copy names the real type and the
 * fix (rename) instead of "damaged, re-export". The `error_reason` stays the
 * one the adapter for the extension reports (corrupt_pdf / corrupt_docx), so
 * analytics are unchanged.
 */
export const MISMATCH_COPY = {
  /** .docx name, PDF bytes — reported as corrupt_docx. */
  pdfNamedDocx:
    "This file is actually a PDF with a .docx name. Rename it to end in .pdf, or pick the original PDF, and import it again.",
  /** .pdf name, Word .docx bytes — reported as corrupt_pdf. */
  docxNamedPdf:
    "This file is actually a Word document with a .pdf name. Rename it to end in .docx, or pick the original Word file, and import it again.",
  /** .pdf name, Word 97-2003 .doc bytes — reported as corrupt_pdf. */
  docNamedPdf:
    "This file is actually an older Word .doc file with a .pdf name. Open it in Word, choose Save As → Word Document (.docx), and import that file.",
} as const;

/** Map a pdf.js (or our own) exception to a reason. pdf.js sets `name` on
 *  every exception class explicitly, so it survives minification and the
 *  worker boundary. */
export function classifyPdfError(err: unknown): ImportErrorReason {
  if (err instanceof ImportParseError) return err.kind;
  const name = (err as { name?: unknown })?.name;
  const message = String((err as { message?: unknown })?.message ?? "");
  if (name === "PasswordException") return "encrypted_pdf";
  if (/fake worker|worker/i.test(message) && /fail|load|import|script/i.test(message)) {
    return "worker_load_failed";
  }
  if (
    name === "InvalidPDFException" ||
    name === "FormatError" ||
    name === "MissingPDFException" ||
    name === "UnexpectedResponseException" ||
    name === "UnknownErrorException" ||
    /invalid pdf|pdf structure|xref|bad .*pdf/i.test(message)
  ) {
    return "corrupt_pdf";
  }
  return "parse_exception";
}

/** Map a mammoth/JSZip exception to a reason, with the byte sniff deciding
 *  between "an old .doc renamed" and "damaged". */
export function classifyDocxError(
  err: unknown,
  container: Container,
): ImportErrorReason {
  if (err instanceof ImportParseError) return err.kind;
  if (container === "ole") return "unsupported_type";
  return "corrupt_docx";
}

/* ── User-facing copy ───────────────────────────────────────────────────── */

const CHECKER_HINT =
  " You can also try the free AI Resume Checker, which handles more layouts.";

/** Copy per reason — describes the document and gives the next step. Shown in
 *  the builder's error bar; mirrored in docs/import-errors.md. */
export const IMPORT_ERROR_COPY: Record<ImportErrorReason, string> = {
  unsupported_type:
    "Only PDF and Word (.docx) files can be imported. Export your CV as one of those and try again.",
  empty_file:
    "This file is empty (0 bytes). Re-export it from the original document and try again.",
  too_large:
    "This file is larger than 15 MB. Export a lighter PDF — without a high-resolution photo — and try again.",
  encrypted_pdf:
    "This PDF is password-protected, so it cannot be read. Open it, remove the password (Print → Save as PDF also works) and import the new file.",
  no_text_layer:
    "This PDF has no readable text — it looks like a scanned image. Export a text-based PDF from Word or Google Docs and try again.",
  corrupt_pdf:
    "This PDF could not be opened — it may be damaged, or not really a PDF. Re-export it from the original document and try again.",
  worker_load_failed:
    "The PDF reader could not load in this browser (a network or ad blocker often causes this). Reload the page and try again, or import a Word (.docx) version instead.",
  timeout:
    "Reading this PDF took too long. Try a smaller or simpler export, or import a Word (.docx) version instead.",
  corrupt_docx:
    "This Word file could not be opened — it may be damaged, or not really a .docx. Open it in Word and save it again as .docx.",
  empty_text:
    "This Word file has almost no readable text. If the CV is a picture inside the document, export a text-based version and try again.",
  parse_exception:
    "Something went wrong while reading this file. Try again — or fill in your details below.",
  mapping_empty:
    "The file was read, but no CV sections (name, experience, education, skills) could be found in it. Check that it is a CV written in English." +
    CHECKER_HINT,
  report_expired: "This report expired. Reports are kept for 24 hours.",
  report_fetch_failed: "Couldn't import the report. Try uploading the CV again.",
  report_no_cv: "Report returned no CV data.",
  report_network: "Network error while importing the report.",
};

/** `timeout` copy for a Word file — the reason's default copy names a PDF and
 *  suggests a Word version (session 7, DOCX read deadline). */
export const DOCX_TIMEOUT_COPY =
  "Reading this Word file took too long. A slow connection can cause this — try again, or save it as a PDF and import that instead.";

/** Type-specific wording for `unsupported_type` — the one reason where the
 *  next step depends on what was picked. */
export function unsupportedTypeMessage(type: ImportFileType): string {
  switch (type) {
    case "doc":
      return "This is an older Word .doc file. Open it in Word, choose Save As → Word Document (.docx), and import that file.";
    case "image":
      return "This is a photo or image, which has no text that can be read. Export a text-based PDF or Word (.docx) file from the original document and try again.";
    case "text":
      return "This format isn't supported yet. Export your CV as a PDF or Word (.docx) file and try again.";
    default:
      return IMPORT_ERROR_COPY.unsupported_type;
  }
}

export function importErrorMessage(reason: ImportErrorReason): string {
  return IMPORT_ERROR_COPY[reason];
}

export function isImportErrorReason(v: unknown): v is ImportErrorReason {
  return (IMPORT_ERROR_REASONS as readonly string[]).includes(String(v));
}
