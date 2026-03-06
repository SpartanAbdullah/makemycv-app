// PDF import adapter.
// Requires: pdfjs-dist (npm install pdfjs-dist)
// Worker is loaded from CDN to avoid Next.js bundling complexity.
// unspecified: worker CDN URL must be reachable; swap for local path in offline envs.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import { parseTextToDocument } from "./textParser";

export const pdfAdapter: ImportAdapter = {
  name: "PDF",

  async parse(input: File): Promise<ParsedDocument> {
    if (typeof window === "undefined") return {};

    try {
      // Dynamic import avoids SSR issues
      const pdfjsLib = await import("pdfjs-dist");

      // Point worker to CDN — avoids shipping the large worker bundle
      // unspecified: replace with a local /public path if CDN is unavailable
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await (input as File).arrayBuffer();
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

      return parseTextToDocument(fullText);
    } catch (err) {
      console.warn("[pdfAdapter] Parse failed:", err);
      return {};
    }
  },
};
