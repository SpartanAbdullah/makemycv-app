// DOCX import adapter.
// Requires: mammoth (npm install mammoth)
// Uses mammoth.extractRawText for the body, plus our own header/footer pass
// (docxParts.ts — mammoth reads word/document.xml only, and Word CV templates
// put the name and contact line in the header), then the shared heuristic
// parser. Every failure is an ImportParseError with a reason from
// importErrors.ts.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import {
  ImportParseError,
  MISMATCH_COPY,
  MIN_TEXT_LENGTH,
  classifyDocxError,
  sniffContainer,
  toImportParseError,
  unsupportedTypeMessage,
} from "./importErrors";
import { contactLinesOnly, readDocxHeaderFooter } from "./docxParts";
import { parseTextToDocument } from "./textParser";

/** The slice of mammoth this module uses — structural so the Node fixture
 *  suite can pass the real package and a test can pass a stub. */
export type MammothModule = {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};

/**
 * Text of a .docx from its bytes: header lines, then the body, then any
 * footer line that carries contact details. Throws ImportParseError with
 * unsupported_type (a Word 97-2003 .doc renamed), corrupt_docx or
 * parse_exception.
 */
export async function extractDocxText(
  buffer: ArrayBuffer,
  mammoth: MammothModule,
): Promise<string> {
  const container = sniffContainer(new Uint8Array(buffer));
  if (container === "ole") {
    throw new ImportParseError("unsupported_type", unsupportedTypeMessage("doc"));
  }
  // D11 (session 5): a PDF renamed .docx used to get "open it in Word and
  // save it again as .docx", which does not fit a PDF. Same reason, the
  // copy says what the file really is.
  if (container === "pdf") {
    throw new ImportParseError("corrupt_docx", MISMATCH_COPY.pdfNamedDocx);
  }
  if (container !== "zip") throw new ImportParseError("corrupt_docx");

  let body: string;
  try {
    body = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
  } catch (err) {
    const reason = classifyDocxError(err, container);
    // Never log the error object — JSZip quotes file bytes in its messages.
    console.warn(`[docxAdapter] extraction failed: ${reason}`);
    throw new ImportParseError(reason);
  }

  // Best-effort: a header we cannot read must not fail an import whose body
  // was fine.
  let headers: string[] = [];
  let footers: string[] = [];
  try {
    const parts = await readDocxHeaderFooter(buffer);
    headers = parts.headers;
    footers = contactLinesOnly(parts.footers);
  } catch {
    /* body only */
  }

  return [headers.join("\n"), body, footers.join("\n")]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}

/**
 * Extract raw text from a DOCX in the browser (mammoth). Shared by the
 * builder import (below) and the ATS checker's dropzone (2026-10-24, WP-2:
 * the checker accepted PDF only although this adapter had existed since
 * June — Word is the most common CV format among UAE job seekers).
 */
export async function extractDocxTextInBrowser(input: File): Promise<string> {
  let mammoth: MammothModule;
  try {
    mammoth = (await import("mammoth")) as unknown as MammothModule;
  } catch {
    throw new ImportParseError("worker_load_failed");
  }
  return extractDocxText(await input.arrayBuffer(), mammoth);
}

/** Bytes → ParsedDocument, shared by the browser adapter and the Node fixture
 *  suite. Throws ImportParseError only. */
export async function parseDocxBytes(
  buffer: ArrayBuffer,
  mammoth: MammothModule,
): Promise<ParsedDocument> {
  const text = await extractDocxText(buffer, mammoth);
  if (text.trim().length < MIN_TEXT_LENGTH) {
    throw new ImportParseError("empty_text");
  }
  try {
    return parseTextToDocument(text);
  } catch (err) {
    throw toImportParseError(err);
  }
}

export const docxAdapter: ImportAdapter = {
  name: "DOCX",

  async parse(input: File): Promise<ParsedDocument> {
    // Typed failures instead of swallow-to-`{}` — see pdfAdapter (UX-18).
    if (typeof window === "undefined") {
      throw new ImportParseError("parse_exception");
    }
    let mammoth: MammothModule;
    try {
      mammoth = (await import("mammoth")) as unknown as MammothModule;
    } catch {
      throw new ImportParseError("worker_load_failed");
    }
    return parseDocxBytes(await input.arrayBuffer(), mammoth);
  },
};
