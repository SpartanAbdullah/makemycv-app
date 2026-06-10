// DOCX import adapter.
// Requires: mammoth (npm install mammoth)
// Uses mammoth.extractRawText to get plain text, then runs the shared heuristic parser.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import { ImportParseError } from "./adapter";
import { parseTextToDocument } from "./textParser";

const MIN_TEXT_LENGTH = 200;

export const docxAdapter: ImportAdapter = {
  name: "DOCX",

  async parse(input: File): Promise<ParsedDocument> {
    if (typeof window === "undefined") return {};

    // Typed failures instead of swallow-to-`{}` — see pdfAdapter (UX-18).
    let text: string;
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await (input as File).arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      text = result.value;
    } catch (err) {
      console.warn("[docxAdapter] Extraction failed:", err);
      throw new ImportParseError(
        "corrupt-file",
        "This DOCX could not be opened. It may be corrupted or in an older .doc format — save it as .docx and try again.",
      );
    }
    if (text.trim().length < MIN_TEXT_LENGTH) {
      throw new ImportParseError(
        "empty-text",
        "This document has almost no readable text. Check the file and try again.",
      );
    }
    return parseTextToDocument(text);
  },
};
