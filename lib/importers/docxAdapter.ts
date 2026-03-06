// DOCX import adapter.
// Requires: mammoth (npm install mammoth)
// Uses mammoth.extractRawText to get plain text, then runs the shared heuristic parser.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import { parseTextToDocument } from "./textParser";

export const docxAdapter: ImportAdapter = {
  name: "DOCX",

  async parse(input: File): Promise<ParsedDocument> {
    if (typeof window === "undefined") return {};

    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await (input as File).arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return parseTextToDocument(result.value);
    } catch (err) {
      console.warn("[docxAdapter] Parse failed:", err);
      return {};
    }
  },
};
