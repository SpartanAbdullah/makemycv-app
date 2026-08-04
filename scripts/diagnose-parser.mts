/* Diagnose: which stage loses the sections when importing the app's own PDF?
   Stage 1: pdfjs extraction + the SAME line reconstruction as pdfAdapter.
   Stage 2: parseTextToDocument on that text.
   Run from mmc-polish-wt via the site's tsx. */
import fs from "node:fs";
import { parseTextToDocument } from "../lib/importers/textParser";

const PDF = "C:/Users/MUHAMM~1/AppData/Local/Temp/claude/C--Users-MuhammadAbdullah-Desktop-Makemycv-makemycv-site/4e6e7676-199d-42e0-8c9b-9d6f08fbe895/scratchpad/sara.pdf";

type Item = { str: string; transform: number[]; width?: number; height?: number };

// verbatim port of pdfAdapter.reconstructLines
function reconstructLines(items: Item[]): string[] {
  if (items.length === 0) return [];
  const real = items.filter((i) => typeof i.str === "string" && i.str.length > 0);
  if (real.length === 0) return [];
  const heights = real.map((i) => i.height ?? Math.abs(i.transform?.[3] ?? 10)).filter((h) => h > 0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;
  const lineTolerance = Math.max(medianHeight * 0.5, 2);
  const sorted = [...real].sort((a, b) => {
    const ay = a.transform?.[5] ?? 0, by = b.transform?.[5] ?? 0;
    if (Math.abs(by - ay) > lineTolerance) return by - ay;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });
  const lines: Item[][] = [];
  let currentY = Number.POSITIVE_INFINITY;
  let bucket: Item[] = [];
  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0;
    if (bucket.length === 0) { bucket.push(item); currentY = y; }
    else if (Math.abs(y - currentY) <= lineTolerance) bucket.push(item);
    else { lines.push(bucket); bucket = [item]; currentY = y; }
  }
  if (bucket.length > 0) lines.push(bucket);
  return lines.map((line) => {
    line.sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0));
    let out = ""; let prevEndX = -Infinity;
    for (const item of line) {
      const startX = item.transform?.[4] ?? 0;
      const text = item.str;
      if (out.length === 0) out = text;
      else {
        const needsSpace = !/\s$/.test(out) && !/^\s/.test(text) && startX - prevEndX > medianHeight * 0.25;
        out += needsSpace ? " " + text : text;
      }
      prevEndX = startX + (item.width ?? text.length * (medianHeight * 0.5));
    }
    return out.replace(/[ \t]+/g, " ").trim();
  });
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(fs.readFileSync(PDF));
const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
const pages: string[] = [];
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  pages.push(reconstructLines(content.items as Item[]).join("\n"));
}
const fullText = pages.join("\n\n");
console.log("=== STAGE 1: reconstructed text (" + fullText.length + " chars) ===");
console.log(fullText.slice(0, 1800));
console.log("=== /text ===\n");

const doc = parseTextToDocument(fullText);
console.log("=== STAGE 2: parsed document keys ===");
for (const [k, v] of Object.entries(doc)) {
  const desc = Array.isArray(v) ? `array(${v.length})` : typeof v === "string" ? JSON.stringify(v.slice(0, 60)) : JSON.stringify(v)?.slice(0, 80);
  console.log("  " + k + ": " + desc);
}
