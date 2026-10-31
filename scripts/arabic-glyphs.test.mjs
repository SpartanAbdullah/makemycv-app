// Glyph coverage of the Arabic PDF face (session 6, 2026-10-31, E8.4).
//
// Every code point lib/pdf/arabicText.ts can emit for a letter must exist in
// BOTH Vazirmatn cuts the PDF embeds. A missing one is not an empty box: textkit
// hands it to its font substitution, which prints Helvetica-Bold (session 5 saw
// the Urdu isolated heh goal U+FBA6 print as "¦") and puts a second font run on
// the line. Also checks the punctuation and digits Arabic / Urdu text carries.
// Run by `npm run test:arabic-glyphs` (picked up by `npm test`).
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const fontkit = require("fontkit");
const { shapedLetterCodePoints, shapeArabic } = require(path.join(process.cwd(), ".test-build", "pdf", "arabicText.js"));

const EXTRA = [
  0x060c, 0x061b, 0x061f, 0x06d4, // ، ؛ ؟ ۔
  0x066a, 0x066b, 0x066c, // ٪ ٫ ٬
  ...Array.from({ length: 10 }, (_, i) => 0x0660 + i), // ٠–٩
  ...Array.from({ length: 10 }, (_, i) => 0x06f0 + i), // ۰–۹ (Persian / Urdu digits)
  0x064b, 0x064c, 0x064d, 0x064e, 0x064f, 0x0650, 0x0651, 0x0652, 0x0654, 0x0670, // harakat, hamza above
  0xfb01, 0xfb02, 0xfb03, 0xfb04, // the Latin ligatures shapeArabic pre-composes
];

let failures = 0;
for (const weight of ["400", "700"]) {
  const file = path.join(process.cwd(), "public", "fonts", "pdf", `vazirmatn-${weight}.ttf`);
  const font = fontkit.openSync(file);
  const missing = [...shapedLetterCodePoints(), ...EXTRA].filter((cp) => !font.hasGlyphForCodePoint(cp));
  if (missing.length) {
    failures += 1;
    console.error(`FAIL vazirmatn-${weight}: no glyph for ${missing.map((cp) => "U+" + cp.toString(16).toUpperCase()).join(" ")}`);
  } else {
    console.log(`ok   vazirmatn-${weight}: ${shapedLetterCodePoints().length} shaped forms + ${EXTRA.length} marks / digits / punctuation`);
  }
  // A realistic Urdu CV line, shaped, must be entirely in the face.
  const line = shapeArabic("طاہرہ ملک — سینئر سپلائی چین تجزیہ کار؛ ٹرک، ڈرائیور اور گودام کے اخراجات میں کمی کی۔ نئے راستے بناۓ اور منافع بڑھایا ۹۴٪");
  const absent = [...line].filter((ch) => !/\s/.test(ch) && !font.hasGlyphForCodePoint(ch.codePointAt(0)));
  assert.deepEqual(absent, [], `vazirmatn-${weight} lacks ${absent.map((c) => "U+" + c.codePointAt(0).toString(16)).join(" ")}`);
}
if (failures) process.exit(1);
console.log("arabic glyph coverage: ok");
