// PDF import adapter.
// Requires: pdfjs-dist (npm install pdfjs-dist)
// Worker is loaded from CDN to avoid Next.js bundling complexity.
// unspecified: worker CDN URL must be reachable; swap for local path in offline envs.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import { parseTextToDocument } from "./textParser";

/**
 * Extract raw text from a PDF in the browser using pdfjs-dist.
 * Browser-only — throws if called from the server.
 * Used by both the existing builder import flow (via pdfAdapter.parse)
 * and the new /resume-checker client-side pre-extraction.
 */
export async function extractPdfTextInBrowser(input: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("extractPdfTextInBrowser must run in the browser");
  }

  const pdfjsLib = await import("pdfjs-dist");

  // Point worker to CDN — avoids shipping the large worker bundle
  // unspecified: replace with a local /public path if CDN is unavailable
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await input.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

export const pdfAdapter: ImportAdapter = {
  name: "PDF",

  async parse(input: File): Promise<ParsedDocument> {
    if (typeof window === "undefined") return {};

    try {
      const fullText = await extractPdfTextInBrowser(input);
      return parseTextToDocument(fullText);
    } catch (err) {
      console.warn("[pdfAdapter] Parse failed:", err);
      return {};
    }
  },
};
