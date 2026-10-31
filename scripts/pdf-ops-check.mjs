// Operator-level regression checks on the smoke PDFs (run by `npm run smoke:pdf`
// after scripts/pdf-smoke.tsx has rendered .smoke-pdfs/*.pdf; audit 2026-10):
//  1. no neon-green colour operator anywhere — the signature of an alpha colour
//     that react-pdf wrote as 8-digit hex and pdfkit misparsed as [0,255,38];
//  2. every edge-bleed sidebar band (Executive 150pt left, Onyx 172pt left,
//     Sandstone 180pt left, Corporate 165pt right) is a full-height rectangle
//     flush with its page edge on EVERY page — the Executive band used to
//     start 27pt down on page 2+, and the other three left the same notch at
//     the top of page 2+ and the foot of page 1 until 2026-10-25;
//  3. page counts, for the log;
//  4. the Harvard graduate persona (harvard-persona.pdf) is ONE page — the
//     template's whole point (template audit 2026-10, shortlist item 4).
// Plain ESM on purpose: pdfjs-dist ships ESM and the smoke script is compiled
// to CommonJS.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
const { getDocument, OPS } = pdfjs;

// Band width in pt and which page edge it hugs, per template id. A file is
// matched by "<id>.pdf" or "<id>-<variant>.pdf".
const BANDS = {
  executive: { width: 150, side: 'left' },
  onyx: { width: 165, side: 'left' }, // pt(220) — live 220px (fidelity rank 3, 2026-10-31)
  sandstone: { width: 172.5, side: 'left' }, // pt(230) — live 230px
  'corp-sidebar': { width: 165, side: 'right' },
};

const dir = path.join(process.cwd(), '.smoke-pdfs');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf')).sort();
let failures = 0;
for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, f)));
  const doc = await getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const band = Object.entries(BANDS).find(([id]) => f === `${id}.pdf` || f.startsWith(`${id}-`))?.[1];
  const report = { file: f, pages: doc.numPages, neon: 0, bands: [] };
  const pagesWithBand = new Set();
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const pageWidth = page.view[2] - page.view[0];
    const pageHeight = page.view[3] - page.view[1];
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
      if (band) {
        for (const [x, y, w, h] of rects) {
          if (Math.abs(Math.abs(w) - band.width) >= 1 || Math.abs(h) < pageHeight - 1) continue;
          // y is 0 or -h depending on which way pdf.js reports the transform.
          const flushTop = Math.abs(y) < 0.5 || Math.abs(Math.abs(y) - Math.abs(h)) < 0.5;
          const flushSide = band.side === 'left' ? Math.abs(x) < 0.5 : Math.abs(x + Math.abs(w) - pageWidth) < 0.5;
          report.bands.push({ page: p, x: +x.toFixed(1), y: +y.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) });
          if (flushTop && flushSide) pagesWithBand.add(p);
        }
      }
    }
  }
  const bandOk = band ? pagesWithBand.size === doc.numPages : true;
  const onePageOk = f === 'harvard-persona.pdf' ? doc.numPages === 1 : true;
  const ok = report.neon === 0 && bandOk && onePageOk;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}: pages=${report.pages} neonColourOps=${report.neon}${band ? ` bandPages=${pagesWithBand.size}/${doc.numPages}` : ''}${onePageOk ? '' : ' (expected one page)'}`);
}
console.log(failures ? `FAILURES: ${failures}` : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
