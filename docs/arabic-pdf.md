# Arabic in the PDF export

Status: shipped with disclosure (session 4, 2026-10-31, branch `mission/arabic-pdf`).
Evidence: `../_cowork/pdf-fidelity-2026-10-31-arabic/` (probe rasters, smoke rasters,
fidelity composites) and the "Session 4 — Arabic" section of
`../docs/ai-mission/PDF_FIDELITY.md` in the parent folder.

## What the user gets

- Arabic (and Persian / Urdu letters) in any field prints in the PDF: joined,
  shaped, in the right order, bold where the template is bold, wrapped and
  paginated like any other text. The on-screen preview uses the same face.
- The PDF's text layer carries every Arabic word (pdf.js reads it back
  after NFKC; `npm run smoke:arabic` checks all 14 templates × 4 personas).
- The Review step shows a short note when the CV contains Arabic (see
  "Known limits").

## Why it took more than a font

`@react-pdf/renderer` 4.3.2 (`@react-pdf/textkit` 6.1.0, `@react-pdf/layout`
4.4.2) was probed in `_cowork/pdf-fidelity-s4-scratch/` (`arabic-probe.mjs`,
`probe2…6.mjs`, `font-coverage.mjs`, `corpus-scan.mjs`, `scan2.mjs`,
`pairscan.mjs`). File/line references are into `node_modules/@react-pdf/`.

| Question | Answer | Where |
|---|---|---|
| Does it reorder bidi? | Yes — bidi-js per paragraph, segments reversed per laid-out line, so wrapping and pagination stay correct. The paragraph base direction is resolved from the first strong character whatever the `direction` style says (`dir=auto` behaviour); explicit `direction: "rtl"` inverts the order, so it is never set. | `textkit/lib/textkit.js:1657` (`bidiEngine`), `:859` (`reorderLine`) |
| Does it shape Arabic? | Yes — fontkit's OpenType layout applies the font's init/medi/fina/rlig/liga lookups. | `textkit.js:977` (`layoutRun` → `font.layout(..., 'ltr')`) |
| Can a Latin + Arabic font stack be used? | **No.** `fontFamily: [Inter, Arabic]` is accepted (`layout/lib/index.js:1376`, per-code-point pick at `textkit.js:2804`), but `reorderLine` pulls glyphs across run boundaries by string index: a Latin run draws Arabic glyph ids and the bogus ids poison pdfkit's subset / ToUnicode tables for the whole document (probe 1 / probe 3 rows A). | `textkit.js:874-897` |
| Ligatures? | `reorderLine` dedupes ligature glyphs by `glyph.id` per line, so the second lam-alef on a line vanishes ("لا" dropped from "الإدارة لا تعرف الآن إلا الله", probe 3 row B3); pdf.js also reads a multi-code-point ligature back reversed ("سالم"). | `textkit.js:883-890` |
| Decomposed dots? | `resolve()` maps string indices to glyph indices by `codePoints.length`; a glyph with no code points (Noto Sans / Naskh Arabic build dotted letters as base + dot mark via `ccmp`) gets no index, the map drifts, dots land on the wrong letters and the last glyphs of a run vanish ("أول" lost, "مالي" → "مالى", probe 2). | `textkit.js:940` |
| Glyph cache? | fontkit caches one Glyph object per id with the code points of its FIRST creation; pdfkit's subsetter resolves composite components with `getGlyph(id)` (no code points). After a document embeds ض (composite over ص) the ص glyph is `[]` for the rest of the process → the next line with ص drops glyphs or throws `reading 'id'`. Same state across two downloads in one browser tab. | `fontkit` `getGlyph`, `pdfkit` `TTFSubset.encode` |

### The approach

1. **Pre-shape in our code** (`lib/pdf/arabicText.ts`, `shapeArabic`): every
   Arabic letter becomes its presentation-form code point (U+FB50–FDFF,
   U+FE70–FEFF), lam + alef the composed ligature code point, Latin fi/fl/ffi/ffl
   their compatibility code points (the Arabic face would otherwise ligate them
   into multi-code-point glyphs). Every character is then exactly one glyph:
   nothing for the ligature dedupe or the index drift to bite on, and bidi
   still works because the forms are strong RTL. Marks, tatweel, digits,
   punctuation and Latin pass through. NFKC (`toLogicalArabic`) is the inverse.
2. **One run per Arabic-bearing `<Text>`** (`components/pdf/ArabicText.tsx`):
   `CVDocument.tsx` imports `Text` / `Link` from there. Latin-only runs are
   returned untouched (the fidelity baseline cannot move). A run with Arabic
   is flattened to one string, shaped, set in the Arabic family with
   `letterSpacing: 0`; size, weight, colour and line box come through.
