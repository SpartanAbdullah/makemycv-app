/**
 * Arabic text preparation for the PDF renderer (session 4, 2026-10-31).
 *
 * Why this exists — what @react-pdf/renderer 4.3.2 (textkit 6.1.0) does and
 * does not do with Arabic, measured in `_cowork/pdf-fidelity-s4-scratch/`:
 *
 *  - Bidi: YES. textkit runs bidi-js over every paragraph (`bidiEngine`,
 *    textkit.js:1657) and reverses the right-to-left segments of each laid-out
 *    line (`reorderLine`, textkit.js:859). Line breaking happens first, so a
 *    long Arabic paragraph wraps and paginates correctly.
 *  - Shaping: YES, through fontkit's OpenType layout (`layoutRun`,
 *    textkit.js:977 calls `font.layout(..., 'ltr')`), which applies the
 *    font's init/medi/fina/rlig/liga lookups.
 *  - But two defects make the native path unsafe for a CV:
 *      1. `resolve()` (textkit.js:940) maps string indices to glyph indices by
 *         each glyph's `codePoints.length`, charging ONE index to a glyph with
 *         NO code points. Fonts that build dotted letters from a base glyph +
 *         a dot mark through `ccmp` (Noto Sans Arabic, Noto Naskh Arabic)
 *         therefore drift: dots land on the wrong letters and the last glyphs
 *         of a run are never drawn ("أول" disappears, "مالي" prints as "مالى").
 *      2. `reorderLine` dedupes ligature glyphs by `glyph.id` for the whole
 *         line (textkit.js:883-890), so the SECOND lam-alef ligature on a line
 *         is dropped — "لا" vanishes from "الإدارة لا تعرف الآن إلا الله" — and
 *         pdf.js reads a multi-code-point ligature back reversed ("سالم").
 *    Both defects need a glyph that stands for more or fewer than one code
 *    point. Hand textkit a string in which every character IS its final glyph
 *    — Unicode Arabic Presentation Forms (U+FB50–FDFF, U+FE70–FEFF), with
 *    lam-alef already composed — and neither can occur: fontkit's shaper has
 *    nothing to join (presentation forms are non-joining), every glyph maps
 *    to exactly one code point, and bidi still works because the forms are
 *    strong right-to-left characters.
 *  - A `fontFamily` stack ([Inter, Arabic]) is NOT usable: `reorderLine` pulls
 *    glyphs across run boundaries by string index, so a Latin run draws the
 *    Arabic font's glyph ids (and poisons pdfkit's subset / ToUnicode tables
 *    for the WHOLE document — a single mixed line corrupted "2019" elsewhere
 *    on the page). Every <Text> that contains Arabic must be ONE run: one
 *    family, one weight, no nested runs. `components/pdf/CVDocument.tsx`
 *    applies that rule through its `Text` wrapper.
 *
 * The text layer of the PDF then carries presentation-form code points;
 * `toLogicalArabic()` (NFKC) turns them back into the letters the user typed,
 * which is what the smoke test compares. See docs/arabic-pdf.md.
 */

/**
 * Arabic letters, marks and presentation forms (what `containsArabic` tests).
 * Base direction is deliberately NOT decided here: the live templates set no
 * `dir`, so the browser lays every paragraph out with an LTR base and the PDF
 * does the same (textkit's default) — same line order, same bullet side,
 * same alignment in both renderers.
 */
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export const containsArabic = (text: string): boolean => ARABIC_RE.test(text);

/* ── Joining table ──────────────────────────────────────────────────────── */

/** [isolated, final, initial, medial]; a right-joining letter has 2 entries. */
type Forms = readonly [number, number] | readonly [number, number, number, number];

/**
 * Arabic Presentation Forms-B (U+FE70–FEFF) for the Arabic alphabet and
 * Forms-A (U+FB50–FDFF) for the Persian / Urdu letters UAE job seekers type.
 * Unicode chapter 9 / ArabicShaping.txt: a letter with four forms is
 * dual-joining (D), one with two forms is right-joining (R).
 */
