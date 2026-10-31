// Arabic PDF smoke — the check half (session 4, 2026-10-31). Run by
// `npm run smoke:arabic` after scripts/arabic-smoke.tsx has rendered
// .arabic-smoke/*.pdf and its manifest. For every file it
//  1. extracts the pdf.js text layer and rebuilds each line in logical order
//     (items sorted by x; a run of touching right-to-left items is a word or
//     phrase textkit drew visually, so its item order is reversed back);
//  2. asserts every Arabic word of the persona (name, headline, summary,
//     roles, companies, bullets, schools, degrees) is in the text layer after
//     NFKC — the PDF carries presentation forms, see lib/pdf/arabicText.ts;
//  3. asserts no U+FFFD and no junk: a character that is neither ASCII, nor
//     Arabic, nor in the persona's own text, nor a template glyph (bullets,
//     dashes, quotes) — the session-3 symptom was "ÝÆ#"-style Latin-1 runs;
//  4. asserts the page count (the dense persona must reach page 2 with
//     Arabic text on it — pagination, not just page 1);
//  5. rasterises page 1 (and page 2 of the dense persona) to
//     .arabic-smoke/<template>-<persona>-p<n>.png for a human look.
// Plain ESM on purpose: pdfjs-dist ships ESM and the renderer is compiled to
// CommonJS (same split as scripts/pdf-ops-check.mjs).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = require("@napi-rs/canvas");
const STANDARD_FONTS = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + path.sep;

const DIR = path.join(process.cwd(), ".arabic-smoke");
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const STRIP = /[ً-ْٰ​-‏]/g;
const TEMPLATE_GLYPHS = new Set([..."•·–—‘’“”…✓✔|→◦▪●○■□▸▹"]);
const SCALE = 1.5;

const normWord = (w) => w.normalize("NFKC").replace(STRIP, "").replace(/^[\s،؛؟.,:;()|·—–"'“”‘’]+|[\s،؛؟.,:;()|·—–"'“”‘’]+$/g, "");

/** Lines of a page in logical order, from the pdf.js items. */
function pageLines(items) {
  const rows = new Map();
  for (const it of items) {
    if (!("str" in it) || !it.str) continue;
    const y = Math.round(it.transform[5] * 2) / 2;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(it);
  }
  const lines = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.transform[4] - b.transform[4]);
    // A group ends at a horizontal gap or where the direction of the next
    // lettered item changes (a Latin phrase inside an Arabic bullet).
    const groups = [];
    let g = [];
    let gDir = null;
    for (let i = 0; i < row.length; i += 1) {
      const it = row[i];
      const dir = normWord(it.str) ? it.dir : null;
      if (g.length && dir && gDir && dir !== gDir) {
        groups.push(g);
        g = [];
        gDir = null;
      }
      g.push(it);
      if (dir) gDir = dir;
      const nx = row[i + 1];
      if (!nx || nx.transform[4] - (it.transform[4] + it.width) > 0.9) {
        groups.push(g);
        g = [];
        gDir = null;
      }
    }
    // A touching group whose lettered items are all right-to-left is one word
    // or phrase textkit drew visually (pdf.js splits items at positioning
    // adjustments, e.g. before a mark), so its item order is reversed back.
    // Items that hold only spaces, marks or punctuation take no side.
    lines.push(
      groups
        .map((grp) => {
          const lettered = grp.filter((it) => normWord(it.str));
          const rtl = lettered.length > 0 && lettered.every((it) => it.dir === "rtl");
          return (rtl ? [...grp].reverse() : grp).map((it) => it.str).join("");
        })
        .join(" "),
    );
  }
  return lines;
}

async function checkFile(entry) {
  const data = new Uint8Array(fs.readFileSync(entry.file));
  const doc = await pdfjs.getDocument({ data, standardFontDataUrl: STANDARD_FONTS, useSystemFonts: false }).promise;
  const failures = [];
  const words = new Set();
  const perPageArabicWords = [];
  let text = "";
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const items = (await page.getTextContent()).items;
    const lines = pageLines(items);
    let arabicOnPage = 0;
    for (const line of lines) {
      text += line + "\n";
      for (const w of line.split(/\s+/)) {
        const n = normWord(w);
        if (!n) continue;
        words.add(n);
        if (ARABIC.test(n)) arabicOnPage += 1;
      }
    }
    perPageArabicWords.push(arabicOnPage);
    if (p === 1 || (p === 2 && entry.minPages >= 2)) {
      const vp = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(vp.width, vp.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      fs.writeFileSync(entry.file.replace(/\.pdf$/, `-p${p}.png`), canvas.toBuffer("image/png"));
    }
  }
  // 2. every expected Arabic word survives (after NFKC)
  const missing = entry.words.map(normWord).filter((w) => w && !words.has(w));
  if (missing.length) failures.push(`${missing.length}/${entry.words.length} Arabic words missing from the text layer: ${missing.slice(0, 6).join(" ")}${missing.length > 6 ? " …" : ""}`);
  // 3. no replacement characters, no junk
  const fffd = (text.match(/�/g) || []).length;
  if (fffd) failures.push(`${fffd} U+FFFD in the text layer`);
  const allowed = new Set([...entry.inputText.normalize("NFKC")]);
  const junk = new Map();
  for (const ch of text.normalize("NFKC")) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80 || ARABIC.test(ch) || allowed.has(ch) || TEMPLATE_GLYPHS.has(ch) || /\s/.test(ch)) continue;
    junk.set(ch, (junk.get(ch) || 0) + 1);
  }
  if (junk.size) failures.push(`junk characters in the text layer: ${[...junk.entries()].map(([c, n]) => `${c}(U+${c.codePointAt(0).toString(16)})×${n}`).join(" ")}`);
  // 4. pagination
  if (doc.numPages < entry.minPages) failures.push(`${doc.numPages} page(s), expected at least ${entry.minPages}`);
  if (entry.minPages >= 2 && doc.numPages >= 2 && perPageArabicWords[1] < 15) failures.push(`page 2 carries only ${perPageArabicWords[1]} Arabic words`);
  return { pages: doc.numPages, found: entry.words.length - missing.length, total: entry.words.length, arabicPerPage: perPageArabicWords, failures };
}

let failed = 0;
const rows = [];
for (const entry of manifest) {
  const r = await checkFile(entry);
  const tag = r.failures.length ? "FAIL" : "ok";
  if (r.failures.length) failed += 1;
  rows.push({ template: entry.template, persona: entry.persona, pages: r.pages, words: `${r.found}/${r.total}`, arabicPerPage: r.arabicPerPage.join("+"), status: tag, failures: r.failures });
  console.log(`${tag.padEnd(4)} ${entry.template.padEnd(19)} ${entry.persona.padEnd(13)} pages=${r.pages} words=${r.found}/${r.total} arabic/page=${r.arabicPerPage.join("+")}${r.failures.length ? "\n       " + r.failures.join("\n       ") : ""}`);
}
fs.writeFileSync(path.join(DIR, "results.json"), JSON.stringify(rows, null, 2));
console.log(`\narabic smoke: ${manifest.length - failed}/${manifest.length} files passed (page-1 rasters in .arabic-smoke/)`);
if (failed) process.exit(1);
