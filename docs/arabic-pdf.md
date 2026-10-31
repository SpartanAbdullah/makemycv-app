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
| Does it reorder bidi? | Yes — bidi-js per paragraph, segments reversed per laid-out line, so wrapping and pagination stay correct. The paragraph base direction is the `direction` style, which `@react-pdf/layout` defaults to `"ltr"` (`layout/lib/index.js:1375`; session 4 read it as first-strong, session 5 showed it is not). Since session 6 `ArabicText` sets `"rtl"` on Arabic-first runs (see "Paragraph direction"). | `textkit/lib/textkit.js:1657` (`bidiEngine`), `:859` (`reorderLine`) |
| Does it shape Arabic? | Yes — fontkit's OpenType layout applies the font's init/medi/fina/rlig/liga lookups. | `textkit.js:977` (`layoutRun` → `font.layout(..., 'ltr')`) |
| Can a Latin + Arabic font stack be used? | **No.** `fontFamily: [Inter, Arabic]` is accepted (`layout/lib/index.js:1376`, per-code-point pick at `textkit.js:2804`), but `reorderLine` pulls glyphs across run boundaries by string index: a Latin run draws Arabic glyph ids and the bogus ids poison pdfkit's subset / ToUnicode tables for the whole document (probe 1 / probe 3 rows A). | `textkit.js:874-897` |
| Ligatures? | `reorderLine` dedupes ligature glyphs by `glyph.id` per line, so the second lam-alef on a line vanishes ("لا" dropped from "الإدارة لا تعرف الآن إلا الله", probe 3 row B3); pdf.js also reads a multi-code-point ligature back reversed ("سالم"). | `textkit.js:883-890` |
| Decomposed dots? | `resolve()` maps string indices to glyph indices by `codePoints.length`; a glyph with no code points (Noto Sans / Naskh Arabic build dotted letters as base + dot mark via `ccmp`) gets no index, the map drifts, dots land on the wrong letters and the last glyphs of a run vanish ("أول" lost, "مالي" → "مالى", probe 2). | `textkit.js:940` |
| Why do long Arabic lines extract with words missing? (session 6) | `bidiEngine` splits runs at every bidi-level change; `reorderLine` keeps each run's logical length and refills it with visual-order glyphs, so each run's `TJ` is cut at an arbitrary point inside a word. Patched — approach 6. | `textkit.js:1658` (`bidiEngine`), `:874` (`reorderLine`) |
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
   renderers. It also installs a repair on the face's `getGlyph`: a glyph
   reachable only through GSUB (Vazirmatn's contextual alternates, e.g. the
   medial ی after چ) can still be created first by an earlier document's
   subsetter with no code points; when layout later asks for it with code
   points, the cached glyph takes them (session 6 — an Urdu CV rendered after
   an Arabic one in the same process threw `reading 'id'` without it).
6. **textkit reorder patch** (`scripts/patch-react-pdf-textkit.mjs`, run on
   `postinstall`, session 6, E8.1). textkit splits a paragraph into runs at
   every bidi-level change (an Arabic line with "8", "94%" or "SAP IBP" in it
   is 3–7 runs), and `reorderLine` kept each run's LOGICAL length while
   refilling it with VISUAL-order glyphs — so the run that held the
   one-character "8" drew one letter from the middle of some Arabic word, and
   each run became its own `BT … TJ … ET`. pdf.js and pypdf reverse each text
   item on its own and lost the cut words (session 5: persona A b1 3 of 14
   words, b2 1 of 7); PyMuPDF scrambled them. The patch rebuilds the line's
   runs in visual order (each glyph keeps its own run's font / size / colour /
   link; adjacent runs that draw alike merge; a multi-character glyph is
   drawn once per occurrence, keyed by run + glyph index rather than glyph
   id). A one-face Arabic line is now ONE text-show operator; rasters are
   pixel-identical to the unpatched output (checked on 8 pages); lines that
   need no reordering (every Latin-only line) return before the patched code.
   `npm run test:textkit-patch` (in `npm test`, so CI) fails if the installed
   textkit is not patched — on a textkit upgrade the script warns, leaves the
   file alone, and that test fails until the patch is ported.