const FORMS: Record<number, Forms> = {
  0x0622: [0xfe81, 0xfe82], // آ
  0x0623: [0xfe83, 0xfe84], // أ
  0x0624: [0xfe85, 0xfe86], // ؤ
  0x0625: [0xfe87, 0xfe88], // إ
  0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // ئ
  0x0627: [0xfe8d, 0xfe8e], // ا
  0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // ب
  0x0629: [0xfe93, 0xfe94], // ة
  0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98], // ت
  0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // ث
  0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // ج
  0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4], // ح
  0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8], // خ
  0x062f: [0xfea9, 0xfeaa], // د
  0x0630: [0xfeab, 0xfeac], // ذ
  0x0631: [0xfead, 0xfeae], // ر
  0x0632: [0xfeaf, 0xfeb0], // ز
  0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // س
  0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // ش
  0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // ص
  0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0], // ض
  0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4], // ط
  0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8], // ظ
  0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc], // ع
  0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0], // غ
  0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4], // ف
  0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8], // ق
  0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc], // ك
  0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0], // ل
  0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4], // م
  0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8], // ن
  0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // ه
  0x0648: [0xfeed, 0xfeee], // و
  0x0649: [0xfeef, 0xfef0], // ى (Forms-B has isolated/final only)
  0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4], // ي
  0x0671: [0xfb50, 0xfb51], // ٱ
  0x0679: [0xfb66, 0xfb67, 0xfb68, 0xfb69], // ٹ
  0x067e: [0xfb56, 0xfb57, 0xfb58, 0xfb59], // پ
  0x0686: [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d], // چ
  0x0688: [0xfb88, 0xfb89], // ڈ
  0x0691: [0xfb8c, 0xfb8d], // ڑ
  0x0698: [0xfb8a, 0xfb8b], // ژ
  0x06a9: [0xfb8e, 0xfb8f, 0xfb90, 0xfb91], // ک
  0x06af: [0xfb92, 0xfb93, 0xfb94, 0xfb95], // گ
  0x06ba: [0xfb9e, 0xfb9f], // ں
  0x06be: [0xfbaa, 0xfbab, 0xfbac, 0xfbad], // ھ
  // ہ (heh goal). Vazirmatn has no glyph for the isolated presentation form
  // U+FBA6, and a code point the face lacks is handed to textkit's font
  // substitution, which prints Helvetica-Bold "¦" and adds a second font run
  // to the line (session 5, ARABIC_PRODUCTION §1 test 7). The base letter
  // U+06C1 maps to Vazirmatn's isolated outline (the face draws it like
  // U+FEE9), it is one code point → one glyph like every other form, and it
  // keeps the Urdu letter itself in the text layer (U+FEE9 would read back
  // as the Arabic ه after NFKC). `scripts/arabic-glyphs.test.mjs` fails if
  // any form below is missing from either Vazirmatn cut.
  0x06c1: [0x06c1, 0xfba7, 0xfba8, 0xfba9], // ہ
  0x06cc: [0xfbfc, 0xfbfd, 0xfbfe, 0xfbff], // ی
  0x06d2: [0xfbae, 0xfbaf], // ے
  0x06d3: [0xfbb0, 0xfbb1], // ۓ
};

/** Lam + alef variants → [isolated, final] ligature forms. */
const LAM_ALEF: Record<number, readonly [number, number]> = {
  0x0622: [0xfef5, 0xfef6],
  0x0623: [0xfef7, 0xfef8],
  0x0625: [0xfef9, 0xfefa],
  0x0627: [0xfefb, 0xfefc],
};

const LAM = 0x0644;
const TATWEEL = 0x0640;
const ZWNJ = 0x200c;
const ZWJ = 0x200d;

/** Combining marks the joining algorithm looks through (ArabicShaping type T). */
const isTransparent = (cp: number): boolean =>
  (cp >= 0x064b && cp <= 0x065f) ||
  cp === 0x0670 ||
  (cp >= 0x06d6 && cp <= 0x06dc) ||
  (cp >= 0x06df && cp <= 0x06e4) ||
  cp === 0x06e7 ||
  cp === 0x06e8 ||
  (cp >= 0x06ea && cp <= 0x06ed) ||
  (cp >= 0x0610 && cp <= 0x061a) ||
  (cp >= 0x08d3 && cp <= 0x08ff) ||
  cp === 0x200b; // zero-width space

type JoinType = "D" | "R" | "U";

const joinType = (cp: number): JoinType => {
  const f = FORMS[cp];
  if (f) return f.length === 4 ? "D" : "R";
  if (cp === TATWEEL || cp === ZWJ) return "D";
  return "U"; // ء, digits, punctuation, Latin, ZWNJ
};

/** Does the letter at `i` join towards the following letter (it has an initial/medial form)? */
const joinsForward = (cps: number[], i: number): boolean => joinType(cps[i]) === "D";
/** Does the letter at `i` accept a join from the previous letter (it has a final form)? */
const joinsBackward = (cps: number[], i: number): boolean => joinType(cps[i]) !== "U";

const nextVisible = (cps: number[], i: number): number => {
  let j = i + 1;
  while (j < cps.length && isTransparent(cps[j])) j += 1;
  return j;
};

/**
 * Latin ligatures the Arabic face applies through `liga` (fi, fl, ffi, ffl)
 * are multi-code-point glyphs too, and textkit's reorder dedupe drops the
 * second one on a line ("Office … Profit" → "Prot") whenever the line also
 * holds Arabic. Pre-composing them to their compatibility code points
 * (U+FB01–FB04, all in Vazirmatn's cmap) makes them one code point each;
 * NFKC turns them back into the letters. Only applied inside Arabic-bearing
 * text, so Latin-only runs stay byte-identical.
 */