3. **Vazirmatn** 33.003 (SIL OFL 1.1) as the Arabic face, static 400 / 700
   instances of `google/fonts` `ofl/vazirmatn/Vazirmatn[wght].ttf`
   (fontTools instancer, `_cowork/pdf-fidelity-s4-scratch/instance.py`),
   `public/fonts/pdf/vazirmatn-400.ttf`, `vazirmatn-700.ttf`,
   licence in `vazirmatn-OFL.txt`. Registered in `lib/pdf/fonts.ts` and only
   fetched when a `<Text>` uses it. Why Vazirmatn: of Noto Sans Arabic, Noto
   Naskh Arabic, IBM Plex Sans Arabic, Amiri, Almarai, Tajawal, Cairo, Rubik,
   Readex Pro it is the sans whose cmap covers every presentation form the
   shaper emits (Plex and Amiri also do; Almarai / Tajawal / Cairo / Rubik /
   Readex lack the isolated forms), shapes 7,056 letter pairs / triples 1:1
   with no empty-code-point glyph in either cut (Noto decomposes dots; Plex
   still ligates لي / في), covers Persian / Urdu, and its Latin sits next to
   Inter (x-height 0.528 vs Inter 0.546). 126 KB per cut.
4. **Glyph-cache warm-up** (`warmPdfFonts` in `lib/pdf/fonts.ts`): right
   after a face loads, every code point it maps is laid out once, so every
   cmap glyph exists with its code points before any subset runs. Called by
   `downloadCV` (Arabic face only when the CV has Arabic) and the Node
   renderers.
5. **Preview**: `app/globals.css` declares `'Vazirmatn CV'` from the same two
   files with `unicode-range` limited to the Arabic blocks, placed FIRST in
   the three `--cv-font-*` stacks (it must precede the next/font families,
   whose metric-adjusted Arial fallback carries Arabic glyphs of its own).
   Latin glyphs never touch it; the files load only when a CV has Arabic.

## Known limits (the disclosure)

- **Text layer stores presentation forms.** pdf.js, Acrobat, Preview and
  Word display and copy them correctly and NFKC maps them back, but an ATS
  that matches Arabic keywords byte-for-byte without normalising will not
  match. The Review step says so when the CV contains Arabic. The `.docx`
  export is untouched (Word shapes the original letters). Our own importer
  NFKC-normalises every extracted PDF line (`lib/importers/pdfAdapter.ts`,
  2026-10-31), so re-importing an exported Arabic CV keeps the name, headline
  and role in base letters (`__fixtures__/import/arabic-export-classic.pdf`).
  Long Arabic lines split across `TJ` operators can still lose words.
- **One run per line.** Inside a `<Text>` that contains Arabic, a nested bold
  label loses its weight, a `<Link>` loses its hyperlink (text stays), Latin
  words are set in Vazirmatn's Latin instead of Inter / Bricolage / Instrument
  Serif, and letter-spacing is dropped. Lines without Arabic are unaffected.
- **Paragraph direction.** The PDF resolves each paragraph's base direction
  from its first strong character (RTL for an Arabic-first line); the live
  templates set no `dir`, so the browser lays the same line out with an LTR
  base. Pure-Arabic and English-first lines look the same in both; an
  Arabic-first line that also contains Latin (e.g. "مدير مالي — Senior
  Manager | company") orders its segments differently in the preview. The
  PDF's order is the one an Arabic reader expects. Follow-up for the live
  templates: `unicode-bidi: plaintext` on `.cv-print` text plus an alignment
  decision — a template-rendering change, so an owner call.
- **Fonts not registered** (registration failed, or Node without
  `registerPdfFontsFromDir`): the wrapper leaves text alone and Helvetica
  prints the session-3 junk. `pdfArabicFamily()` is the switch.
- **Urdu is not covered.** Vazirmatn lacks U+FBA6 (isolated ہ); probe 7
  (`_cowork/pdf-fidelity-s4-scratch/probe7.mjs`) shows an isolated ہ printing
  nothing and a letter after a joined ہ dropping. Arabic and Persian letters
  are what the suite verifies.

## Checks

- `npm run test:unit` — `lib/pdf/arabicText.test.ts` (forms, lam-alef,
  marks, tatweel / ZWNJ, Persian letters, Latin ligatures, NFKC round-trip).
- `npm run smoke:arabic` — renders 14 templates × `arabic-only`,
  `arabic-first`, `arabic-name`, `arabic-dense` (`lib/data/preview-profiles.ts`),
  checks every Arabic word of each persona in the pdf.js text layer after
  NFKC, no U+FFFD, no junk characters, page counts (dense ≥ 2 pages with
  Arabic on page 2), and writes page-1 (and page-2) rasters to
  `.arabic-smoke/`.
- `node scripts/pdf-fidelity.mjs --persona=<id>` — preview next to PDF for
  any of the five personas; `npm run fidelity:pdf` is the Latin gate and must
  stay byte-identical.
- `/preview/<template>?persona=arabic-only` etc. for a human look.