7. **Preview**: `app/globals.css` declares `'Vazirmatn CV'` from the same two
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
  Since the textkit patch (approach 6) a long Arabic line is one text-show
  operator and pdf.js / pypdf no longer lose words from it; how a tool ORDERS
  a mixed line still depends on the tool (see the session-6 matrix in
  `docs/ai-mission/ARABIC_PRODUCTION_2026-10-31.md` in the parent folder), and
  pdfminer-based parsers still read Arabic in visual (reversed) order.
- **One run per line.** Inside a `<Text>` that contains Arabic, a nested bold
  label loses its weight, a `<Link>` loses its hyperlink (text stays), Latin
  words are set in Vazirmatn's Latin instead of Inter / Bricolage / Instrument
  Serif, and letter-spacing is dropped. Lines without Arabic are unaffected.
- **Paragraph direction (session 6, E8.2 — owner decision taken: first
  strong, per paragraph, in both renderers).** Session 5 measured that
  BOTH renderers used an LTR base (`@react-pdf/layout` defaults `direction`
  to `"ltr"`, so the old "first strong" sentence here was wrong): a mid-line
  "(Power BI)" reversed the clauses around it, trailing Latin and "%" sat at
  the wrong end, continuation lines were flush left. Now:
  - **PDF**: `ArabicText` gives an Arabic-first run (`firstStrongDirection`,
    `lib/pdf/arabicText.ts`) `direction: "rtl"` and — unless the layout set
    `textAlign` — an explicit `textAlign: "right"` (layout's measure step
    only compensates an explicit alignment in a shrink-wrapped box; with the
    implicit one a contact item's text was drawn outside its box). Role
    titles that share a row with dates get a content-sized box when
    Arabic-first (`roleBox` / `withRoleBox` in `CVDocument.tsx`), as the
    live templates size them, so they stay at the row start.
  - **Preview**: every template root carries `.cv-bidi`; `app/globals.css`
    sets `unicode-bidi: plaintext` on it and its descendants (each block's
    direction from its first strong character; Chrome then aligns the
    default `text-align: start` right for Arabic-first blocks), keeps inline
    phrasing elements (`span`, `a`, `b`, …) at `normal` so a line built from
    spans is ONE paragraph like the PDF's flattened run, and gives flex /
    grid children `plaintext` back (they are block containers).
  - Latin-first and letterless paragraphs resolve LTR exactly as before:
    the Latin fidelity gate passes unchanged (31 ok / 11 check), and Latin
    PDF content streams are byte-identical. Explicit `center` / `right`
    alignment is kept. List markers stay on the left in both renderers (the
    li / bullet row keeps its LTR direction); an Arabic-first bullet's text
    aligns right of it.
- **Fonts not registered** (registration failed, or Node without
  `registerPdfFontsFromDir`): the wrapper leaves text alone and Helvetica
  prints the session-3 junk. `pdfArabicFamily()` is the switch.
- **Urdu (session 6, E8.4).** Vazirmatn has every presentation form the
  shaper emits except U+FBA6, the isolated heh goal ہ (session 5 saw it fall
  back to Helvetica-Bold and print "¦"). The shaper now emits the base letter
  U+06C1 for that position — Vazirmatn maps it to its isolated outline, which
  in this face is drawn like the Arabic isolated ه — so "طاہرہ" prints in
  Vazirmatn and the text layer keeps the Urdu letter. ٹ ڈ ڑ ک گ ں ھ ہ ی ے ۓ
  are rendered and checked (`scripts/arabic-glyphs.test.mjs` asserts every
  emitted form is in both cuts). ۂ is
  decomposed to ہ + hamza above so it joins. Still **not** shaped: Arabic-
  script letters without presentation forms in the table (ۃ U+06C3, ۀ U+06C0,
  Sindhi / Pashto / Kurdish letters) print in their isolated shape mid-word;
  the Review note names any such letter the CV contains
  (`unjoinedArabicLetters`). The isolated ہ uses Vazirmatn's naskh-style
  design, not the Nastaliq shape an Urdu reader may expect.

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
