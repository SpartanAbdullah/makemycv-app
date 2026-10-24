// Operator-level regression checks on the smoke PDFs (run by `npm run smoke:pdf`
// after scripts/pdf-smoke.tsx has rendered .smoke-pdfs/*.pdf; audit 2026-10):
//  1. no neon-green colour operator anywhere — the signature of an alpha colour
//     that react-pdf wrote as 8-digit hex and pdfkit misparsed as [0,255,38];
//  2. the Executive band is a full-height 150pt rectangle at the page edge on
//     EVERY page (it used to start 27pt down on page 2+);
//  3. page counts, for the log.
// Plain ESM on purpose: pdfjs-dist ships ESM and the smoke script is compiled
// to CommonJS.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
const { getDocument, OPS } = pdfjs;

const dir = path.join(process.cwd(), '.smoke-pdfs');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf')).sort();
let failures = 0;
for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, f)));
  const doc = await getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const report = { file: f, pages: doc.numPages, neon: 0, bands: [] };
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i], args = ops.argsArray[i];
      if (fn === OPS.setStrokeRGBColor || fn === OPS.setFillRGBColor) {
        const [r, g, b] = args;
        if (r <= 12 && g >= 240 && b >= 20 && b <= 70) report.neon++;
      }
      // pdf.js folds path construction into one constructPath op whose args
      // are [subOps[], coords] (coords flat; rectangle consumes 4).
      const rects = [];
      if (fn === OPS.rectangle) rects.push(args);
      else if (fn === OPS.constructPath) {
        const subOps = args[0]; const coords = Array.from(args[1] ?? []); let c = 0;
        for (const op of subOps) {
          if (op === OPS.rectangle) { rects.push(coords.slice(c, c + 4)); c += 4; }
          else if (op === OPS.moveTo || op === OPS.lineTo) c += 2;
          else if (op === OPS.curveTo) c += 6;
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) c += 4;
        }
      }
      for (const [x, y, w, h] of rects) {
        if (Math.abs(Math.abs(w) - 150) < 1 && Math.abs(h) > 800) report.bands.push({ page: p, x: +x.toFixed(1), y: +y.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) });
      }
    }
  }
  const execOk = f.startsWith('executive') ? report.bands.length >= doc.numPages && report.bands.every((b) => Math.abs(b.x) < 0.5 && (Math.abs(b.y) < 0.5 || Math.abs(Math.abs(b.y) - Math.abs(b.h)) < 0.5)) : true;
  if (report.neon > 0 || !execOk) failures++;
  console.log(`${report.neon > 0 || !execOk ? 'FAIL' : 'ok  '} ${f}: pages=${report.pages} neonColourOps=${report.neon}${f.startsWith('executive') ? ' bands=' + JSON.stringify(report.bands) : ''}`);
}
console.log(failures ? `FAILURES: ${failures}` : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
