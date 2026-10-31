// Guard for scripts/patch-react-pdf-textkit.mjs (session 6, 2026-10-31, E8.1).
// Run by `npm run test:textkit-patch` (picked up by `npm test`, so CI).
//  1. The installed @react-pdf/textkit carries the patch (postinstall ran and
//     the anchor still matched). If textkit is upgraded this fails until the
//     patch is ported — the alternative is Arabic text layers that silently
//     split inside words again.
//  2. patchSource() is idempotent and leaves unknown sources alone.
//  3. Behaviour: a real react-pdf render of mixed Arabic lines (digits, "%",
//     Latin) in Vazirmatn, read back with pdf.js: every Arabic word of each
//     line is whole inside ONE text item (session 5: pdf.js lost 3 of 14
//     words of persona A's b1 and 1 of 7 of b2), and a Latin-only line is
//     still a single item.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { ANCHOR, MARKER, patchSource, textkitFile } from "./patch-react-pdf-textkit.mjs";

const cwd = process.cwd();
const require = createRequire(path.join(cwd, "package.json"));

// 1. installed copy is patched
const { file, version } = textkitFile(cwd);
assert.ok(fs.readFileSync(file, "utf8").includes(MARKER), `@react-pdf/textkit ${version} is not patched — run \`node scripts/patch-react-pdf-textkit.mjs\` (postinstall) or port the patch`);

// 2. patchSource
const sample = `const reorderLine = (line) => {\n${ANCHOR}\n    return line;\n};`;
const once = patchSource(sample);
assert.equal(once.status, "patched");
assert.equal(patchSource(once.source).status, "already-applied");
assert.equal(patchSource("const x = 1;").status, "anchor-missing");

// 3. behaviour
const { renderToBuffer, Document, Page, Text, View, Font } = await import(pathToFileURL(require.resolve("@react-pdf/renderer")).href);
const { createElement: h } = require("react");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const { shapeArabic } = require(path.join(cwd, ".test-build", "pdf", "arabicText.js"));

const fontDir = path.join(cwd, "public", "fonts", "pdf");
Font.register({ family: "Vazirmatn", fonts: [{ src: path.join(fontDir, "vazirmatn-400.ttf"), fontWeight: 400 }] });
Font.register({ family: "Inter", fonts: [{ src: path.join(fontDir, "inter-400.ttf"), fontWeight: 400 }] });

const LINES = [
  "قاد فريقاً من 8 محللين لتحسين دقة التنبؤ بالطلب إلى 94% عبر 4 مستودعات في جبل علي",
  "خفّض المخزون الاحتياطي بنسبة 12% بعد تطبيق نظام SAP IBP",
  "صمّم لوحات متابعة (Power BI) لمستوى الخدمة في 3 مستودعات",
];
const LATIN = "Cut freight spend by AED 1.2M across the GCC lane network in 2025.";
const style = { fontFamily: "Vazirmatn", fontSize: 9, lineHeight: 1.5 };
const doc = h(Document, null, h(Page, { size: "A4", style: { padding: 30 } },
  h(View, null,
    ...LINES.map((l, i) => h(Text, { key: i, style }, shapeArabic(l))),
    h(Text, { style: { fontFamily: "Inter", fontSize: 9, lineHeight: 1.5 } }, LATIN),
  )));
const buffer = await renderToBuffer(doc);
const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
const items = (await (await pdf.getPage(1)).getTextContent()).items.filter((it) => it.str && it.str.trim());
const itemTexts = items.map((it) => it.str.normalize("NFKC").replace(/[ً-ْ]/g, ""));

let failures = 0;
for (const line of LINES) {
  const words = line.normalize("NFKC").replace(/[ً-ْ]/g, "").split(/[\s()%]+/).filter((w) => /[؀-ۿ]/.test(w));
  const broken = words.filter((w) => !itemTexts.some((t) => t.includes(w)));
  if (broken.length) {
    failures += 1;
    console.error(`FAIL split words in "${line}": ${broken.join(" ")}`);
  } else {
    console.log(`ok   ${words.length}/${words.length} Arabic words whole: ${line.slice(0, 40)}…`);
  }
}
assert.ok(itemTexts.includes(LATIN), "the Latin-only line is no longer one text item");
console.log("ok   Latin-only line is one text item");
if (failures) process.exit(1);
console.log("textkit patch: ok");