const LATIN_LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ffi/g, "ﬃ"],
  [/ffl/g, "ﬄ"],
  [/fi/g, "ﬁ"],
  [/fl/g, "ﬂ"],
];

/**
 * Contextual shaping into presentation forms. Every Arabic letter in `text`
 * is replaced by its isolated / initial / medial / final form; lam + alef
 * becomes the composed ligature code point; marks, tatweel, digits, Latin
 * and punctuation pass through untouched (bar the Latin ligatures above).
 * Logical order in, logical order out — textkit's own bidi still reorders
 * the result per line.
 */
export function shapeArabic(text: string): string {
  if (!containsArabic(text)) return text;
  return shapeArabicLetters(
    decomposeUnmapped(LATIN_LIGATURES.reduce((s, [re, lig]) => s.replace(re, lig), text)),
  );
}

/**
 * Letters that have no presentation forms of their own but are a letter we
 * do shape plus a combining hamza: ۂ (U+06C2, Urdu heh goal + hamza) is
 * canonically ہ + U+0654. Passed through whole, it would reach fontkit as a
 * base letter between non-joining presentation forms and print isolated in
 * the middle of a word; decomposed, ہ joins and the hamza mark rides on it.
 * NFC / NFKC compose the pair back, so the text layer still reads ۂ.
 */
const decomposeUnmapped = (text: string): string => text.replace(/\u06C2/g, "\u06C1\u0654");

/**
 * Arabic-script letters in `text` that `shapeArabic` has no forms for, so the
 * PDF prints them in their isolated shape even mid-word (e.g. ۃ U+06C3, ۀ
 * U+06C0, Sindhi / Pashto / Kurdish letters). Hamza (ء, never joins) and ۂ
 * (decomposed above) are not reported. The Review step names these to the
 * user instead of claiming support it has not verified; the Arabic, Persian
 * and Urdu letters in FORMS are rendered and checked in `npm run smoke:arabic`.
 */
export function unjoinedArabicLetters(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0xfb50) continue; // already a presentation form
    if (!ARABIC_RE.test(ch) || !/\p{L}/u.test(ch)) continue; // marks, digits, punctuation
    if (FORMS[cp] || cp === 0x0621 || cp === 0x06c2 || cp === TATWEEL) continue;
    out.add(ch);
  }
  return [...out];
}

/** Every code point `shapeArabic` can emit for a letter (forms + lam-alef). For the glyph-coverage test. */
export const shapedLetterCodePoints = (): number[] => [
  ...new Set([...Object.values(FORMS).flat(), ...Object.values(LAM_ALEF).flat()]),
];

function shapeArabicLetters(text: string): string {
  const cps = Array.from(text, (ch) => ch.codePointAt(0) as number);
  const out: number[] = [];
  // Whether the previous visible letter joins forward into the current one.
  let prevJoins = false;
  for (let i = 0; i < cps.length; i += 1) {
    const cp = cps[i];
    if (isTransparent(cp)) {
      out.push(cp);
      continue; // marks do not change the joining state
    }
    const forms = FORMS[cp];
    if (!forms) {
      // Tatweel and ZWJ keep the joining chain alive; everything else breaks it.
      out.push(cp);
      prevJoins = cp === TATWEEL || cp === ZWJ;
      continue;
    }
    const n = nextVisible(cps, i);
    // Lam + alef → one ligature code point (the alef is consumed).
    if (cp === LAM && n < cps.length && LAM_ALEF[cps[n]]) {
      const [isol, fina] = LAM_ALEF[cps[n]];
      out.push(prevJoins ? fina : isol);
      for (let k = i + 1; k < n; k += 1) out.push(cps[k]); // marks between lam and alef
      i = n;
      prevJoins = false; // alef never joins forward
      continue;
    }
    const nextJoins = n < cps.length && joinsBackward(cps, n) && cps[n] !== ZWNJ;
    const canForward = joinsForward(cps, i) && nextJoins;
    let form: number;
    if (prevJoins && canForward) form = forms[3] as number; // medial
    else if (prevJoins) form = forms[1]; // final
    else if (canForward) form = forms[2] as number; // initial
    else form = forms[0]; // isolated
    out.push(form);
    prevJoins = canForward;
  }
  return String.fromCodePoint(...out);
}

/**
 * Inverse for tests and text-layer checks: presentation forms back to the
 * letters they stand for. NFKC decomposes every Arabic presentation form
 * (U+FEFB → لا, U+FEB3 → س); it also folds other compatibility characters
 * (ligatures like ﬁ, full-width digits), which is harmless for a comparison.
 */
export const toLogicalArabic = (text: string): string => text.normalize("NFKC");
