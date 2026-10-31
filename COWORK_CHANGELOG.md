# Cowork Changelog — makemycv-app

Newest entry on top. Every repo change made by Cowork gets an entry here before the task is
considered done. This is the shared handoff record between Cowork, Claude Code and Abdullah.

Format:

```
## [2026-10-31 15:10] QA follow-ups: LinkedIn minimum-length hint, consistent 503 when the AI key is missing

**Goal:** close three minor findings from the independent release QA (docs/ai-mission/QA_INDEPENDENT_2026-10-31.md D3, D5).
**Files:**
- edited: `components/linkedin/LinkedinMessagePanel.tsx` - a `role="status"` line under the counter explains the 30-character minimum while the button is disabled.
- edited: `app/api/linkedin-message/route.ts`, `app/api/cover-letter/route.ts` - a missing `ANTHROPIC_API_KEY` answers 503 "This feature is temporarily unavailable" instead of 500 "API not configured".
- edited: `app/api/resume-checker/parse/route.ts` - the same configuration failure, previously surfaced as 422 "Our parser had trouble with this CV", now answers 503 with the same sentence; real parse failures keep the 422.
**Verification:** tsc, lint 11/11, npm test; the hooks already render `error` from any status.

## [YYYY-MM-DD HH:MM] Short title
**Goal:** why — the task, and which business objective it serves
**Files:**
- created / edited / deleted: path — what and why
**Notes / risks / follow-up:** anything to know before building on this
**Suggested commit:** type(scope): concise description
```

---

## [2026-10-31 18:20] Skills box: Enter adds the typed skill; suggestions only when highlighted (backlog E7)

**Goal:** pressing Enter in the Skills search added the FIRST search result instead of the typed term (QA D4) —
"Fleet management" became whichever bank entry ranked first, a silent substitution of a competency claim on a
document the user submits to an employer. Suggestions are options, never corrections (CLAUDE.md truthfulness rules).
**Files:**
- created: `lib/skills/enterKey.ts` — the pure rule: `resolveEnter(query, results, highlighted)` returns the typed
  text (trimmed) unless a suggestion index is highlighted; `moveHighlight()` clamps ArrowDown/ArrowUp over the
  pickable rows (-1 = "as written", no wrap); `pickableResults()` drops `alreadyHave` notes.
- created: `lib/skills/enterKey.test.ts` — 10 tests incl. the reported bug, trimming, the alreadyHave skip and
  stale highlights.
- edited: `components/builder/steps/SkillsStep.tsx` — `highlighted` state reset on every keystroke; ArrowDown /
  ArrowUp move it; Enter goes through `resolveEnter` (a highlighted suggestion still passes the licence guard and
  `addSkill`'s duplicate check exactly as a click would); the input carries `aria-controls` (only while the listbox
  is rendered) and `aria-activedescendant`; option rows get ids, `aria-selected` and a visible highlight; the
  "Add … as written" row shows an "Enter ↵" hint (or "↑ for as written" when a row is highlighted).
- edited: `scripts/builder-smoke.mjs` — after typing "Fleet management" + Enter it asserts the chip `Remove Fleet
  management` exists (typed text, not a substitute), then types "excel", ArrowDown, Enter and asserts the
  highlighted option (aria-selected=true) is the chip that was added.
**Notes / risks / follow-up:** The Add button and the "as written" row were already typed-text paths; only the Enter
key changed. Dedupe is unchanged (`addSkill` → "X is already on your list"). No `role="combobox"` was added — the
textbox + listbox pairing with `aria-activedescendant` is valid ARIA and keeps the axe surface in `smoke:builder`
unchanged.
**Suggested commit:** fix(skills): Enter adds the typed skill, suggestions only via arrow keys (E7)

## [2026-10-31 18:05] Consent banner no longer covers modal dialogs (backlog E9)

**Goal:** on production at 1440×900 the cookie-consent banner (fixed bottom, `z-index: 1000`) sat on top of the
MappingReview dialog's "Import (N sections)" button until the visitor answered it, so a first-time visitor on a
short viewport could not finish an import (found by the production `smoke:import` run, session 4). Every modal in
the app sits between z 60 and 200, so the same overlap applies to the export gate, the template preview, the JD
Match dialog, the mobile preview overlay and the tip jar.
**Files:**
- edited: `app/globals.css` — one rule: `body:has([role="dialog"][aria-modal="true"]) [role="region"][aria-label="Cookie settings"] { display: none }`.
  The banner is a non-modal region that nothing waits on, so while a modal dialog is open it yields and comes back
  when the dialog closes. Chosen over six z-index bumps, and over editing `components/consent/ConsentBanner.tsx`,
  which is a byte-identical copy of the site's file (CLAUDE.md: edit both) — the site has no modal dialogs, so the
  shared file did not need to change.
- edited: `scripts/import-smoke.mjs` — `checkConsentOverlap()`: in the first review that opens (the context has no
  `mmcv_consent` cookie, viewport 1440×900) it asks `document.elementFromPoint` what sits at the Import button's
  centre and fails unless it is the button; reports whether the banner was up before the dialog opened. GTM /
  GA requests are aborted so a build with `NEXT_PUBLIC_GTM_ID` stays offline. Without a GTM id the banner does not
  mount at all (`app/layout.tsx`), so the run prints an INFO line saying the overlap was not exercised — build with
  `NEXT_PUBLIC_GTM_ID=GTM-SMOKE01` to exercise it.
**Notes / risks / follow-up:** `:has()` is supported by every browser the app targets (Chrome 105+, Safari 15.4+,
Firefox 121+); in an older browser the rule is ignored and behaviour is as before, never worse. A dialog that
omits `aria-modal="true"` (none today — `ScoreChip`'s popover and `AIResultsModal` are not modal regions in that
sense) would not trigger the rule; add the attribute rather than a z-index when one appears.
**Suggested commit:** fix(consent): hide the cookie banner while a modal dialog is open (E9) + import-smoke hit test

## [2026-10-31 17:10] smoke:checker: allow the pdf.js worker HEAD probe in the privacy assertion

**Goal:** `npm run smoke:checker` has been red since `45ade82` (this morning's import commit): the new
`resolveWorkerSrc` HEAD-probes `/pdf.worker.min.mjs` once per page, and the smoke counted every same-origin
non-GET request as a payload leaving the browser, so it reported
`["/pdf.worker.min.mjs","/api/resume-checker/parse"]`. Found while running the gates for the performance review.
**Files:**
- edited: `scripts/checker-smoke.mjs` — the request recorder ignores `HEAD /pdf.worker.min.mjs` (no body, nothing
  of the CV travels with it); every other non-GET request is still counted and the body-key check is unchanged.
**Notes / risks / follow-up:** The assertion still fails on any additional POST/PUT or on a changed parse body.
**Suggested commit:** test(checker-smoke): ignore the body-less pdf.js worker HEAD probe

## [2026-10-31 16:30] Reliability: bounded wait on every Claude call (504 + sentence instead of a dead spinner)

**Goal:** Performance/reliability review (session 4, priority 9). None of the six Anthropic `fetch()` calls
(`ai-improve`, `jd-match`, `jd-match/rewrite-bullet`, `cover-letter`, `linkedin-message`,
`lib/resumeChecker/parse.ts`) passed a `signal`, and none of the client hooks has a timeout either, so a stalled
upstream held the spinner until the platform killed the function — 60 s on the parse route (`maxDuration`), the
platform default (minutes) elsewhere — and the user then saw "Something went wrong" from a body-less 504.
**Files:**
- edited: `lib/server/anthropic.ts` — `ANTHROPIC_TIMEOUT_MS` (25 s, small prompts ≤ 2048 tokens; observed latency is
  single-digit seconds), `ANTHROPIC_PARSE_TIMEOUT_MS` (45 s; the route's maxDuration is 60 and scoring + KV write
  follow), `anthropicSignal()` (`AbortSignal.timeout`), `isTimeoutError()` (TimeoutError / AbortError by name),
  `UPSTREAM_TIMEOUT_BODY` + `UPSTREAM_TIMEOUT_STATUS` (504; `error` is the field every AI hook renders).
- edited: the five `app/api/**/route.ts` above — `signal: anthropicSignal()` on the fetch; a timeout returns the 504
  immediately and is NOT retried (the 2-attempt loops would otherwise double a 25 s wait behind the same spinner).
- edited: `lib/resumeChecker/parse.ts` — 45 s signal; `ParseError` gains `{ kind: "claude-timeout" }`;
  `app/api/resume-checker/parse/route.ts` maps it to the 504 body (with `requestId`).
- edited: `lib/server/anthropic.test.ts` — a local `http.createServer` that never answers: fetch with the signal
  rejects as a timeout at the cap (120 ms cap → rejected in 160 ms); `isTimeoutError` ignores ordinary failures.
**Notes / risks / follow-up:** Before: unbounded (platform-killed). After: ≤ 25 s / ≤ 45 s, then a sentence and a
retry. The hooks (`useAIImprove`, `useJdMatch`, `useCoverLetter`, `useLinkedinMessage`, `useBulletRewrite`) and
`UploadDropzone` already render `data.error` for non-429 failures, so no client change was needed. The client
still has no timeout of its own — if the function itself is unreachable the browser waits for the platform's
answer; left as is (one more layer for a case the 504 now covers). Measured figures and the deferred list are in
`docs/performance-2026-10-31.md`.
**Suggested commit:** fix(api): bound every Anthropic call with AbortSignal.timeout, answer 504 with a message

## [2026-10-31 16:20] Reliability: side-record localStorage writes cannot throw out of a store action

**Goal:** Same review. `setIsPro`, `setHasUsedFreeDownload`, `setParseSignals` and `captureScoreBaseline` in
`lib/store/cvStore.ts` wrote with a bare `localStorage.setItem` BEFORE their `set()`. A `QuotaExceededError` or a
private-mode refusal threw out of the action, so a checker import (which calls the last two) could crash half-way
as a React event-handler error instead of degrading to the TopBar's "could not save" chip. The CV itself was never
at risk — `saveCvToStorage` already returns `false` and flips `saveError` — but a crash mid-import reads as a lost
import.
**Files:**
- edited: `lib/store/cvStore.ts` — exported `writeStorage(key, value): boolean` (try/catch, console.warn, never
  throws); the four actions use it. Photo note: `resizeAndCropToSquare` already caps a 5 MB upload at 200×200 JPEG
  q0.85 (≈ 10–15 KB base64), so the photo cannot fill the 5 MB origin quota on its own — no compression change.
- edited: `lib/store/scoreBaseline.test.ts` — `writeStorage` returns false (not throws) on a refused write, stores
  on success, no-op without `window`.
**Notes / risks / follow-up:** Behaviour on the happy path is identical. `setJdTarget` already had its own
try/catch and is untouched.
**Suggested commit:** fix(store): never throw out of a store action on a refused localStorage write

## [2026-10-31 16:00] Perf harness: scripts/perf-measure.mjs

**Goal:** Reproducible numbers for the performance review — nothing in the repo measured load, typing, preview,
export or import time.
**Files:**
- created: `scripts/perf-measure.mjs` — Playwright + installed Chrome against a production build: `/builder` cold
  load (TTFB, FCP, LCP, hydration = React props on the first input, JS transferred/decoded, first Continue),
  per-keystroke React work (capture→bubble on `input`) and input→paint for 50 characters in First name and Summary,
  input → first `.cv-print` mutation (preview), Download click → PDF blob (`URL.createObjectURL` hook; dense persona
  = classic profile with experience tripled, from the `smoke:pdf` build), import of `text-cv.pdf` /
  `header-contact.docx` / a 25 MB PDF, checker file → `POST /parse` sent (route answered locally), and Pixel 7 +
  4× CPU for cold load and typing. Medians over `RUNS` (default 3); JSON in `.perf-results/`.
- edited: `.gitignore` — `/.perf-results`.
**Notes / risks / follow-up:** Not a `test:*` script (needs a server + Chrome, and it reports numbers rather than
pass/fail). Usage in the file header. Event Timing API was not used for typing because Chrome clamps
`durationThreshold` to 16 ms, which hides exactly the keystrokes we care about.
**Suggested commit:** chore(perf): add scripts/perf-measure.mjs runtime measurement harness
## [2026-10-31 11:51] PDF fidelity session 4: Classic, Modern and Executive at density 5 — the last three mismatches

**Goal:** "What you see is what you download" for the three templates that were still `mismatch` in the
preview-vs-PDF harness (classic-dense 15.6 %, modern-dense 18.5 %, executive-dense 16.3 % page-1 block
diff), by root cause rather than by nudging numbers. Each turned out to be a different defect: Classic ran
on the shared `BASE_STYLES` sheet instead of `classic.tsx` (sizes, header gap, bullet gutter, trailing
entry margins, line boxes); Modern's line-heights are absolute px (`leading-[calc(Xrem*var(--lh))]`) so a
fontScale-scaled ratio made every line 10 % too tall at density 5, and its columns were not the live
`2fr 1fr` grid; Executive inherited the page line box on every row and padded its main column with the
page's 27/24 instead of the live 28·m px. Evidence, per-line measurements and the full matrix are in
`docs/ai-mission/PDF_FIDELITY.md` (parent folder), section "Session 4 — mismatches".
**Files:**
- edited: `components/pdf/CVDocument.tsx` — `ClassicPDFLayout` transcribed from `classic.tsx` (own sheet in
  px through `pt()`, every line box explicit at the root's 1.45·lineScale, bullets on the
  `ExperienceEntry` gutter rule, no header `marginBottom` because CSS collapses it into the first section's
  margin); `EducationVariant.notesMarginTop?` (Classic's `mt-1`; default 0.75 pt unchanged elsewhere).
  `ModernPDFLayout`: `absLine(boxPx, fontPx)` divides each ratio by fontScale, the main column and aside
  take the widths the live grid resolves to (`A4_WIDTH_PT`), and sections are flat children of their column
  with the gap on the heading — react-pdf honours `minPresenceAhead` only when the element has a previous
  sibling on the page, so the Certifications heading had been orphaned at the foot of page 1.
  `ExecutivePDFLayout`: `LH_NORMAL` on role / date / company / education rows and sidebar labels, the
  heading's 1.65 box, Summary at the live 11 px × 1.6, main column pulled up 6·m / out 3·m to the live
  padding, live sidebar pitches (contact 4 px, personal 4 px with a bold label, skills / languages 2 px,
  certifications 6 px with a 9 px issuer) without trailing margins, 88 px photo, Projects transcribed.
- edited: `scripts/pdf-fidelity-baseline.json` — the nine Classic / Modern / Executive cells lowered to the
  session-4 run (0.55 / 0.63 / 1.48, 1.03 / 0.65 / 1.07, 7.40 / 2.05 / 5.71); pages, parity and order
  entries unchanged.
- edited: `../docs/ai-mission/PDF_FIDELITY.md` — "Session 4 — mismatches": root causes, before → after per
  cell, the modern-dense extraction-order investigation, the full 42-cell matrix, gates, what remains.
**Notes / risks / follow-up:** Full matrix 31 ok / 11 check / **0 mismatch** (was 24 / 15 / 3); page
counts agree in 42 / 42; the 33 untouched cells are byte-identical to the previous baseline. modern-dense's
extraction order (aside before Certifications) stays as the baseline records it: the text layer is per
page and Certifications is on page 2 — every reordering option changes the visual; documented. Executive
dense's residual (one bullet that wraps in Chrome and fits in the PDF, run ending at the column edge) is
the rasteriser floor. Gates: tsc clean, lint 11 / 11, `npm test` 3 / 3, `smoke:pdf` 44 PDFs all checks
passed (overprint guard, Executive band on 2-page renders), `next build` clean, `fidelity:pdf --gate`
against the lowered baseline passed (42 cells, 31 ok / 11 check, no cell regressed; run
`_cowork/pdf-fidelity-2026-10-31-s4-gate/`). Remaining `check` cells (Corporate 13.6 %, Harvard
compact 12.5 %, Exec Split dense 11.1 %, ATS Clean 10.5 %, Banner, Chronicle) are the same line-box
transcription in layouts not touched here; kept out to limit merge conflicts with the Arabic work in the
text-primitives region of `CVDocument.tsx`. Branch `mission/pdf-fidelity-4`, not pushed.
**Suggested commit:** fix(pdf): transcribe Classic, Modern and Executive from their live templates (fidelity session 4)
## [2026-10-31 17:30] Arabic in the PDF export: shaper + single-run rule + Vazirmatn, preview face, persona suite, smoke, disclosure

**Goal:** Session-3 goal 4 left Arabic unprintable in the download (junk Latin glyphs, every Arabic word
lost from the text layer) while the preview rendered it. Make Arabic and mixed Arabic/English CVs export
correctly, or say exactly what must be restricted. Outcome: shipped with disclosure — see
`docs/arabic-pdf.md` (the library findings with file/line, the approach, the limits) and the "Session 4 —
Arabic" section of `../docs/ai-mission/PDF_FIDELITY.md`.
**Findings that shaped the design** (probes in `../_cowork/pdf-fidelity-s4-scratch/`, rasters in
`../_cowork/pdf-fidelity-2026-10-31-arabic/`): react-pdf 4.3.2 DOES bidi (bidi-js, per line) and DOES shape
(fontkit GSUB), but (1) a `fontFamily` stack is unusable — `reorderLine` pulls glyphs across runs by string
index and poisons pdfkit's subsets for the whole document; (2) it dedupes ligature glyphs by id per line, so
a second lam-alef on a line vanishes; (3) it charges no index to a glyph with no code points, so fonts that
build dots via `ccmp` (both Noto Arabic faces) drift and drop glyphs; (4) fontkit caches a glyph with the
code points of its first creation and pdfkit's subsetter creates composite components with none, so the
second document in a process (or the second download in a tab) corrupts. Pre-shaping to presentation forms
removes (2) and (3); one family per Arabic-bearing run removes (1); a glyph-cache warm-up removes (4).
**Files:**
- created: `lib/pdf/arabicText.ts` — `containsArabic`, `shapeArabic` (joining table → U+FB50–FDFF /
  U+FE70–FEFF, lam-alef composed, marks/tatweel/ZWNJ handled, Latin fi/fl/ffi/ffl → U+FB01–FB04),
  `toLogicalArabic` (NFKC). `lib/pdf/arabicText.test.ts` — 12 cases.
- created: `components/pdf/ArabicText.tsx` — `Text` / `Link` wrappers: Latin-only runs returned untouched;
  Arabic-bearing runs flattened to one string, shaped, set in the Arabic family with `letterSpacing: 0`.
- edited: `components/pdf/CVDocument.tsx` — imports `Text` / `Link` from the wrapper (only change).
- edited: `lib/pdf/fonts.ts` — `PDF_ARABIC_FAMILY` (Vazirmatn 400/700, italic mapped to upright),
  `pdfArabicFamily()`, `warmPdfFonts(arabic)`; `hooks/useDownloadCV.ts` awaits the warm-up (Arabic face only
  when the CV contains Arabic).
- created: `public/fonts/pdf/vazirmatn-400.ttf`, `vazirmatn-700.ttf` (static instances of google/fonts
  `ofl/vazirmatn/Vazirmatn[wght].ttf`, Vazirmatn 33.003, source commit 14f86869 in rastikerdar/vazirmatn),
  `vazirmatn-OFL.txt` (SIL OFL 1.1).
- edited: `app/globals.css` — `'Vazirmatn CV'` @font-face ×2 (`unicode-range` Arabic blocks) placed first
  in the three `--cv-font-*` stacks so the preview uses the PDF's face for Arabic and nothing else.
- edited: `lib/data/preview-profiles.ts` — `ARABIC_PERSONA_IDS`, `PERSONA_IDS`, `getPersonaProfile()` with
  `arabic-only`, `arabic-first`, `arabic-name`, `arabic-dense` (6 roles × 7 bullets, paginates everywhere);
  `app/preview/[templateId]/page.tsx` accepts them; `scripts/pdf-fidelity-render.tsx` + `pdf-fidelity.mjs`
  take `--persona=<any of the five>`.
- created: `scripts/arabic-smoke.tsx` + `scripts/arabic-smoke-check.mjs`, `npm run smoke:arabic` — 56 PDFs,
  every persona Arabic word found in the pdf.js text layer after NFKC, no U+FFFD / junk, dense ≥ 2 pages
  with Arabic on page 2, page rasters in `.arabic-smoke/`. `scripts/pdf-smoke.tsx` warms fonts too.
- edited: `components/builder/steps/ReviewStep.tsx` — a note under the download buttons when the CV
  contains Arabic (presentation forms in the text layer; mixed lines print in one face; .docx unchanged).
- edited: `eslint.config.mjs` (ignore the new transient dirs), `.gitignore`, `CLAUDE.md` (Fonts and print +
  checks), `docs/arabic-pdf.md` (new).
**Notes / risks / follow-up:** Latin-only output is byte-identical (wrapper short-circuits; the Arabic face is
not even fetched) — `npm run fidelity:pdf` gate result is in PDF_FIDELITY.md. Limits disclosed: text layer
holds presentation forms (ATS keyword match on Arabic may fail unless it normalises); inside an Arabic-bearing
line a nested bold / link / Inter-Latin is flattened into the one Vazirmatn run; the PDF resolves paragraph
direction from the first strong character while the live templates use an LTR base, so an Arabic-FIRST line
that also holds Latin orders its segments differently in the preview (`unicode-bidi: plaintext` on
`.cv-print` + an alignment decision is the template-side follow-up, an owner call); Urdu ہ forms are not
reliable. Never use a `fontFamily` array with react-pdf; never import react-pdf's `Text` into a layout.
Gates: tsc clean, lint 11/11, `npm test` green, build green, `smoke:pdf` green, `smoke:arabic` 56/56.
**Suggested commit:** feat(pdf): print Arabic — presentation-form shaper, single-run Text, Vazirmatn face

---

## [2026-10-31 13:40] CV import: failure taxonomy, pre-parse gate, encrypted/scan/.doc detection, header text, empty-mapping guard

**Goal:** GA4 (Oct 3–30) shows `cv_import` 296 / 234 users and `cv_import_failed` 41 / 19 users. Establish
what the two events mean, reproduce the failure modes with synthetic documents, and make every failure
path report one closed-set `error_reason` with a next step for the user. Findings and the before/after
matrix are in `docs/import-errors.md`.
**Files:**
- created: `lib/importers/importErrors.ts` — the closed `IMPORT_ERROR_REASONS` set (12 file-import reasons +
  4 report hand-off reasons), `IMPORT_FILE_TYPES` buckets, `MAX_IMPORT_BYTES` (15 MB), `PDF_TIMEOUT_MS`
  (45 s), `MAX_PDF_PAGES` (30), `ImportParseError` (moved here; `adapter.ts` re-exports it),
  `gateImportFile` (type → 0 bytes → size), `sniffContainer` (zip / OLE / %PDF), `classifyPdfError`
  (PasswordException → encrypted_pdf, InvalidPDF/FormatError → corrupt_pdf, "fake worker failed" →
  worker_load_failed), `classifyDocxError`, and `IMPORT_ERROR_COPY` (the user-facing sentence per reason).
- created: `lib/importers/docxParts.ts` — dependency-free zip walk + `DecompressionStream("deflate-raw")`
  that reads `word/header*.xml` / `word/footer*.xml`. mammoth reads `document.xml` only, and Word CV
  templates put the name and contact line in the header, so those imports arrived with no name or email.
  Headers are prepended; only footer lines that look like contact details are appended.
- edited: `lib/importers/pdfAdapter.ts` — `extractPdfText(data, { pdfjs, workerSrc, timeoutMs, maxPages })`
  takes an injected pdf.js module (the Node suite passes the legacy build); `resolveWorkerSrc` HEAD-probes
  the self-hosted worker ONCE per page and picks the CDN copy only if it is unreachable. The old
  catch-and-retry-via-CDN could never succeed: after the first worker failure pdf.js sets
  `#isWorkerDisabled` and memoises the rejected fake-worker import (`shadow(this, "_setupFakeWorkerGlobal")`),
  so the retry hit the same cached rejection. Deadline wrapper destroys the loading task on timeout;
  `parsePdfBytes` shared by browser + Node. Error objects are no longer logged (FormatError quotes bytes).
- edited: `lib/importers/docxAdapter.ts` — `extractDocxText(buffer, mammoth)` with byte sniff (OLE2 → the
  "older .doc, Save As .docx" message as `unsupported_type`; not a zip → `corrupt_docx`), header/footer
  pass, `parseDocxBytes` shared by browser + Node.
- edited: `lib/importers/adapter.ts` — `ImportFailureKind = ImportErrorReason`; re-exports `ImportParseError`.
- edited: `lib/importers/fieldMapper.ts` — `hasUsableContent(partial)`: a name alone is not usable (the parser
  lifts the first line of ANY document as a name, so a mis-picked meeting note opened the review as
  "1 section"); email/phone/summary/LinkedIn or any list section counts.
- edited: `components/builder/BuilderShell.tsx` — `handleImport`: `importFileType()` bucket (never the
  name) is the `file_type` param and the routing key; `gateImportFile` before any bytes are read; ONE
  `failImport(reason, message)` closure is the only place `cv_import_failed` is pushed; the empty-mapping
  guard reports `mapping_empty` with the checker hint instead of opening MappingReview in its disabled
  state; unknown throwables become `parse_exception` without their message. Error bar `<p>` now carries
  `data-testid="import-error"` (the smoke reads it).
- edited: `components/builder/ImportFromReportBanner.tsx` — reasons renamed to the closed set
  (`report_expired`, `report_fetch_failed`, `report_no_cv`, `report_network`; copy from `IMPORT_ERROR_COPY`).
- edited: `next.config.ts` — CSP gains `worker-src 'self' blob:`. Without it `worker-src` fell back to
  `script-src` (no `blob:`), and pdf.js loads a cross-origin worker through a blob: wrapper module, so the
  CDN fallback was refused by the browser as well.
- created: `__fixtures__/import/*` (12 files) + `scripts/make-import-fixtures.mjs` (`npm run
  fixtures:import`) — invented-person documents: Chrome-printed text PDF and Arabic-only PDF, hand-written
  Helvetica PDF, image-only "scan" (JPEG XObject, no text operators), RC4-40 encrypted PDF (user password
  `secret`), prose that is not a CV, DOCX with the contact line in the header, two-column table DOCX,
  EN+Arabic/Urdu bidi DOCX, OLE2 ".doc renamed .docx", 0-byte PDF, a 22-byte .jpg. The 25 MB PDF is built
  in a temp dir at test time, not committed.
- created: `scripts/import-fixtures.test.mjs` (`npm run test:import`, picked up by `npm test`) — real adapters
  from `.test-build/` over every fixture with pdf.js legacy + mammoth injected, plus timeout / worker /
  page-cap checks with stubbed modules. 51 assertions.
- created: `lib/importers/importErrors.test.ts`, `lib/importers/docxParts.test.ts` — node:test units.
- created: `scripts/import-smoke.mjs` (`npm run smoke:import`) — the fixtures through the real picker in
  Chrome against a running server; asserts the error bar text and exactly one `cv_import*` dataLayer push
  per pick, plus two worker scenarios (local worker 404 → CDN import; everything offline →
  `worker_load_failed`).
- created: `docs/import-errors.md` — event semantics and how to state the failure rate, the taxonomy with
  the copy, the pipeline order, the before/after matrix, what is not fixed.
- edited: `package.json` — scripts `test:import`, `smoke:import`, `fixtures:import`.
**Notes / risks / follow-up:**
- Event semantics: `cv_import` = a CONFIRMED review (never per attempt); `cv_import_failed` = a pick stopped
  before the review. A cancelled review fires nothing, so 41 / (296 + 41) = 12.2 % is a floor on the
  per-pick failure rate, and "19 of 234 users" are two independently counted sets (overlap unknown:
  7.5 %–8.1 % of users who tried saw a failure). Both events include `file_type: ats_report`.
- `error_reason` values changed shape (snake_case, 16 values) — GA4 explorations filtering on
  `corrupt-file` / `empty-text` / `report-expired` need updating; the GTM DLVs (`file_type`, `error_reason`)
  already exist, no container change needed.
- 15 MB gate is new behaviour: before, a 25 MB PDF imported fine on desktop Chrome. The limit is a
  judgement call (text CVs are under 2 MB; photo CVs 1–5 MB).
- Parser quality gaps surfaced but NOT fixed (reviewable in MappingReview, not failure events): a
  `Company · City · Dates` / `City | Dates` line under a role title becomes a second experience entry
  (text-cv.pdf 2 roles → 4 entries, rtl-mixed.docx 2 → 5); Arabic headings are not recognised (an Arabic
  CV with a Latin email line imports as "1 section"). Scans still need OCR, which is not offered.
- Gates: `npx tsc --noEmit` clean; `npm run lint` 11/11 warnings (unchanged); `npm test` all suites green
  (unit 479 incl. 20 new; parser 191; import 51); `npm run build` clean; against `next start -p 3500`:
  `smoke:builder` all passed, `smoke:import` 15/15 passed. The dev server on 3300 and the start on 3500
  were stopped afterwards.
- Not touched: `components/pdf/**`, `scripts/pdf-*` (another agent), `.env.local`, `UploadDropzone.tsx`
  (it shares the extraction functions and still shows its own generic messages — a follow-up could map
  `ImportParseError.kind` to the same copy).
**Suggested commit:** feat(import): closed error taxonomy, pre-parse gate, encrypted/scan/.doc detection, header text, empty-mapping guard

---

## [2026-10-31 12:30] Public checklist endpoint so the marketing site can catch checker-count drift (Mission 8)

**Goal:** www.makemycv.ae hard-codes "44 checks" and the per-category counts (its `WhatWeCheck`
section and "40+ UAE-tuned checks" copy) while this repo derives them from `lib/resumeChecker/checklist.ts`,
which `checklist.test.ts` pins to the score engine. Nothing connected the two repos, so an engine
change here would leave the site quoting a stale number. This adds the app half of a one-way
contract: a public JSON endpoint that the site's CI script compares its constants against.
**Files:**
- created: `lib/resumeChecker/checklistContract.ts` — `buildChecklistContract()` turns `CHECKLIST` into
  `{ version: 1, count, categories: [{ id, label, count, items: [{ id, label, signals, parserOnly }] }] }`;
  `count` per category = engine sub-signals (14 / 7 / 14 / 9 = 44), item `id` = the signal ids joined
  with `+`. `CHECKLIST_CONTRACT_VERSION` is bumped only when the shape changes incompatibly.
- created: `lib/resumeChecker/checklistContract.test.ts` — pins version 1, the fields the site script
  reads, count = `CHECKLIST_SIGNAL_COUNT` = sum of categories, category order/ids mirror `checklist.ts`,
  unique item ids / signals, JSON round-trip. Picked up by `npm run test:unit` automatically.
- created: `app/api/resume-checker/checklist/route.ts` — GET (and OPTIONS 204), no inputs, no secrets:
  `Cache-Control: public, max-age=3600, s-maxage=86400`, `Access-Control-Allow-Origin: *`. Returns the
  payload above. Verified locally: 200, headers as listed, 44 checks in 4 categories.
**Notes / risks / follow-up:** the site side (makemycv-site `lib/checkerChecklist.ts`,
`scripts/check-checklist-contract.mjs`, `npm run check:checklist`, non-blocking CI job) treats a non-200
from this URL as "skipped", so nothing breaks while this route is only on staging; once `stagingmmc`
is merged to `main` the job starts comparing for real. The site's rendered list stays static (SEO) —
this endpoint is a CI oracle, not a runtime dependency. Category labels are duplicated from
`CATEGORY_META` in `scoreEngine.ts` (not exported; engine left untouched) — if those names change,
change `CHECKLIST_CATEGORY_LABELS` too (the script matches on `id`, not label, so a label drift is
cosmetic). Gates: `npx tsc --noEmit` clean, `npm run lint` 11/11 warnings, `npm test` all suites green.
**Suggested commit:** feat(checker): public /api/resume-checker/checklist endpoint for the site's drift check

---
## [2026-10-31 15:40] PDF fidelity session 3: ATS Clean / Onyx / Sandstone / Professional transcribed, line-box rule, fidelity gate, Arabic + extraction checks

**Goal:** `docs/ai-mission/PDF_FIDELITY.md` goals 1–5 (parent folder): close the ATS Clean header offset
(rank 5 residual), the remaining Onyx / Sandstone mismatches, the one page-count disagreement
(Professional Photo at density 5), and measure Arabic script and ATS text extraction — with a regression
guard for each fix. Dual-render-path rule: live templates untouched; every change is on the PDF side.
**Files:**
- edited: `components/pdf/CVDocument.tsx` —
  - **Root cause found for the whole "cumulative drift" family:** a react-pdf `<Text>` with no
    `lineHeight` does not re-resolve from its own size — it inherits the page's RESOLVED box
    (8.6 × 1.45 = 12.47pt) whatever its size (probe: two 20pt lines 12.47pt apart). The live templates
    inherit `line-height: 1.5` from Tailwind's preflight (`html { line-height: 1.5 }`) on every run
    that sets none (headings, side labels, chips, entry rows). New `LH_NORMAL = 1.5` constant; every
    such run in the four layouts below now sets its line box explicitly.
  - `ATSCleanPDFLayout` rewritten from `ats-clean.tsx`: name 26px × 1.2, headline 13px, contact 10.5px
    and essentials 10px at the root 1.55 line, 2px rule 8/16px, headings 11px × 1.55 over a 1.5px rule
    (20px·sp above, 8px below), summary 1.6, roles through `ExperienceEntry` (12px gap, 16px list indent,
    no bullet gap), languages joined with ", " as live (was " · "), certificates 4px apart, projects
    10px apart. Dead `ats*` keys dropped from `BASE_STYLES` / `SECTION_GAP_KEYS`.
  - `OnyxPDFLayout` / `SandstonePDFLayout`: photo 108 / 110px with a 3px ring, headline 11px × 1.4,
    sidebar runs 10px (were 7.8pt — the About-me paragraph wrapped into more lines than the preview),
    live column gaps (4 / 3 / 4px; Sandstone details 6px, label 8.5px at 0.04em), Onyx detail labels and
    Sandstone contact/language runs in the live band colours, main column pulled to the live 30px·m
    padding (`marginTop −4.5·m`, `marginRight −1.5·m`), certificates "name | issuer | date" with the
    tail in grey, projects 11.5px / 14px indent / 10px gap, `LH_NORMAL` on headings, side labels, chips,
    role / education rows and project titles.
  - `ProfessionalPDFLayout` rewritten from `professional.tsx` (it reused the Classic sheet): the live
    40·m / 44·m px page padding (the layout pads the 3 / 9pt difference so lines wrap where the preview
    wraps), 28px name, 12.5px headline, 10.5px contact with slate-300 "•", chips at the root line,
    11px headings × 1.5 (18px·sp above, 10px below), summary 1.55, roles 12px × 1.35 with `space-y-1`
    inside and `space-y-3` between, bullets 11px × 1.5 with a 4px item gap, Languages | Certifications as
    a plain two-column row (the old `s.twoCol` added a second 18pt·sp section gap on top of the heading's
    own — the cause of the page-2 spill at density 5), bold language names, "| issuer | date" tails.
    `ProPdfHeading` removed (PdfHeading does it).
  - Primitives: `HeadingVariant.lineHeight?` (PdfHeading applies it); `BulletStyles.gap?` (the live
    `space-y-*` between items, as marginTop on every item after the first).
- edited: `scripts/pdf-ops-check.mjs` — check 5: no two text runs overprint (pdf.js text boxes on one page
  overlapping > ½ their height and > 1pt horizontally) — the guard for the inherited-line-box class of
  defect. 44 smoke PDFs pass.
- edited: `scripts/pdf-fidelity.mjs` — `--gate` (compares every cell with `scripts/pdf-fidelity-baseline.json`:
  PDF page count must not change, text parity not drop > 1 point, page-1 block diff not rise > 3 points,
  section order not regress; exit 1 otherwise), `--persona=bilingual`, and an extraction check per cell
  (heading order in the pdf.js text layer vs the preview DOM, email / phone surviving as one run) printed
  in the console line and a new matrix column.
- created: `scripts/pdf-fidelity-baseline.json` — the 42 accepted cells from this session's final run.
- edited: `package.json` — `fidelity:pdf` = `node scripts/pdf-fidelity.mjs --gate` (needs `next start` +
  Chrome; not a `test:*` script).
- edited: `scripts/pdf-fidelity-render.tsx`, `lib/data/preview-profiles.ts`,
  `app/preview/[templateId]/page.tsx` — `getBilingualPreviewProfile()` (SYNTHETIC Arabic + English
  overlay of each template's persona, labelled as such, email `bilingual.synthetic@email.ae`),
  `/preview/<id>?persona=bilingual`, `FIDELITY_PERSONA=bilingual` in the renderer with its own
  `manifest-bilingual.json`.
**Notes / risks / follow-up:**
- Fidelity (page-1 pixel / block, before → after, `_cowork/pdf-fidelity-2026-10-31-s3-baseline` →
  `-s3-final`): ats-clean 10.67/21.33 → 7.78/10.51, 9.43/19.51 → 7.93/7.19, 10.68/22.04 → 8.24/10.26;
  onyx 8.94/9.32 → 5.81/0.79, 8.52/9.82 → 3.75/0.55, 11.81/18.18 → 9.37/9.92; sandstone 7.09/5.57 →
  6.21/5.59, 7.06/7.65 → 4.14/0.66, 10.06/14.30 → 6.09/1.11; professional 10.82/20.04 → 4.36/2.29,
  8.90/13.44 → 5.62/1.82, 11.79/23.95 → 7.22/2.16; professional-photo 9.85/18.10 → 4.98/2.56,
  8.58/14.63 → 5.16/2.74, 11.19/23.40 → 6.71/0.81. Tally 14 ok / 17 check / 11 mismatch → 24 / 15 / 3;
  page counts agree in 42/42 (professional-photo dense was 1~/2). Text parity 100 % everywhere it was.
- **Arabic (goal 4): the PDF cannot print Arabic.** None of the six embedded faces has an Arabic glyph
  (fontkit: 0/14 code points in Inter / Bricolage / Instrument Serif), react-pdf has no fallback chain,
  and Helvetica cannot encode it either, so every Arabic run prints as garbage Latin glyphs and the text
  layer loses every Arabic word (32/32 in all 14 templates, 40–50 junk tokens instead; composites in
  `_cowork/pdf-fidelity-2026-10-31-bilingual/`). The live preview is fine (browser system-font
  fallback). Not fixed: it needs an Arabic face (Noto Sans Arabic / IBM Plex Sans Arabic, both SIL OFL
  1.1 — licence file must ship) registered as a second family plus script-aware run splitting, and a
  spike on react-pdf's Arabic shaping / bidi before it can be promised.
- Extraction (goal 5): section order and the email / phone lines survive in 41/42 cells. `modern-dense`
  is a real difference: the two-column Modern breaks across pages, so the text layer emits the aside
  (Education, Skills) before Certifications (page 2); the preview DOM has them after. Gulf Standard's
  "no heading: languages" is a label in its Personal Details table, not a section.
- Remaining mismatches (Classic / Modern / Executive at density 5) and most `check` cells are the same
  inherited-line-box drift in layouts not transcribed in this pass; `LH_NORMAL` is the fix shape.
- Weight 500 live runs (ATS Clean / Professional headline) print in the 400 cut — the PDF faces ship
  400 / 700 only.
**Suggested commit:** fix(pdf): transcribe ATS Clean, Onyx, Sandstone, Professional; explicit line boxes; fidelity gate

## [2026-10-31 11:10] PDF fidelity ranks 2–3: ATS Clean bullet pitch, Onyx/Sandstone band widths + names

**Goal:** the next two items of the ranked list in `docs/ai-mission/PDF_FIDELITY.md` (parent folder), each
a transcription gap between the live template and its PDF layout (dual-render-path rule, CLAUDE.md).
**Files:**
- edited: `components/pdf/CVDocument.tsx` —
  - `ATSCleanPDFLayout`: both `BulletList` call sites (roles, projects) now pass `atsBullets`
    (`text`/`dot` `pt(11)·fontScale`, `lineHeight 1.55·lineScale`, `#374151`; `item.marginBottom 0`) —
    the live `ats-clean.tsx` ~440–460 values; the Classic sheet gave 8.6 pt × 1.45 + 3 pt per bullet.
  - `OnyxPDFLayout`: `SIDEBAR_WIDTH = pt(220)` (165 pt, was 172) — live `onyx.tsx` 166 is 220px; the band's
    inner column is now 132 pt like the live one. Sidebar name `pt(21)·fontScale`, `lineHeight 1.15`,
    `letterSpacing` 0.02 em through `safeTracking` (was 14 pt / 1.2; live `onyx.tsx` 197).
  - `SandstonePDFLayout`: `SIDEBAR_WIDTH = pt(230)` (172.5 pt, was 180) — live `sandstone.tsx` 178 is
    230px; sidebar name `pt(20)·fontScale` (was 14; live `sandstone.tsx` 207 is 20px).
- edited: `scripts/pdf-ops-check.mjs` — `BANDS.onyx.width 172 → 165`, `BANDS.sandstone.width 180 → 172.5`
  (the ops check asserts the fixed band to ±1 pt on every page).
**Notes / risks / follow-up:** live templates untouched (the doc names the PDF side as the wrong one in
all three). `npm run smoke:pdf`: 42 PDFs, ALL CHECKS PASSED, band found on every Onyx/Sandstone page at the
new widths. Fidelity harness re-run against `next start -p 3400` (`--only=ats-clean,onyx,sandstone`,
output `_cowork/pdf-fidelity-2026-10-31-ranks2-3/`), page-1 pixel / block diff, before (PDF_FIDELITY.md
matrix) → after:
  - onyx: natural 10.70 / 12.18 → 8.94 / 9.32; compact 9.95 / 11.57 → 8.52 / 9.82; dense 13.57 / 22.55 →
    11.81 / 18.18 (the vertical blue stripe along the band edge is gone from the composites).
  - sandstone: natural 9.03 / 7.41 → 7.09 / 5.57; compact 8.55 / 8.91 → 7.06 / 7.65; dense 11.41 / 15.31 →
    10.06 / 14.30.
  - ats-clean: natural 10.44 / 17.14 → 10.67 / 21.33; compact 9.58 / 20.56 → 9.43 / 19.51; dense 10.80 /
    21.67 → 10.68 / 22.04 — NOT improved. The bullet pitch now matches the preview (verified on the
    composite: the two bullet blocks line up with themselves), but the PDF still sits lower from the
    header on (the SUMMARY rule is ~16 pt lower in the PDF than in the preview), so with the bullets no
    longer absorbing part of that offset the block metric moved sideways. The residual is the ATS Clean
    header/section transcription (name/headline/contact block and the `s.body` paragraph metrics), i.e.
    the doc's "cumulative drift" family (rank 5), not the bullet list; it needs its own pass. Text parity
    100 % and page counts agree in all 9 cells before and after.
**Suggested commit:** fix(pdf): ATS Clean bullet pitch; Onyx/Sandstone sidebar widths and names match live

## [2026-10-31 10:05] Checker page: itemised "What this checks" list + the file sentence (FEATURE_BACKLOG B2)

**Goal:** B2 — replace the four one-line category cards on `/resume-checker` with the full list of rules the
engine runs, and say in one verifiable sentence what happens to the file. Also the groundwork for
retiring the employer-ATS claims on www (PROPOSAL-checker-claims.md): a count that is derived from code.
**Files:**
- created: `lib/resumeChecker/checklist.ts` — `CHECKLIST` (4 groups, 33 lines covering 44 engine
  sub-signal ids: Content C1–C14, Sections S4/S5/S7–S11, ATS Essentials A1–A14, Design D1–D9), with the
  thresholds the engine uses and `parserOnly` on the five layout/spelling signals (C12, C13, A3, A4, A5)
  that only the checker can score; `CHECKLIST_SIGNAL_COUNT` (44) and `CHECKLIST_CATEGORY_COUNT` (4).
- created: `lib/resumeChecker/checklist.test.ts` — reads `lib/scoreEngine.ts` and asserts the listed ids
  equal the `sig("…")` ids in the engine (each once), that `parserOnly` matches the engine's `conditional`
  flag, and that ids sit under their category. A rule added or removed in the engine fails `test:unit`
  until the page list is updated, so the printed count cannot drift.
- edited: `app/resume-checker/page.tsx` — section renamed "What this checks"; sub-line "44 checks in 4
  categories — the same rubric for every CV, listed in full" (numbers from the constants, not typed);
  each category card now carries its count and an itemised `<ul>` (server-rendered, `parser` badge on
  the conditional lines); one "What happens to your file" paragraph: browser extracts the text, only the
  text is sent, an AI model (Anthropic) structures it, the rules score it, text + report stored 24 h so
  the link works, then expire, file never leaves the device, no account. Each clause checked against
  `UploadDropzone.tsx`, `lib/resumeChecker/parse.ts`, `storage.ts` (`TTL_SECONDS = 86400`, `rawText`
  stored server-side with the report) and `app/api/resume-checker/parse/route.ts`.
**Notes / risks / follow-up:** there was no "60+ checks" claim in this app (grep); the old sub-line "Four
categories, same rubric, every CV" was true and is kept in spirit. The www copy for the checker lives in
`makemycv-site` and still needs the same list/count if it states one. Verified on `next dev -p 3300`:
the list and the count are in the server HTML (no JS needed), axe clean on the page. Wording follows the
truthfulness rule — every line says what the check looks for in the document.
**Suggested commit:** feat(checker): itemised "What this checks" list pinned to the score engine

## [2026-10-31 09:20] Checker: "What the ATS sees" text-extraction preview (FEATURE_BACKLOG B3)

**Goal:** B3 from the mission backlog — the competitor research scored a visible "what the parser reads" view
as the top checker differentiator. The browser already extracts the text before upload (pdf.js / mammoth);
this shows that exact string to the user, with counts and notes about content that looks lost, before and
alongside the server report. No new data leaves the browser: the panel renders the same `rawText` the
dropzone was already posting, and the report-page copy travels in this tab's `sessionStorage` only.
**Files:**
- created: `lib/resumeChecker/extractionPreview.ts` — `analyseExtraction()` (chars/words/lines/pages +
  lost-content notes: empty extraction; < 120 words per page on a multi-page PDF; U+FFFD / private-use
  glyphs; letter-spaced headings; no email / no phone, with the Word header/footer cause named for DOCX —
  mammoth drops headers) and the versioned `makemycv:checkerPreview` sessionStorage carry-over (shape
  version 1, discards on mismatch or another report id). Copy describes the text, never the person.
- created: `lib/resumeChecker/extractionPreview.test.ts` — 7 node:test cases (picked up by `test:unit`).
- created: `components/resume-checker/AtsTextPreview.tsx` — the panel: heading + "N characters · N words ·
  N lines · N pages · file", a 38 px "Show text / Hide text" pill, notes list in the severity tokens, and a
  monospace `<pre>` (whitespace-pre-wrap, 26 rem max height) with the text in parser order. Fires
  `checker_preview_viewed` (`surface`: `upload` | `report`, an existing DLV) once per mount when opened.
- created: `components/resume-checker/ReportAtsTextPreview.tsx` — report-page mount; reads the carry-over
  after hydration and renders nothing for anyone who did not upload in this tab (shared links).
- edited: `components/resume-checker/UploadDropzone.tsx` — uses `extractPdfTextInBrowserDetailed` for the
  page count, keeps the extracted text in state, shows the panel under the trust chips while the server
  works (collapsed) and on the error path (open — a scanned PDF's 12 characters explain the message),
  saves the carry-over right before `router.push`. Added `aria-label` to the file input: in the busy
  state the label's only text is inside the `role="status"` live region, so axe flagged the control as
  unlabelled (pre-existing, found by the new smoke). Upload flow, validation and consent copy untouched.
- edited: `app/resume-checker/report/[reportId]/page.tsx` — mounts `ReportAtsTextPreview` above the
  category cards.
- edited: `lib/importers/pdfAdapter.ts` — `extractPdfTextInBrowserDetailed()` returns `{ text, pages }`;
  `extractPdfTextInBrowser` now delegates to it (same text, builder import unchanged).
- created: `scripts/checker-smoke.mjs` + `smoke:checker` script — uploads a PDF (`.smoke-pdfs/`,
  `.fidelity-pdfs/` or `SMOKE_PDF`) with the parse route answered locally, asserts the panel, counts,
  `<pre>` text, the dataLayer event, axe (serious/critical) with the panel open, the redirect, that the
  ONLY non-GET request is the parse POST with body keys exactly `{fileName, rawText}`, and the
  sessionStorage carry-over. Not a `test:*` script (needs a server + Chrome).
**Notes / risks / follow-up:** verified against `next dev -p 3300` with the system Chrome: smoke green
for a 2-page PDF (3,072 chars / 426 words / 2 pages, zero notes) and for a generated DOCX whose contact
line sat in the Word header (notes: no email — headers/footers — and no phone, as intended); one real
end-to-end run reached the report in 17 s and showed the same panel above the findings with
`checker_preview_viewed{surface:report}`. `checker_preview_viewed` needs a trigger + GA4 tag published
in GTM like every other event. The notes are heuristics on the text only (detect, never assert): a
missing email is reported as "the text has no email address", never as a claim about the file. The
sessionStorage record holds the CV text per tab until the tab closes — same device, same browser, never
sent. `npm run test:migrate` does not exist in package.json (migrate.test.ts runs under `test:unit`).
**Suggested commit:** feat(checker): "What the ATS sees" extracted-text preview with lost-content notes
## [2026-10-31 08:30] LinkedIn recruiter message v1 — `/linkedin-message`, written from a disclosed CV excerpt

**Goal:** Product #3 in CLAUDE.md (docs/ai-mission/AI_FEATURES.md #1), planned since May and never built. A
60–90-word first-person message to the recruiter / hiring manager about one pasted role — or a ≤200-character
connection-request note — generated from the user's own CV with the cover letter's truthfulness contract
(`{{number}}` placeholders, refusal is a valid output) and the same disclosure-before-send pattern. Copy-only.
**Files:**
- created: `lib/linkedinMessage/payload.ts` (+ `payload.test.ts`, 7 tests) — THE place that decides what leaves
  the browser: headline, latest non-blank role (title, company, ≤2 bullets ≤200 chars), ≤3 skill names, visa +
  availability. No name, contact details, LinkedIn handle, photo, summary, dates, education, certifications or
  languages (the test pins the exact key set). The pasted job / recruiter text is REQUIRED (≥30 chars, ≤3,000).
  Client builds it, server re-parses and re-clips it (`parseLinkedinMessageRequest`); an unknown `variant`
  falls back to `message`.
- created: `lib/linkedinMessage/prompt.ts` (+ `prompt.test.ts`, 6 tests) — system prompt (UK English, first
  person, no flattery, no invented facts or names, `{{number}}` for any figure not in the excerpt, REFUSE with
  `{"refusal": …}` when the paste is not a job / recruiter context, paste treated as data), per-variant format
  instruction, and `parseLinkedinModelOutput` (fence-tolerant JSON, placeholder normalisation, refusal
  surfaced as its own outcome, length tolerance 35–140 words / ≤240 chars so the route retries wild misses).
  Pure so the refusal and validation paths are tested without an API key.
- created: `app/api/linkedin-message/route.ts` — Haiku 5.5 via `CLAUDE_MODEL`/`CLAUDE_EFFORT`, per-IP 6/24h +
  2/60s (`mmcv_li_daily` / `mmcv_li_burst`), 1 spend unit through `takeSpendUnits`, retry-once, 400 on an
  unusable body, 422 `{error:"refused"}` on a model refusal, 502 when nothing usable came back.
- created: `hooks/useLinkedinMessage.ts` — fetch + RATE_LIMITED / REFUSED / OTHER; `generate` returns the
  outcome so the panel logs it without a re-render.
- created: `components/linkedin/LinkedinMessagePanel.tsx` — paste box with live `n / 3,000` count, Format
  toggle (Message 60–90 words / Connection note ≤200 chars, `aria-pressed`), disclosure box computed from the
  live excerpt, result with `PlaceholderText`, Edit toggle, Copy disabled while a placeholder remains, live
  word/char count (red + "LinkedIn will cut this off" when a note exceeds 200), refusal shown as a plain
  `role=status` line, empty-CV guide. Reads the JD Match seed (`stashLinkedinMessageSeed`,
  `makemycv:linkedinMessageSeed` in sessionStorage) in the state initialiser — the form mounts only after
  `hydrated`, so no setState-in-effect and no SSR mismatch. `track("linkedin_message_requested" |
  "linkedin_message_copied")` with enum params only (`variant`, `outcome`, `placeholders`, `over_cap`).
- created: `app/linkedin-message/page.tsx` — noindex, same shell as `/cover-letter`.
- edited: `components/builder/steps/ReviewStep.tsx` — "Message the recruiter on LinkedIn" under "Write a cover letter".
- edited: `components/jdmatch/JdMatchPanel.tsx` — the peer nudge now offers both ("Write the letter → · Write
  the message →"); the message link seeds only the pasted ad. The CV still never leaves JD Match.
- edited: `lib/analytics.ts` — `PARAM_KEYS` + `variant`, `over_cap`.
- edited: `lib/server/spendGuard.ts` — comment counts six 1-unit routes.
- edited: `eslint.config.mjs` — `.pdf-fidelity-build/**` and `.fidelity-pdfs/**` ignored. The fidelity
  harness (dea8944) writes compiled JS there; in a checkout that has run it, `npm run lint` reported 167
  errors from that transient output (the `.*-test-build/**` glob does not match the name). Real count was
  and is 11 warnings.
- edited: `CLAUDE.md` — product #3 marked shipped, route map, privacy section names the second excerpt.
**Notes / risks / follow-up:** Gates: tsc clean, lint 11/11 (no new warnings), test:unit 445/445 (incl. 13 new),
test:parser 191/191, migrate 26/26, `next build`, `smoke:builder` 27/27 (every PASS the script emits; the earlier "28" counted a step that prints none) against `next start -p 3200`, plus an ad-hoc Playwright pass over `/linkedin-message` itself (18/18: empty-CV guide, disclosure lists headline / latest role with 2 bullets / 3 skills / visa line, Generate gated on CV + ≥30-char paste, Format toggle `aria-pressed`, the captured POST body has exactly `cv`/`jobText`/`variant` and no name/email/phone/summary/dates, 429 renders as `role=alert`, axe 0 violations).
No `ANTHROPIC_API_KEY` on this machine, so the live route was NOT exercised end to end: the route's input
validation (400) and "API not configured" (500) paths were checked over HTTP against the production build,
and the refusal / placeholder / length paths against canned model replies in `prompt.test.ts`. First live
run should confirm Haiku respects the `{"refusal": …}` contract and the 200-char note cap. **Owner, same
release:** add the LinkedIn message to the AI-features paragraph of `makemycv-site/app/privacy/page.tsx`
(lines ~155–166 name the cover letter writer and its excerpt) — not touched from this worktree. Also: two new
GTM triggers + tags (`linkedin_message_requested`, `linkedin_message_copied`) and the `variant` / `over_cap`
Data Layer Variables. Not done in v1: tone options, a per-recruiter name field (deliberately — the model may
only use a name that appears in the paste).
**Suggested commit:** feat(linkedin): recruiter outreach message from a disclosed CV excerpt

## [2026-10-31 06:15] PDF fidelity harness (preview vs PDF, 14 × 3) + Professional name/headline overprint fix

**Goal:** Phase 3 of the autonomous mission: a repeatable preview-vs-PDF comparison instead of eyeballing,
and the first defect it found fixed. The harness rendered 42 cases (14 templates × natural/compact/dense
personas from `getPreviewProfile`): text parity 98.5–100 % everywhere, page counts agree in 41/42, and one
real layout defect — in Professional and Professional Photo the headline printed across the name in every
PDF (text layer read "mahmouddigital"). Report: `docs/ai-mission/PDF_FIDELITY.md` in the parent folder;
composites in `_cowork/pdf-fidelity-2026-10-31/`.
**Files:**
- created: `scripts/pdf-fidelity.mjs` — serves pdf.js + PDFs from node_modules over `node:http`, screenshots
  `/preview/<id>?density=N` with the system Chrome, rasterises PDF pages with pdf.js at 794 px, compares
  words (innerText vs text layer), page count and a luminance block diff; writes composites + results.json.
  Flags `--only=`, `--skip-render`; env `PREVIEW_BASE_URL`, `FIDELITY_OUT`, `FIDELITY_TOL`.
- created: `scripts/pdf-fidelity-render.tsx` — renders every template × density from the same transform
  as the `/preview` route, real fonts embedded, into `.fidelity-pdfs/`.
- edited: `components/pdf/CVDocument.tsx` (ProfessionalPDFLayout name `<Text>`) — explicit
  `lineHeight: 1.15 * theme.lineScale`. Without it the 20 pt name inherited the page's 8.6 pt × 1.45 line
  box and the headline printed over it. Mirrors `professional.tsx`.
- edited: `.gitignore` — `.fidelity-pdfs/`, `.pdf-fidelity-build/`.
**Notes / risks / follow-up:** re-run on the two templates after the fix: headline sits below the name in
both; block-diff numbers barely move because the remaining Professional drift is section spacing (see
report ranks 2–7: ATS Clean bullet pitch, Onyx/Sandstone sidebar widths, Exec Split chips — not fixed,
documented with file/line). The harness needs a prod server on :3000 (`PREVIEW_BASE_URL` to change). The
third content case ("long experience") cannot be previewed by `/preview`, so the content axis is
persona × density. `smoke:pdf` re-run after the fix (see commit).
**Suggested commit:** fix(pdf): Professional name line height; add preview-vs-PDF fidelity harness

## [2026-10-31 05:40] Security: next 16.4.3, @sentry/nextjs 10.78.0, audit fixes

**Goal:** `npm audit` (2026-10-31) listed 39 advisories against the pinned `next@16.1.6`, three critical
(unauthenticated RCE in the Image Optimization API with SVG, GHSA-2464-fhr4-w9xw; RCE in `use cache` typed
arrays, GHSA-673q-mjm6-r5xr; RCE on Windows hosts, GHSA-p293-qw3h-jr36), the Middleware/Proxy bypass family
(this app runs `proxy.ts`), Server-Action DoS and SSRF items; plus a critical middleware bypass in
`@sentry/nextjs` 10.69.0 (GHSA-mchm-gjx6-7h55). The site got the same upgrade (makemycv-site `07f3ed0`).
**Files:**
- edited: `package.json`, `package-lock.json` — next 16.1.6 → 16.4.3 (first clean release, not a
  semver-major), @sentry/nextjs 10.69.0 → 10.78.0; `npm audit fix` lifted nanoid 5.1.16, @xmldom/xmldom
  0.8.15 (docx export), postcss 8.5.23, fast-uri, brace-expansion, browserslist, source-map-js. React stays
  19.2.3.
**Notes / risks / follow-up:** tsc clean, lint 11/11, `npm test` all suites, `next build`, and
`smoke:builder` 28/28 against `next start -p 3200` from the upgraded build (PDF 16,485 B, DOCX 9,098 B,
funnel events present). One high advisory remains that needs a breaking change (left alone; see
docs/ai-mission/SECURITY_REVIEW.md). Owner: merge `stagingmmc → main` promptly (BLOCKERS B10). Gotcha:
`npm audit fix --omit=dev` prunes devDependencies — run plain `npm install` afterwards.
**Suggested commit:** chore(deps): next 16.4.3, @sentry/nextjs 10.78.0, audit fixes

## [2026-10-31 04:05] smoke:builder covers persistence, DOCX, template/fullscreen and the funnel events; runs in CI (non-blocking)

**Goal:** Phase 2/11 of the autonomous mission: a repeatable browser regression for the journeys the
October audit could only catch by hand. The old smoke proved Continue clicks and one PDF; it said
nothing about the CV surviving a reload (the worst possible builder defect), the DOCX path (its own
renderer), or whether the analytics funnel actually emits.
**Files:**
- edited: `scripts/builder-smoke.mjs` — reload-persistence check after the Contact step; Next
  template + Fullscreen (via `dispatchEvent`, the drawer controls sit below the fold at 1440×900);
  DOCX export (`Export .docx`); a context init script that mirrors every `dataLayer` event name into
  `sessionStorage` so the end-of-run assertion sees the whole session across the deliberate reload;
  asserts `builder_step`, `builder_start`, `template_selected`, `cv_preview_viewed`,
  `cv_section_completed`, `cv_export_started`, `cv_export`; axe now also excludes `.cv-print` (the
  rendered CV document — its colours are a template decision per CLAUDE.md, same rule as the
  `[inert]` thumbnails; without this the live preview column's `text-slate-400` dates fail
  color-contrast on every builder step).
- edited: `.github/workflows/ci.yml` — new non-blocking `e2e` job: playwright chromium, `next build`,
  `next start`, `smoke:builder`.
**Notes / risks / follow-up:** 28/28 PASS locally against `next start -p 3000` from a production build
(2026-10-31 04:00). CI minutes: the e2e job adds ~6–8 min per push; it is `continue-on-error`.
**Suggested commit:** test(smoke): persistence, DOCX, template/fullscreen and funnel-event asserts; e2e job in CI

## [2026-10-31 03:10] Funnel events template_selected / cv_export_started / cv_preview_viewed / cv_section_completed; PARAM_KEYS covers every pushed key

**Goal:** GA4 code audit 2026-10-31 (docs/ai-mission/GA4_AUDIT.md in the parent folder). The builder funnel
had `builder_start` → `builder_step` → `cv_export` and nothing in between, so template choice, preview
engagement, section completion and failed exports were invisible. Separately, `track()` reset only the
nine container-v4 keys while the app pushes twelve more (`step_id`, `file_type`, `outcome`, …), so a
value from one event could ride along on the next.
**Files:**
- edited: `lib/analytics.ts` — `PARAM_KEYS` extended to the full key union pushed by either surface
  (mirrors the same change in `makemycv-site/lib/analytics.ts`).
- edited: `components/builder/BuilderShell.tsx` — `template_selected` (effect on
  `data.settings.templateId` after hydration; baseline value is not a selection), `cv_preview_viewed`
  (once per session per surface: fullscreen overlay, mobile Preview toggle), `cv_export_started`
  (before the export await; JSON backups excluded like `cv_export`), `cv_section_completed` (inside the
  existing incomplete→complete effect, once per session via `trackOncePerSession`).
**Notes / risks / follow-up:** nothing reaches GA4 until the owner publishes Custom Event triggers + GA4
tags for the four names in GTM-5H2LMVJT and registers `step_id` as an event-scoped dimension
(docs/ai-mission/BLOCKERS.md B07). No PII: params are template ids, formats, surfaces and step ids.
tsc, lint (11/11) and `npm test` (191 assertions) pass.
**Suggested commit:** feat(analytics): template_selected, cv_export_started, cv_preview_viewed, cv_section_completed; reset every dataLayer key

## [2026-10-26 00:10] Chronicle and Harvard degree titles use the shared educationTitle

**Goal:** Follow-up agreed with the Chronicle/Harvard session: their templates landed before the shared
`educationTitle` helper existed and carried their own copies of the same de-dup rule. One rule, one place.
**Files:**
- edited: `lib/templates/chronicle.tsx`, `lib/templates/harvard.tsx` — `chronicleDegreeTitle` /
  `harvardDegreeTitle` are thin wrappers over `educationTitle(degree, field, " · ")` (exports kept; the PDF
  layouts call them unchanged). Same pattern as `gulfDegreeTitle` / `bannerEducationTitle`.
**Notes / risks / follow-up:** identical output by construction (same rule, same joiner); tsc, lint and the
smoke re-run on the merged tree.
**Suggested commit:** refactor(templates): Chronicle and Harvard degree titles via the shared educationTitle

## [2026-10-25 23:40] Templates 7/7: registry badges and copy honesty; CLAUDE.md notes the PDF primitives

**Goal:** Template audit 2026-10 defect 26 (medium) and the registry-copy findings. Onyx and Sandstone are
two-column sidebar templates but carried only "New", so their users got no "Design-led" ATS caveat;
Professional Photo is structurally identical to Professional (ATS-Friendly) but carried only "New";
Executive and Corporate shared one sentence and described a colour the accent control changes; Modern
promised "a refined accent section" it never renders; ATS Clean claimed an unmeasured "maximum ATS pass
rate"; Professional promised a "headline strip" that was never built. The ATS promise depends on these
signals being accurate.
**Files:**
- edited: `lib/templates/index.tsx` — Onyx and Sandstone: `[New, Design-led]`. Professional Photo:
  `[New, ATS-Friendly]`; the registry comment records the decision: the badge speaks to column structure,
  an in-flow photo does not change reading order, and ATS Clean / Gulf Standard / Banner already show one
  while keeping the badge. Descriptions: Modern ("Two-column layout: experience cards on the left,
  education and skill pills on the right."), Executive ("Left sidebar with stacked name, contact and
  skills; two-column. For senior profiles sent straight to a hiring manager."), Corporate ("Right-hand
  sidebar carries contact, visa and skills; the main column stays plain. Best emailed direct to a
  recruiter."), ATS Clean ("Single-column, text-first layout built for applicant tracking systems."),
  Professional ("Centered name, headline and contacts over full-width ruled sections. Conservative and
  recruiter-safe."). Modern's stale `modern.tsx:154` comment reference removed. ClassicThumb redrawn with
  the live left-aligned contact row and top-right photo slot; ModernThumb without the emerald band it
  never had (slate rule, bordered card, slate pills).
- edited: `CLAUDE.md` — a "PDF layouts share primitives" bullet under Checks: the primitives, the band
  pattern, the `BANDS` registration a new sidebar template needs, the three smoke passes, and "verify
  parity with pdf.js text extraction, not by eye".
**Notes / risks / follow-up:**
- Nothing in the app renders the registry `Thumbnail` field today (the gallery in ReviewStep uses live
  previews), so the thumbnail redraws are documentation of the design, not a visible change.
- Deferred, audit defect 13: Sandstone (and every template with a signature fallback accent) renders in
  the store's seeded #1e5b54 because a template switch writes only `templateId`; the beige identity exists
  only in the marketing PNG. Whether switching template should reset the accent to the template's
  signature is a product decision (it would recolour a CV the user already tuned) — founder call, not a
  primitive fix. Sandstone's description still says "Warm sidebar" pending that call.
- `npx tsc --noEmit` clean, `npm run lint` 11 warnings.
**Suggested commit:** fix(templates): registry badges and copy honesty; CLAUDE.md notes the PDF primitives

## [2026-10-25 23:30] PDF parity 6/7: density scales on the bleed sidebars, fixed bands, first-section margins, tracking cap

**Goal:** Template audit 2026-10 defects 19, 20 and 37 (medium/low) plus 39 (low) where it fell out of the
same code. The Page-margins slider skipped every sidebar PDF (the router scaled page padding only for a
"single-column" set; Exec Split ignored it in both renderers), the Section-spacing slider scaled per-entry
gaps and heading padding that the live templates keep fixed, the first section of Executive / Onyx /
Sandstone carried a full between-section margin so the two columns started misaligned, the Corporate
sidebar labels were Executive's, and — found while fixing — the Onyx / Sandstone / Corporate bands left the
same white notch at the top of page 2+ and the foot of page 1 that the Executive fix removed on 2026-10-24.
**Files:**
- edited: `components/pdf/CVDocument.tsx`
  - Router: page padding is `27/24pt × marginScale` for EVERY template; the `SINGLE_COLUMN` set is gone.
  - Executive / Corporate / Onyx / Sandstone: the band is a `fixed` absolutely positioned layer (0/0/0,
    edge to edge on every page) and the sidebar is a transparent column pulled over it with
    `-27×m / -24×m` margins, so the live inner padding (28/20px, 36/20px, 30/22px) holds at every margin
    level while the main column's padding (28px×m, 28px×m, 30px×m) and the page edges breathe. Corporate's
    band is now the live 220px (165pt) and its header rule takes `theme.accentText` (was hardcoded navy).
  - Exec Split: `m` scales the header bleed and padding (32px×m) and the body top margin (20px×m); column
    gap 28px and the right column 200px as live.
  - First-section rule through one `withTopGap(base, gap, firstKey)` factory: Executive main headings and
    sidebar labels, Onyx and Sandstone main headings (`PdfHeading`, 11px / 0.1em / 1.5px accent rule /
    18px×sp; `OnyxHeading` removed) zero the first present section as their live files do; Corporate passes
    `null` and keeps 18px×sp on every heading and label as its live file does.
  - Sidebar labels rebuilt from each live file: Executive 9px / mb 8px with the live name block (22px
    stacked name, 12px headline, 15%-ink rule 16px above and below); Corporate 9px at 50% ink; Onyx and
    Sandstone 9px / mb 7px with 18px×sp carried BELOW each section (the last one none). Unused
    `execSidebar`, `execName`, `execHeadline`, `execSideLabel` base styles removed.
  - `SECTION_GAP_KEYS` trimmed to `section` / `twoCol` / `atsSectionHeading` (defect 37); ATS Clean's
    per-entry gaps are fixed 12px / 10px.
  - Tracking cap (defect 39): `safeTracking()` caps letter-spacing at 8% of the size on `PdfHeading`, the
    sidebar labels, Modern's h2 (live 0.2em), Professional's centred headings and ATS Clean's headings.
    pdf.js read Exec Split's 0.12em headings as "E X P E R I E N C E", Modern's as "P R O F I L E",
    Professional's as "S U M M A RY" and the 0.1em labels as "C O N TAC T"; a text-layer ATS parser would
    miss those section names. The live headings keep their tracking — a visible but deliberate deviation
    in favour of a parseable download.
- edited: `lib/templates/exec-split.tsx` — `m = theme.marginScale` scales header/body horizontal padding
  and the body's vertical padding (the slider did nothing on this template).
- edited: `lib/templates/sandstone.tsx` — the two sidebar section gaps scale with Section spacing like
  Onyx's (they were the only unscaled 18px in the sidebar templates; the PDF scales them too).
- edited: `scripts/pdf-ops-check.mjs` — band check generalised: Executive 150 / Onyx 172 / Sandstone 180
  left, Corporate 165 right; every page must carry a full-height band flush with its edge, else FAIL.
- edited: `scripts/pdf-smoke.tsx` — third pass `<id>-airy.pdf` (page margins level 1, font / line /
  section spacing level 5) so the scaled padding, bands and gaps are exercised away from the 1.0 neutral.
**Notes / risks / follow-up:**
- Evidence: ops check `bandPages=N/N` for all 12 sidebar renders (default, -long, -airy); before this pass
  the Onyx / Sandstone / Corporate band rectangles measured 814.9pt on page 1 and 787.9pt on page 2 of
  841.9. Extraction: EXPERIENCE / SUMMARY / SKILLS / CONTACT / ABOUT ME / PERSONAL DETAILS / PROFILE read
  as words in every PDF; a scan for any four-letter spaced run finds nothing in the 36 files (it found
  Modern and Professional before the cap). classic-airy's text starts at x=17pt (24 × 0.7) against 24 at
  the default; onyx-airy's main heading at 188pt (172 + 22.5 × 0.7). Page counts dropped for the long
  renders (executive-long 3→2, onyx-long 3→2) because bullets no longer carry Classic's 3pt gap — the
  live sidebar templates have none.
- `npx tsc --noEmit` clean, `npm run lint` 11 warnings, `npm run smoke:pdf` 36/36 + ops check green.
- Not done here: the sidebar TEXT sizes of Onyx / Sandstone (7.8pt vs the live 7.5pt) and Executive's
  contact lines were left as tuned in October; only margins, labels, headings and bands changed.
- Defect 13 (Sandstone is never beige because the store seeds #1e5b54 and a template switch keeps the
  accent) is a store/UX decision, not a PDF primitive — deferred, see the registry entry.
**Suggested commit:** fix(pdf): density scales on bleed sidebars, fixed bands on every page, first-section margins

## [2026-10-25 22:50] PDF parity 5/7: Executive, Exec Split and Corporate main-column headings match live

**Goal:** Template audit 2026-10 defect 11 (medium, verified). The three layouts reused Classic's
`s.sectionHeading` (9.4pt bold title-case slate-800 over a slate-200 rule) while their live templates draw
small uppercase letter-spaced headings — in `theme.accentText` with an accent rule (Executive), in
`accentText` over a #CBD5E1 rule (Exec Split), in #1E293B over a #E2E8F0 rule (Corporate). With a custom
accent the preview showed coloured headings and the download showed slate.
**Files:**
- edited: `components/pdf/CVDocument.tsx` — new `PdfHeading` primitive (`HeadingVariant`: size, colour,
  letter-spacing, uppercase, optional rule colour/width, padding-bottom, margin-bottom, margin-top).
  Executive defines `mainHeading(key)` from `executive.tsx` RightHeading (10px, 0.08em, accent rule, mt 0
  for the first present section else 20px × sectionSpacing); Corporate from `MainHeading` (10px, #1E293B,
  #E2E8F0 rule, mt 18px × sp on every heading — the live file has no first-section exception); Exec Split
  one `heading` variant for both columns from `SectionHeading` (9.5px, 0.12em, #CBD5E1 rule, mt 16px × sp).
  The `s.section` wrappers in those layouts are gone: the heading now owns the gap, as live.
**Notes / risks / follow-up:**
- Evidence (pdf.js extraction): executive prints SUMMARY / EXPERIENCE / EDUCATION / PROJECTS, corp-sidebar
  SUMMARY / EXPERIENCE / EDUCATION / PROJECTS, exec-split EXPERIENCE / EDUCATION / PROJECTS and SUMMARY /
  SKILLS / LANGUAGES / CERTIFICATIONS, all uppercase; `s.sectionHeading` remains only in Classic (8 uses).
- `npx tsc --noEmit` clean, `npm run smoke:pdf` 24/24 + ops check green.
- Onyx / Sandstone headings and the sidebar labels of all four sidebar layouts move to the density pass
  (next entry) because their margins and the first-section rule are the defect there.
**Suggested commit:** fix(pdf): Executive, Exec Split and Corporate headings take the live uppercase ruled style

## [2026-10-25 22:35] PDF parity 4/7: project links restored in Onyx, Sandstone, Professional; nested runs print regular

**Goal:** Template audit 2026-10 defect 10 (medium, verified). The three 2026-10 layouts rendered only
`project.name` + bullets and silently dropped the link the preview shows, so a candidate's portfolio /
GitHub URL never reached the file they submit. While wiring the link run I found that a `<Text>` nested
inside the bold title inherits the parent's font in react-pdf, so Classic's and Professional's "| Company"
and "| School" runs (and the old project-link runs) were printing bold although the preview shows them
normal — fixed at the style level.
**Files:**
- edited: `components/pdf/CVDocument.tsx` — Onyx / Sandstone: `<Link src={normalizeHref(link)}>` with
  `shortenDisplayUrl(link)` in the accent (10px normal, after the name) when `shouldShowProjectLink`;
  Professional / Professional Photo: same in slate-500 at 10.5px. `entryCompany` now carries the regular
  face explicitly and `buildStyles` pins `fontWeight: 400` on every regular-face style, so a regular run
  inside a bold run stays regular with Helvetica and with the embedded Inter / Bricolage.
**Notes / risks / follow-up:**
- Evidence (pdf.js extraction): onyx / sandstone / professional / professional-photo print
  "Hisaab usehisaab.com" and "Long Link Stress Test github.com/abdullah"; classic's "| Interior360 General
  Trading LLC" and "| Virtual University of Pakistan" runs now use the regular font object (same object as
  body text), where before they shared the bold title's.
- `npx tsc --noEmit` clean, `npm run smoke:pdf` 24/24 + ops check green.
- The live Onyx / Sandstone / Professional project URL is a plain `<span>` (not an `<a>`); the PDF link is
  clickable. Left as is — the preview is not the deliverable.
**Suggested commit:** fix(pdf): project links in Onyx, Sandstone and Professional; nested runs print regular

## [2026-10-25 22:30] Templates: Chronicle and Harvard added (13th and 14th)

**Goal:** The remaining two candidates from the 2026-10 template audit
(`docs/template-audit-2026-10.md`, "Shortlist of templates to add", items 3 and 4), built to their
layoutSpec and buildNotes after Gulf Standard and Banner shipped on 2026-10-24. Chronicle is the
catalogue's first design-forward template that can honestly wear the ATS-Friendly badge (single column,
no photo dependency); Harvard captures the fresh-graduate / "just make it plain" search intent with an
education-first one-page serif format.
**Files:**
- created: `lib/templates/chronicle.tsx` — single-column reverse-chronological timeline. Header: name,
  headline in accent, contact row with ` | ` separators and real links, a quiet essentials row (full
  labels, plus the date of birth when set), optional 54pt photo top-right as an in-flow flex sibling
  (default off; gated on `personal.photo && showPhoto && theme.photoVisible`, round/square). Then
  Profile → Experience → Education → Projects (three-track rows: 90pt × fontScale date gutter with
  uppercase `MMM YYYY – MMM YYYY` right-aligned to the rail, 14pt rail track with a 1.25pt line and a
  6pt accent dot per entry, content flex 1) → Skills (text lines under bold sub-labels) → Languages →
  Certifications. The rail is drawn per entry and the last entry of a section ends it at the dot; the
  entry gap lives inside the content track so the rail stretches across it. Dot = `theme.accentText`,
  rail = that mixed 30 % toward white (opaque hex), so a pale preset still shows. Fallback accent
  `#0E7490`. Exports the track geometry constants and `chronicleContactItems` / `chronicleEssentials` /
  `chronicleDegreeTitle` / `chronicleRailColors` for the PDF twin.
- created: `lib/templates/harvard.tsx` — zero-colour serif single column. Centred header (serif Title
  Case name, `location | phone | email | linkedin` with real links, `Nationality: X | Visa: Y |
  Available: Z`), then CAREER OBJECTIVE (the summary) → EDUCATION (degree bold left / date right,
  school in serif italic, notes line, "Attested — body") → EXPERIENCE & INTERNSHIPS (organisation bold
  / location right, role italic / dates right, bullets) → PROJECTS → SKILLS & INTERESTS as
  label-prefixed lines (`Technical:`, `Skills:`, `Languages: Arabic (Native), English (C2)`,
  `Certifications: name (issuer, year)`). Headings 9pt uppercase serif over a 0.5pt black rule, 10pt
  / 1.35 body, 22/20pt page padding, no photo slot, accent ignored. Exports the text rules for the PDF.
- edited: `components/pdf/CVDocument.tsx` — `ChroniclePDFLayout` and `HarvardPDFLayout` mirroring the
  live renders section by section (px × 0.75, all four density scales, no alpha colours, own
  heading/experience/education blocks, sections as fragments so headings honour `minPresenceAhead`).
  Chronicle's rail is a per-entry `borderLeft` plus an absolutely positioned dot (a stub to the dot on
  the last entry); short entries carry `wrap={false}`. Harvard's serif is `PDF_FAMILY.serif` once
  registered, else the Times pair. Both ids in `SINGLE_COLUMN`; Harvard's page padding is 22/20pt ×
  marginScale via `HARVARD_PAGE_PADDING_PT`.
- edited: `lib/templates/index.tsx` — registry entries (Harvard after ATS Clean, Chronicle after Gulf
  Standard), both badged New + ATS-Friendly, hand-drawn thumbnails. `TemplateDefinition` gains
  `ignoresAccent` (Harvard) and `densityDefaults` (Harvard: font 2 / spacing 2), and a new
  `settingsForTemplate(settings, nextId)` helper applies a template's density defaults when the user
  switches to it with those controls still neutral and reverts them when switching away with the
  defaults still in place — a level the user set by hand is never touched.
- edited: `components/builder/steps/ReviewStep.tsx`, `components/builder/BuilderShell.tsx` — both
  template-change paths go through `settingsForTemplate`.
- edited: `components/builder/CustomizePanel.tsx` — the Colours group (and its divider) hide when the
  current template `ignoresAccent`, so Harvard shows no dead colour picker.
- edited: `lib/data/preview-profiles.ts` — personas `priyaChronicle` (Priya Nair, Engineering Manager —
  Payments, Indian, Dubai; four roles across India and the UAE, degree/field distinct) and
  `mariamHarvard` (Mariam Al-Suwaidi, 2026 UAEU Computer Engineering graduate; internship, TA term,
  capstone, GPA line; settings at the template's font 2 / spacing 2).
- edited: `app/preview/[templateId]/page.tsx` — `?density=1..5` sets all four density controls for
  review captures at the extremes (chrome-less route, noindexed; default unchanged).
- edited: `lib/pdf/fonts.ts` — `registerPdfFontsFromDir(dir)` (Node twin of `registerPdfFonts`, same
  three faces from local TTFs) and the shared `registerFrom` body.
- edited: `scripts/pdf-smoke.tsx` — ids added; registers the real faces from `public/fonts/pdf` so the
  smoke renders with Inter / Bricolage / Instrument Serif metrics instead of Helvetica; also renders
  `chronicle-persona.pdf` and `harvard-persona.pdf` from the preview personas.
- edited: `scripts/pdf-ops-check.mjs` — check 4: `harvard-persona.pdf` must be one page.
- edited: `scripts/capture-previews.js` — ids added.
- added: `artifacts/template-previews/{chronicle,harvard}-preview.png`.
- edited: `ROADMAP.md` (14 shipped), `CLAUDE.md` (template count).
**Notes / risks / follow-up:**
- Spec deviations, both deliberate: the Chronicle date gutter is 90pt (spec 72pt) because
  `SEP 2019 – PRESENT` at 7.5pt uppercase measures ~82pt at level 3 and ~89pt at level 5 — the spec's
  own density-5 test cannot pass in 72pt; and the heading letter-spacing is 0.6pt (spec 1pt) because at
  1pt pdf.js extracts `P R O F I L E`, which an ATS would not recognise as a section.
- Harvard's serif is Instrument Serif (weight 400 only, as the audit warned): hierarchy is size and
  caps, the italic sub-lines use the serif italic because Inter has no italic cut in either renderer,
  and the body stays in the user's face. No new font was added to `public/fonts/pdf`.
- `scripts/capture-previews.js` still cannot launch here (playwright-core 1.61.1 wants Chromium build
  1228; the cache holds 1234). The PNGs were captured with an equivalent script through the system
  Chrome channel (same 794×1123 @2x viewport and readiness waits); `npx playwright install chromium`
  restores the pipeline.
- Chronicle has no `-nophoto` capture because its persona carries no photo (the template's default);
  the site card therefore has no with/without toggle.
- Built in a worktree (`feat/templates-chronicle-harvard`) because the stagingmmc checkout was mid-edit
  by the audit-fix session; its `educationTitle` helper in `lib/utils/education.ts` can absorb
  `chronicleDegreeTitle` / `harvardDegreeTitle` once both land.
- DOCX export is template-agnostic and untouched (Chronicle's gutter collapses to the generic
  "dates — role" line, as the audit expected).
- Marketing site: `content/templates/{chronicle,harvard}.mdx` + `public/templates/*` on `staging`.
**Suggested commit:** feat(templates): add Chronicle and Harvard

## [2026-10-25 22:20] PDF parity 3/7: one chip primitive for skills and UAE essentials; ATS Clean keeps text

**Goal:** Template audit 2026-10 defect 9 (medium, verified). The preview drew skills and the UAE-essentials
strip as bordered pills (Exec Split, Corporate, Modern, Professional, Onyx, Sandstone, ATS Clean) while the
PDF flattened most of them to one joined text line, so the download did not look like what the user
approved. Decision per template: every design-led template gets real chips in the PDF; ATS Clean goes the
other way — the " · " text line the PDF has always printed is the ATS-safer form, so its preview now draws
the line too.
**Files:**
- edited: `components/pdf/CVDocument.tsx` — new `PdfChips` primitive (`ChipItem` = value with an optional
  leading label; `ChipVariant` = size, line-height, colour, fill, border, radius, padding, gap, label style).
  Used for: Exec Split header essentials (opaque `mix()` fill/border, radius 999) and right-column skill
  chips (accentText on #F1F5F9); Corporate sidebar skills (8% ink fill via `mix()`); Professional essentials
  ("Label:" in #6B7280 on #F3F4F6 pills, centred); Modern essentials and skill pills (same look as before,
  now through the primitive); Onyx and Sandstone skill pills (now at the live 10.5px / 1px / 2px 9px / gap 6px
  instead of the earlier 8pt / 0.5pt approximation). ATS Clean's skills line takes the live 1.55 line-height.
- edited: `lib/templates/ats-clean.tsx` — `renderSkillChips` → `renderSkillLine`: a " · "-separated
  paragraph (11.5px, #374151, lh 1.55) replaces the bordered chips, matching the PDF. Comment records why.
**Notes / risks / follow-up:**
- Evidence (pdf.js extraction): skill names and "Visa … Nationality …" present in exec-split, corp-sidebar,
  professional, onyx, sandstone and modern; ats-clean prints "JavaScript · PostgreSQL · …".
- No `rgba()` anywhere: all translucent-looking fills are pre-blended with `mix()`; the smoke source check
  and the operator check (no neon green) pass. `npx tsc --noEmit` clean, `npm run smoke:pdf` 24/24.
- The ATS Clean preview PNG in `artifacts/template-previews/` now shows chips the template no longer draws;
  recapture with the rest when the Playwright pipeline is back.
- Exec Split / Corporate / Modern essentials chips print the label without a colon ("Visa Employment visa"
  in extraction) exactly as the live chips do; Professional and ATS Clean keep "Visa:".
**Suggested commit:** fix(pdf): shared chip primitive for skills and UAE essentials; ATS Clean keeps the text line

## [2026-10-25 22:05] PDF parity 2/7: sidebar layouts print role + dates, then "Company · Location"

**Goal:** Template audit 2026-10 defect 7 (medium, verified). Executive, Exec Split, Corporate, Onyx and
Sandstone PDFs reused Classic's experience row — "Role | Company" inline with the location pushed to a
grey third line — while every one of those live templates draws role + dates on line 1 and
"Company · Location" (Exec Split / Onyx / Sandstone) or "Company | Location" (Executive / Corporate) on
line 2, with the company in the accent colour on Onyx and Sandstone. Visible on every role of every
download from those five templates.
**Files:**
- edited: `components/pdf/CVDocument.tsx` — new `ExperienceEntry` primitive driven by an
  `ExperienceVariant` (role / date / company / location styles, separator, company-line margin, bullet
  text + `<ul>` margin/padding, inter-role gap). `BulletList` accepts per-call `styles` overrides so each
  layout's bullets take the live size, line-height and colour (the marker takes the text colour, as a
  CSS disc does). The five sidebar layouts define their variant from their live file (px × 0.75) and
  render roles through the primitive; Classic and Professional keep the inline "Role | Company" form
  because their live templates draw it that way; ATS Clean and Modern already had their own rows.
**Notes / risks / follow-up:**
- Evidence (pdf.js text extraction): executive/corp-sidebar print "Interior360 General Trading LLC | Dubai",
  exec-split/onyx/sandstone "Interior360 General Trading LLC · Dubai", each on the line under the role;
  classic still prints "Odoo Administrator | Interior360 General Trading LLC".
- `npx tsc --noEmit` clean, `npm run smoke:pdf` 24/24 + ops check green.
- Seen in the same extraction and left for the heading pass: Corporate's sidebar labels extract as
  "C O N TAC T" (audit defect 39, letter-spacing).
**Suggested commit:** fix(pdf): sidebar layouts print role + dates over company · location

## [2026-10-25 21:50] PDF parity 1/7: education entry mirrors each live template, tick glyph dropped

**Goal:** Template audit 2026-10 defects 8, 21 and 36 (all medium). The shared PDF `EducationEntry`
printed "Degree · Field" bold, the school as grey subtext, notes, then a bare "Attested" even with no
attesting body — while every live template differs (Classic "Degree | School" + "Field | Notes", ATS
Clean "Degree in Field" with the attestation inline, Executive/Corporate a bordered pill, Onyx/Sandstone
an accent-coloured school with notes under the attestation). The "✓" (U+2713) in front of "Attested" has
no glyph in any embedded PDF face, so every download printed a notdef box; and "BSc Finance" + "Finance"
printed the field twice in both paths. The PDF is the file people submit, so the download must read like
the preview the user approved.
**Files:**
- edited: `lib/utils/education.ts` — new shared `distinctField` (field unless the degree already names it),
  `educationTitle(degree, field, joiner)` and `attestedLabel(body, uppercase?)` ("Attested — body" / "Attested",
  no glyph). Both renderers call the same three functions, so the words cannot drift again.
- edited: `components/pdf/CVDocument.tsx` — `EducationEntry` is now variant-driven (`EducationVariant`:
  joiner, school inline or on its own line, attestation as line / inline / pill, `attestedRequiresBody`,
  `notesAfterAttested`, per-entry gap, every style). Each of the eight layouts that used the shared block
  passes its own variant transcribed from its live file (px × 0.75). Modern's aside uses the same helpers.
  Added a `pt()` px→pt helper and `GREEN_700`; removed the Modern-only green constant.
- edited: `lib/templates/{classic,modern,executive,ats-clean,exec-split,corp-sidebar,onyx,sandstone,professional}.tsx`
  — education titles go through `educationTitle` (de-dup), attestation text through `attestedLabel`
  (tick removed; ATS Clean / Exec Split "(Attested)" → "Attested"; Corporate pill "✓ body" → "Attested — body").
  Nothing else in the live files changed.
- edited: `lib/templates/gulf-standard.tsx`, `lib/templates/banner.tsx` — their local degree de-dup
  helpers now delegate to `educationTitle`.
- edited: `scripts/pdf-smoke.tsx` — fixture gains a second education entry (degree "BSc Finance",
  field "Finance", attested with no body) so the smoke exercises both rules.
**Notes / risks / follow-up:**
- Evidence (pdf.js text extraction of `.smoke-pdfs/*.pdf`): "BSc Finance" prints once in all 12 templates;
  a bare "Attested" appears only in Executive ("ATTESTED"), ATS Clean, Exec Split and Corporate — exactly
  the four whose live templates print one; Classic/Modern/Onyx/Sandstone/Professional/Banner/Gulf print
  nothing without a body. No "✓" or notdef in any PDF.
- `npx tsc --noEmit` clean, `npm run lint` 11 warnings (cap), `npm run smoke:pdf` 24/24 + ops check green.
- The live preview PNGs in `artifacts/template-previews/` still show the tick; recapture when the
  Playwright pipeline is restored (`npx playwright install chromium`, see 2026-10-24 entry).
- Not changed: the DOCX exporter never printed the glyph; live ATS Clean languages use ", " where the PDF
  uses " · " (out of this pass's scope).
**Suggested commit:** fix(pdf): education entry mirrors each live template, drop the tick glyph


## [2026-10-24 22:30] Templates: Gulf Standard and Banner added (11th and 12th)

**Goal:** Founder ask 2026-10-24: review every template and add at least two popular ones. The audit
(`docs/template-audit-2026-10.md`) researched what UAE job seekers actually use through three lenses
and shortlisted four candidates; founder picked the two recommended ones. Built by two subagents in
parallel worktrees against the corrected PDF primitives (same-day fix PR), merged here.
**Files:**
- created: `lib/templates/gulf-standard.tsx` — the traditional UAE/Gulf expat CV: single column,
  passport-ratio photo top-right as an in-flow flex sibling (no reserved gutter when hidden), a
  labelled two-column PERSONAL DETAILS grid under the header (Nationality, Date of birth, Visa status,
  Availability, Driving licence, Languages — each row a flex row of bold label + value so extractors
  keep them together; collapses to one column with ≤2 rows), then Profile, Core Skills (text lines,
  no chips), Work Experience, Education (degree · field only when the degree text does not already
  contain it; "Attested — body" only with a body), Certifications, Projects. Accent only on headline,
  headings and rules; fallback accent navy `#1E3A5F`. Exports `gulfDetailRows` / `gulfDetailColumns`
  / `gulfDegreeTitle` so the PDF prints identical label/value pairs.
- created: `lib/templates/banner.tsx` — full-width accent header band (page 1 only) with a large
  square portrait and name / headline / contact row in onAccent ink, an essentials strip on
  `accentSoft` under it, then a single-column body: Profile, Work Experience, Skills, Languages,
  Certifications, Education, Projects. Band bleed is done with an unpadded `.cv-print` root and
  re-added body padding (robust against the print block's `padding: 0 !important`). Exports
  `bannerEssentials` / `bannerContactItems` / `bannerEducationTitle` for the PDF.
- edited: `components/pdf/CVDocument.tsx` — `GulfStandardPDFLayout` and `BannerPDFLayout` mirroring
  the live renders section by section (px × 0.75, all density scales, no alpha colours, own
  heading/experience/education blocks). Both in the `SINGLE_COLUMN` padding set. Sections are
  fragments with `minPresenceAhead` on headings because react-pdf ignores it on a first child, which
  orphaned a heading at a page foot in testing.
- edited: `lib/templates/index.tsx` — registry entries (Gulf Standard after ATS Clean, Banner after
  Sandstone), both badged New + ATS-Friendly (single column, in-flow photo, text-only chips), and
  hand-drawn thumbnails.
- edited: `lib/data/preview-profiles.ts` — personas `rashidGulf` (Rashida Khan, Senior Procurement
  Officer, Pakistani, Dubai; renamed from Rashid because the shared headshot is a woman) and
  `nadiaHospitality` (Nadia Haddad, Guest Relations Executive, Lebanese); registered with photo.
- edited: `scripts/capture-previews.js`, `scripts/pdf-smoke.tsx` — ids added (both photo-forward).
- added: `artifacts/template-previews/{gulf-standard,banner}[-nophoto]-preview.png`.
- edited: `ROADMAP.md` (12 shipped), `CLAUDE.md` (template count).
**Notes / risks / follow-up:**
- `scripts/capture-previews.js` cannot launch on this machine: playwright-core 1.61.1 wants
  `chromium_headless_shell-1228` and only build 1234 is in the cache. The PNGs were captured with an
  equivalent direct-Playwright script through the system Chrome channel (same viewport, scale and
  readiness waits). `npx playwright install chromium` restores the pipeline.
- Builder default `photoShape` is "round", so a user who picks Gulf Standard gets a circle until they
  choose Square; the passport frame that defines the template needs "square". Consider a per-template
  default photo shape (small store/registry change).
- DOCX export is template-agnostic and untouched: no band, no two-column details block. Gulf
  Standard's DOCX therefore prints the essentials the generic way.
- The line-based ATS extractor sees two label/value pairs per line in Gulf Standard's two-column
  details grid; each label is still immediately followed by its own value.
- Marketing site: pages + images land in makemycv-site (`content/templates/{gulf-standard,banner}.mdx`,
  `public/templates/*`, new `scripts/import-template-previews.mjs`), on `staging`.
**Suggested commit:** feat(templates): add Gulf Standard and Banner

## [2026-10-24 21:40] PDF export: six verified download defects fixed, operator-level smoke checks

**Goal:** The 2026-10-24 template audit (`docs/template-audit-2026-10.md`, 56 prioritised defects from
one reviewer per template + a skeptic pass + three market-research lenses) found six high-severity
defects that a skeptic could not refute, all in the downloaded PDF — the artefact the user actually
submits. Founder decision: fix these before adding the two new templates (Gulf Standard, Banner) so the
new layouts are written against corrected primitives.
**Files:**
- edited: `components/pdf/CVDocument.tsx` —
  - Alpha colours → opaque hex via `mix()` (react-pdf writes `rgba()` as 8-digit hex and pdfkit
    misparses it as solid neon green): Executive headline rule + photo ring, Exec Split essentials
    chip fill + photo ring, Corporate photo ring, Onyx and Sandstone band borders.
  - Executive: the navy band is a `fixed`, absolutely positioned layer behind the (now transparent)
    sidebar View, so page 2+ no longer starts with a 27pt white notch.
  - Corporate: sidebar contact + personal-details values use `theme.onAccentMuted` instead of the
    base style's hardcoded `#CBD5E1` (invisible on light accents such as Sand); labels one step
    quieter via `mix(onAccent, accent, 0.55)`.
  - Sandstone: PDF language names follow the sidebar ink (`SIDE_TEXT`) like the preview, not `#292524`.
  - Onyx + Sandstone: LinkedIn/website strings step down in size by length (>34 chars → 6.4pt,
    >44 → 5.8pt) like the email line already did, so they no longer run out of the band.
  - Modern: `ModernPDFLayout` rewritten (subagent, rebased, one commit) to mirror `modern.tsx` —
    two-column body (main flex 2: Profile > Experience > Languages > Certifications > Projects;
    150pt aside: Education > Skills), bordered experience cards, chips for skills and essentials,
    live type sizes ×0.75, all density scales. Verified by pdf.js text extraction (column x
    positions, heading order, no overlap). Deliberate deviations are listed in the commit message
    (fixed aside width, display face for the name, flexShrink on dates, cards may split across
    pages with an open box rather than clip).
- edited: `scripts/pdf-smoke.tsx` — renders every template twice (fixture, and the experience list
  tripled as `<id>-long.pdf` so each layout crosses a page break); refuses any `rgba(` in
  CVDocument.tsx.
- created: `scripts/pdf-ops-check.mjs` — inspects the operator list of every smoke PDF with pdf.js:
  fails on the neon-green colour signature and on an Executive band that is not a full-height
  150pt rectangle at the page edge on every page. Chained into `npm run smoke:pdf`.
- edited: `package.json` — `smoke:pdf` chains the operator check.
- created: `docs/template-audit-2026-10.md` — the full audit (scores, defects, themes, research,
  shortlist, recommendation).
**Notes / risks / follow-up:** The audit's 50 remaining medium/low defects are not addressed here;
the biggest cross-cutting ones are the shared PDF primitives (EducationEntry, the "Role | Company"
row, chips flattening to text, density scales on bleed pages) and badge/copy honesty in the registry.
The 1x1 placeholder photo in the smoke fixture prints "Incomplete or corrupt PNG" warnings — known
noise, not a failure. PDF output still cannot be eyeballed from here; the new checks are
operator-level, not pixel-level.
**Suggested commit:** fix(pdf): six verified download defects + operator-level smoke checks

## [2026-10-24 19:05] Review step: customize card reordered, headed "Your call"

**Goal:** Founder, 2026-10-24 (confirmed in chat before editing): the Review page's customize card
should run in the order a person decides things — picture, typeface, colour, then the fine-tuning
sliders — and the card heading should say something warmer than "Design & Font". Chosen heading:
"Your call".
**Files:**
- edited: `components/builder/CustomizePanel.tsx` — card heading "Design & Font" → "Your call"
  (subtitle unchanged); groups reordered to Photo → Font style → Colours → a "Design & Font"
  sub-label over the four sliders (page margins, font size, line height, section spacing). No control,
  label, aria-label or setting key changed; only order and the two headings.
**Notes / risks / follow-up:** Nothing else keys on the old heading text (grep: only docs/changelog
prose). Verified on a production build on the Review step at 1920x908.
**Suggested commit:** feat(review): customize card runs photo → font → colours → sliders under "Your call"

## [2026-10-24 18:45] Builder: CV preview owns the full right column (split shell)

**Goal:** Founder report 2026-10-24: on desktop the live preview wasted space on every side. A first
pass (de566a1, same day) only trimmed the old drawer's gutters — wrong reading. What the founder
wants: the CV owns the whole right-hand column, top of the window to the bottom and out to the right
edge, with the full page visible at once; the controls that were in the way move out of it
dynamically (hover slide-in), and the "Untitled CV · saved on this device" text goes so the score
chip and buttons have the room.
**Files:**
- edited: `components/builder/BuilderShell.tsx` —
  - Shell root gets `.cv-shell`; TopBar + progress strip + bars + MAIN AREA are wrapped in
    `.cv-shell-left`. Below xl the wrapper is `display: contents` (DOM-neutral, same flex column as
    before). At xl+ the shell becomes a row: left column (chrome + scrolling form, its own scrollbar
    now sits at its right edge) beside a full-height `PreviewColumn`.
  - `PreviewColumn` replaces `PreviewDrawer` + `DrawerPreviewBody`. Width is
    `clamp(460px, calc(100dvh * 0.7071), 48vw)` — A4's aspect from the viewport height — so one page
    fills it exactly with no gutter on any side; scale = `min(w / A4_W, h / A4_H)`; the sheet has
    `minHeight: A4_H` so short CVs still read as a page; longer CVs scroll inside the column with the
    scrollbar hidden (`scrollbar-width: none`) so the scale can never oscillate with a scrollbar.
  - Toolbar (template cycler + Fullscreen) is an absolute strip that slides down on `:hover` /
    `:focus-within`; reduced-motion disables the transition. The Fit width / Fit page toggle is gone —
    in an A4-shaped column both modes are the same scale.
  - TopBar: `cvName` prop and the "· saved on this device" label removed (the storage-full error pill
    stays); "Match to a job" / "All templates" labels are `.cv-top-btn-label` spans with `aria-label`
    on the controls, hidden by an `@container (max-width: 1040px)` rule on `.cv-shell-left` so the row
    still fits beside the preview at 1280px.
  - Form column at xl+: `max-width: var(--form-max)` only (no more drawer subtraction).
- edited: `components/preview/PreviewPanel.tsx` — `PreviewGhost` top 27% → 15% (from the first pass;
  still right: the sketch starts under the header stub).
**Notes / risks / follow-up:** `--drawer-w` / `--drawer-gap` in globals.css are now unused by the
builder (kept; harmless). Review step is unchanged (no preview column, left column spans the window).
Mobile/tablet (< xl) DOM and CSS are unchanged by construction. Verified on a production build at
1920x908 and 1280x720; `smoke:builder` not run. If the founder wants the preview wider than A4-shaped
(e.g. a true 50/50 with gutters) that is a one-line change to `--preview-col-w`.
**Suggested commit:** feat(builder): CV preview owns the full right column — A4-shaped split shell, hover toolbar, subtitle dropped

## [2026-10-24 18:10] Analytics: reset GTM data-layer parameters on every push

**Goal:** GTM container version 4 (published 2026-10-24) sends the feedback/engagement events to GA4
through one tag with Data Layer Variables for `stars`, `surface`, `consent`, `source`, `rail`,
`context`, `method`, `format`. The live check showed GTM keeps each key's last value across pushes:
a `tip_click` after a `share_click` reported `method=copy_link`. The transport now resets those keys.
**Files:**
- edited: `lib/analytics.ts` — `track()` pushes `{ event, ...PARAM_RESET, ...params }`; `PARAM_KEYS`
  lists the DLV keys (also `template`, used by the existing cv_export tag).
**Notes / risks / follow-up:** Same change in makemycv-site/lib/analytics.ts (the two helpers mirror
each other on purpose). When a new DLV is added in GTM, add its key to both lists.
**Suggested commit:** fix(analytics): reset data-layer parameter keys on every push

---

## [2026-10-24 16:30] Feedback routes: log the error behind every `server_error`

**Goal:** First production check of the feedback round: `/api/subscribe` answered 500 `server_error`
for every address while `/api/rating` and `/api/ratings/summary` worked. The catch blocks swallowed
the cause, so the Vercel runtime log was empty and Resend-vs-Supabase could not be told apart from
outside. Likely cause at the time of writing: the makemycv.ae domain was still "verifying" in
Resend, so the confirmation send is rejected.
**Files:**
- created: `lib/server/logRouteError.ts` — one `console.error` line: route + error message (max 300
  chars), never the request body, so no email address or quote text reaches the log.
- edited: `app/api/rating/route.ts` (POST + PATCH), `app/api/subscribe/route.ts`,
  `app/api/subscribe/confirm/route.ts`, `app/api/subscribe/unsubscribe/route.ts`,
  `app/api/ratings/summary/route.ts` — call it in the existing catch blocks; responses unchanged.
**Notes / risks / follow-up:** Response bodies stay flat (`server_error`, `expired`, EMPTY) so the
endpoints still leak nothing. After deploy, a failing sign-up shows in Vercel → Logs as
`[api/subscribe] Resend → 403 …` or `[api/subscribe] Supabase POST subscribers → …`. Supabase error
text comes from PostgREST and does not echo the inserted row. tsc 0, lint 11/11.
**Suggested commit:** fix(feedback): log the cause behind server_error in the feedback routes

---

## [2026-10-24 10:30] Feedback loop + consent: one-tap ratings, consented quotes, email opt-in, Consent Mode v2, tip/share tracking

**Goal:** Founder question after the audit: "are we taking any benefit from users who build a CV
and leave?" The answer was no — no rating, no testimonial path, no way to re-contact anyone, no
measurement of tips or shares, and GA4 ran with no consent layer while pinging Google's advertising
hosts. Decisions taken with the founder: one-tap stars (writing is optional), capture emails, store
in Supabase (EU) + send with Resend, region-aware consent banner.
**Files:**
- created: `lib/feedback/rating.ts`, `lib/feedback/subscribe.ts` (+ `feedback.test.ts`, 9 tests) — pure
  parsers and limits; `CONSENT_TEXT_VERSION` is stored with every sign-up.
- created: `lib/server/supabase.ts` (PostgREST over fetch, service key, server-only), `lib/server/email.ts`
  (Resend over fetch; `RESEND_API_URL` override exists only for the local mock), `lib/server/tokens.ts`
  (random tokens, SHA-256 at rest, constant-time compare), `lib/server/cors.ts` (allow-list for www),
  `lib/server/origins.ts`.
- created: `app/api/rating/route.ts` — POST one star → `{id, token}`; PATCH the optional line within 24 h,
  token spent after one use. Per-IP 3/min + 6/day in KV; no IP stored; country = Vercel header, 2 letters.
- created: `app/api/ratings/summary/route.ts` — count, average, human-approved quotes; edge-cached 1 h.
- created: `app/api/subscribe/route.ts` (+ `confirm/`, `unsubscribe/`) — double opt-in; same response for
  new / pending / already-confirmed so the endpoint cannot enumerate; confirm link valid 7 days; unsubscribe
  idempotent, GET and POST (RFC 8058 ready); both land on www/thanks with a message.
- created: `supabase/migrations/20261024_feedback.sql` — `ratings` + `subscribers`, RLS on with NO policies,
  anon revoked; `approved_at` is set by hand in the dashboard, never by code.
- created: `components/feedback/RatingStrip.tsx` — stars → thanks → "Add a line (optional)" with the
  "you may quote me" tick + optional first name/role → email field. Each block hides when its flag is off
  or it was answered (30 days for stars; for good once an address was sent). Mounted in
  `DownloadSupportCard` (after every export) and on the ATS report page.
- created: `lib/consent.ts`, `components/consent/{ConsentBanner,CookieSettingsLink,useClientValue}.tsx` —
  Consent Mode v2: inline default BEFORE GTM (EU/UK/CH denied, elsewhere granted, stored choice wins,
  ad_* always denied), banner with two voices (Accept/Decline vs OK/Opt out), `mmcv_consent` cookie on
  `.makemycv.ae` for a year, GA cookies expired on decline, "Cookie settings" reopens it. Byte-identical
  copies live in the site repo.
- created: `proxy.ts` — stamps `mmcv_geo=eu|row` (30 days) from the Vercel country header; only the bucket
  is stored.
- edited: `app/layout.tsx` (consent default + banner, both gated on GTM_ID), `components/builder/BuilderShell.tsx`
  (Cookie settings in the footer), `components/builder/DownloadSupportCard.tsx` (strip + `support_click`),
  `components/TipJar.tsx` (`tip_click` with rail + context), `components/builder/steps/ReviewStep.tsx` and
  `components/ShareScoreCard.tsx` (`share_click`, UTM-tagged links), `app/resume-checker/report/[reportId]/page.tsx`
  (strip), `.env.example` (SUPABASE_*, RESEND_*, origins, the two NEXT_PUBLIC switches).
**Notes / risks / follow-up:**
- NOTHING is live until Vercel has the env vars: the strip and the forms render only with
  `NEXT_PUBLIC_FEEDBACK=1` / `NEXT_PUBLIC_EMAIL_SIGNUP=1`, and the routes answer 503 without
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ `RESEND_API_KEY` for email). The Supabase org is on the
  free plan at its 2-project cap, so the project did not get created — founder to free a slot, upgrade, or
  name a host; then apply the migration file.
- GTM: every new event (`rating_submit`, `rating_quote`, `email_subscribe`, `tip_click`, `support_click`,
  `share_click`, `cover_letter_generate`, `cover_letter_export`) needs a Custom Event trigger + GA4 tag
  PUBLISHED in GTM-5H2LMVJT or it goes nowhere. For EU "Decline" to block GA4 entirely (not just cookieless
  pings), add a consent-based trigger exception on the GA4 tag. Turn Google Signals OFF in the GA4 property
  — the privacy policy now says advertising features are off, and the doubleclick/google.ae pings prove it
  is currently on.
- Verified locally against a mock PostgREST + Resend (`_cowork/audit-2026-10/scripts/mock-backend.mjs`,
  `feedback-e2e.mjs`): EU default denied + banner + decline → cookie + consent update + GA cookies cleared;
  ROW default granted; star → row with country, quote with consent and name, token spent; subscribe →
  email with confirm link → confirmed + unsubscribe token → unsubscribe; bad token → expired page; summary
  hides unapproved quotes; CORS allows www only. axe clean on the strip and the banner.
- The quote path is deliberately slow: nothing appears on www until `approved_at` is set by hand AND
  25+ ratings exist (`RatingsProof` on the site).
**Suggested commit:** feat(feedback): one-tap ratings with consented quotes, double opt-in email list,
Consent Mode v2 banner, tip/share/support tracking

---

## [2026-10-24 07:30] WP-9: cover letter v1 — `/cover-letter`, written from a disclosed CV excerpt

**Goal:** Product #2 in CLAUDE.md, planned since May and never built (audit WP-9, recommendation
accepted by the founder). A short UAE-style letter for the role the user is applying to, generated
from their own CV, with the same truthfulness contract as the bullet rewriter and a disclosure that
makes it the first — and only — feature to send CV text to a server.
**Files:**
- created: `lib/coverLetter/payload.ts` (+ `payload.test.ts`, 5 tests) — THE place that decides what
  leaves the browser: first name, headline, summary, latest non-blank role (title, company, period,
  ≤4 bullets ≤300 chars), ≤12 skill names, visa + availability. No contact details, photo, education,
  certifications or languages. Client builds it, server re-parses and re-clips it (`parseCoverLetterRequest`),
  and a CV with no role/summary/skills is rejected before any AI call.
- created: `app/api/cover-letter/route.ts` — Haiku 5.5, `CLAUDE_EFFORT`, per-IP 6/24h + 2/60s
  (`mmcv_cl_*`), 1 spend unit, retry-once, fence-tolerant JSON parse, `normalizePlaceholders` on the
  way out. System prompt: only facts from the excerpt, `{{number}}` where a figure would help, 3
  paragraphs, 150–230 words, no clichés, first name sign-off.
- created: `hooks/useCoverLetter.ts` — fetch + the shared RATE_LIMITED/OTHER error shape.
- created: `components/coverletter/CoverLetterPanel.tsx` — company / job title (required), hiring manager
  and job ad (optional, ad collapsed behind a button), the disclosure box listing exactly what will be
  sent (computed from the live excerpt), result with `PlaceholderText` highlighting, Edit toggle, Copy
  and Download .docx both disabled while a placeholder remains, empty-CV guide. Prefills the job title
  from `jdTarget` and, when arriving from JD Match, title + pasted ad via a tab-local
  `sessionStorage` seed (`stashCoverLetterSeed`). `track("cover_letter_generate" | "cover_letter_export")`
  with enum params only.
- created: `lib/coverLetter/docx.ts` — `exportCoverLetterDocx`: name + contact line + date + company +
  "Re: title" + paragraphs, assembled in the browser (contact details never went to the server).
- created: `app/cover-letter/page.tsx` — noindex, same shell as `/jd-match`.
- edited: `components/builder/steps/ReviewStep.tsx` — "Write a cover letter" next to "Tailor to a job".
- edited: `components/jdmatch/JdMatchPanel.tsx` — one-line peer nudge under the score ("Did you know?
  … Write it →") that seeds the cover letter page. The CV still never leaves JD Match.
- edited: `lib/server/spendGuard.ts` — comments count five AI routes.
- edited: `CLAUDE.md` — product #2 marked shipped, route map, privacy section names the excerpt and the
  three places to update if it widens; axe + PDF-font notes.
- edited: `ROADMAP.md` — 2026-10 shipped block extended (WP-6…WP-9).
- sibling repo: `makemycv-site/app/privacy/page.tsx` — AI-features paragraph names the cover letter
  writer and lists the excerpt (committed there).
**Notes / risks / follow-up:** End-to-end verified against `next start`: the request body carries only
the excerpt keys (no email/phone), a 145-word letter came back whose every figure (8 years, 18%,
3 warehouses, team of 12, zero HSE, 24 months) exists in the fixture CV, a `{{number}}` run blocked
copy/download until edited, and the .docx opened with name, company, "Re:" line and body. Not done in
v1: tone/length options, PDF export of the letter, LinkedIn message (product #3). The limiter is
deliberately tight (6/day) — raise it once real usage shows the spend. The `/cover-letter` page is
`noindex`; add it to the www navigation/product copy only after a few real letters have been read.
**Suggested commit:** feat(cover-letter): v1 — letter written from a disclosed CV excerpt with
{{number}} placeholders, copy/.docx export, Review + JD Match entry points

---

## [2026-10-24 06:10] WP-8: PDF export embeds the real typefaces, carries metadata, stops violating the CSP

**Goal:** Audit F08 / F28 / F29. Every PDF rendered in Helvetica regardless of the "Design & Font" choice
(Inter / Bricolage / Instrument Serif existed only on screen), the file had no Title/Author, and each
export logged a CSP violation because yoga-layout fetches its WebAssembly from a `data:` URL.
**Files:**
- created: `public/fonts/pdf/{inter,bricolage}-{400,700}.ttf`, `instrument-serif-400{,-italic}.ttf` —
  static instances cut from the app's own variable woff2 files with fontTools (every axis pinned:
  Bricolage `opsz` 14 = its text optical size; name records rewritten). `fontkit` cannot read woff2
  or variable fonts, so this is the only form @react-pdf can embed. ~48–66 KB each, loaded lazily on
  the first export only.
- created: `lib/pdf/fonts.ts` — `registerPdfFonts()` (browser-only, idempotent), `pdfFontPair()`
  (regular/bold family names or the Helvetica pair as fallback), `pdfFontsReady()`.
- edited: `components/pdf/CVDocument.tsx` — `buildStyles(theme, fonts)` and every layout take the font
  pair; the 34 inline `"Helvetica-Bold"` uses become `fonts.bold` + `fontWeight: 700`; `ProPdfHeading`
  and `OnyxHeading` take `fonts`; `<Document title author subject language>` set from the CV.
- edited: `hooks/useDownloadCV.ts` — registers the fonts before rendering.
- edited: `next.config.ts` — `data:` added to `connect-src` with a comment on why it widens nothing.
**Notes / risks / follow-up:** Verified with pdf.js over the exported files: `sans` embeds
`Inter-Regular`, `display` embeds `BricolageGrotesque-Regular`, `serif` embeds `InstrumentSerif-Regular`;
Title "First Last — CV", Author set; 0 CSP console messages; text extraction intact (ATS-safe).
Subsetting is on (react-pdf default) so file sizes stay ~10–13 KB. Route-scoped font loading (F29) was
NOT done: `--cv-font-*` tokens are defined on `:root`, so moving the faces off the root would restyle
the CV. If `app/fonts/*.woff2` ever change, regenerate the TTFs (fontTools + brotli; script in the
audit folder's history) — a mismatch is cosmetic, not breaking, because `pdfFontPair` falls back to
Helvetica when registration fails.
**Suggested commit:** feat(pdf): embed Inter/Bricolage/Instrument Serif, set document metadata, allow
yoga's data: fetch in the CSP

---

## [2026-10-24 05:40] WP-7: accessibility pass — labels, skip link, roving step beads, contrast, axe in the smoke

**Goal:** Audit findings F07, F09, F12, F13, F15 (`_cowork/audit-2026-10/06-REPORT.md`): the Headline
field had no accessible name, there was no skip link on a page whose top bar + 10 step beads precede
the form, every step bead was a tab stop, the faint text token failed AA, the photo "Change" button
was ~20px tall, and two CV templates put the candidate's name in an `<h1>` under the page's own
`<h1>`. Nothing enforced any of this, so the builder smoke now runs axe-core.
**Files:**
- edited: `components/forms/Field.tsx` — `htmlFor` prop so a label can point at a control when
  `children` is not a single element (Headline = input + chip).
- edited: `components/builder/steps/PersonalStep.tsx` — Headline input gets `id` + `htmlFor`.
- edited: `components/builder/BuilderShell.tsx` — "Skip to the form" link (`.ff-skip-link`, visible on
  focus) before the top bar; `<main id="builder-form" tabIndex={-1}>` as its target.
- edited: `components/builder/StepBeads.tsx` — roving tabindex: one tab stop, Arrow/Home/End move
  between beads.
- edited: `components/builder/PhotoUpload.tsx` — "Change" button meets the touch-target floor.
- edited: `lib/templates/classic.tsx`, `lib/templates/modern.tsx` — name heading is `aria-level={2}`
  (visual unchanged; the document outline no longer has two h1s). CV output otherwise untouched.
- edited: `app/globals.css` — `--ff-faint` #A6ADA4 → #656C63 (4.7:1 on the selected-card tint, 5.4:1 on
  white); `.ff-skip-link`; new `--brand-gold-text` (#B38A3C, 3.2:1) for the wordmark only.
- edited: `components/Logo.tsx` — wordmark 700 weight + `--brand-gold-text` for ".ae" (2.6:1 before).
  The logo mark and every gold fill keep `--brand-gold`. The site's Logo still uses 600/#C49A48;
  copy this change there when the site gets its own axe pass.
- edited: `components/builder/steps/ReviewStep.tsx` — `TemplateCard` rebuilt as a stretched-button
  card: the thumbnail (a scaled render of the real template, links included) is `inert` and no longer
  inside the clickable element; a transparent `<button aria-pressed>` covers the card and the preview
  button sits above it as a sibling. Fixes axe `nested-interactive` ×10.
- edited: `components/resume-checker/UploadDropzone.tsx` — helper text slate-500/400 → slate-600 on the
  tinted dropzone.
- edited: `scripts/builder-smoke.mjs` — axe-core pass (serious/critical fail the run) on the personal,
  experience and review steps, the checker upload and JD Match; `[inert]` excluded.
**Notes / risks / follow-up:** The CV templates' own `text-slate-400` dates are 2.6:1 — deliberately
left alone (ATS output unchanged) but worth a founder call: a slightly darker date colour in the
templates would pass and is invisible to ATS. `inert` needs React 19 (present). `npm run smoke:builder`
is all-PASS at 1440×900; mobile widths are not axe-scanned yet.
**Suggested commit:** fix(a11y): label Headline, skip link, roving step beads, AA contrast, un-nest
template cards; axe in the builder smoke

---

## [2026-10-24 04:10] WP-6 (app half): docs drift fixed, Sentry options, stray file

**Goal:** The audit (F11) found the roadmap still listed "merge stagingmmc → main" as blocking (PR #21
shipped it on 2026-10-09) and a `storeVersion` item that the migrator had already superseded; two
cowork notes outside the repo still said the site's production branch was `preview`.
**Files:**
- edited: `ROADMAP.md` — stale merge item removed; store item rewritten to what is actually missing
  (failure notice + migration fixture test); new "2026-10 — Audit fixes" shipped block; a post-deploy
  GA4 verification item added.
- edited: `next.config.ts` — Sentry's deprecated top-level options moved under `webpack`.
- deleted: `public/OG_IMAGE_NEEDED.txt` — the OG image it asked for has existed since 2026-08-02.
- outside this repo: `_cowork/memory.md` and `_cowork/PENDING-FEATURES.md` now open with a
  HISTORICAL banner pointing at ROADMAP / DECISION_LOG / the audit.
**Suggested commit:** chore: roadmap reflects shipped work; Sentry webpack options; drop stale OG note

---

## [2026-10-24 03:30] WP-2: builder ↔ checker round trip — UAE essentials parse, map to select options, survive import; checker takes DOCX; DOCX export prints the UAE line

**Goal:** Audit findings F17 and F24 (`_cowork/audit-2026-10/06-REPORT.md`). A CV built here and run
through its own checker was told it had "No availability or notice period" and "No UAE driving
licence" (its only two errors) because the templates print all four essentials on ONE line
("Visa: Employment visa · Available: 30 days notice · DL: Light Vehicle · Nationality: …") and the
parser only matched a label at line start. "Fix in Builder" then wrote that whole line into
`personal.visaStatus`, the UAE step's select showed nothing, and every template printed the garbage.
Separately, the checker rejected DOCX although the DOCX adapter had existed since June, and the
Word export omitted the UAE line entirely.
**Files:**
- created: `lib/data/uaeOptions.ts` (+ `uaeOptions.test.ts`, 15 tests) — the visa / availability /
  licence option lists and conservative normalisers ("1 month" → "30 days notice", "husband's
  sponsorship" → "Family sponsorship", "LMV" → "Light Vehicle"; a bare "Valid" licence or
  "Negotiable" notice maps to nothing — detect, never assert).
- edited: `lib/importers/textParser.ts` — `harvestUaeFields` splits compound lines on · • | before
  matching; label aliases for what the templates print (`Available`, `DL`, `Notice`, `Driving
  License`); values go through the normalisers; anything unmappable is returned as a leftover and
  surfaces in `unplaced` (the review screen's "We couldn't place this") instead of a field.
  The Claude checker path uses the same harvester for UAE fields, so the report benefits too.
- edited: `components/builder/steps/UAEEssentialsStep.tsx` — the three selects render from the
  shared option lists, so parser and UI can never disagree on vocabulary.
- edited: `components/import/MappingReview.tsx` — header now lists the UAE details that were read
  ("UAE details found: Visa: … · Available: …") or says none were found; the old "We can't read
  visa status…" line is gone.
- edited: `lib/importers/docxAdapter.ts` (exported `extractDocxTextInBrowser`),
  `components/resume-checker/UploadDropzone.tsx` — the checker accepts `.docx` (old `.doc` gets a
  "save as .docx" message); copy "PDF or DOCX · max 5MB"; `app/resume-checker/page.tsx` step +
  formats FAQ updated.
- edited: `lib/utils/docxExport.ts` — prints the same UAE essentials line as every template and
  the PDF, right under the contact line. The round-trip test found the Word export had never
  included it.
- created: `__fixtures__/builder-classic-export.txt` — pdf.js line reconstruction of a PDF the
  builder produced. `scripts/parser-fixtures.test.cjs` gains a round-trip block plus inline cases
  for spaced colons / pipes, unmappable values → unplaced, and common phrasings; the two
  `word-export-uae` assertions now expect option values instead of raw strings.
**Notes / risks / follow-up:**
- Verified on a prod build (Playwright, `pw/wp2-verify.mjs`, `pw/wp2-docx.mjs`): PDF import →
  store `{Employment visa, 30 days notice, Light Vehicle, Pakistani}` and the selects show them;
  DOCX export → checker report "ATS Essentials 100%", no false flags → Fix in Builder → same four
  values. `npm test` 191/191, lint at cap, `smoke:builder` green.
- A CV whose visa line we cannot map now shows that line under "We couldn't place this" and
  leaves the select empty — previously it printed the raw text on the CV. That is the intended
  trade: nothing unverifiable is asserted on a document that goes to an employer.
- Templates other than Classic print the chips in their own order/separators; all use
  `getEssentialChips`, so the labels are the same. The parser fixture covers the Classic/PDF form.
**Suggested commit:** fix(parser): read the builder's own UAE essentials line, map to select options, accept DOCX in the checker

---

## [2026-10-24 02:45] WP-4: AI suggestions can no longer invent figures — placeholders the user must fill

**Goal:** Audit finding F31 (`_cowork/audit-2026-10/06-REPORT.md`), reproduced in the UI: for a role
with two real bullets and no numbers, "Suggest bullets with AI" offered "cutting stock discrepancies
by 22%", "Directed operating budget of AED 4.5M, achieving 9% cost savings", "order accuracy from 91%
to 98%", "team retention by 30%" as one-tap inserts. The prompt literally said "use realistic
estimates if not provided". That contradicts every invariant the later features protect
(rewrite-bullet, evidence detection, the credential guard) and UAE application claims are checkable.
**Files:**
- created: `lib/ai/placeholders.ts` (+ `placeholders.test.ts`, 10 tests) — the `{{number}}`
  contract: detect / count / split / normalise ([X], {{ metric }} fold into the one token).
- created: `components/ai/PlaceholderText.tsx` — renders text with every unresolved placeholder
  highlighted, plus the one-line hint used everywhere.
- edited: `app/api/ai-improve/route.ts` — bullets/summary prompts rewritten to the rewrite-bullet
  contract (only facts from the input; write `{{number}}` where a figure belongs; never a real
  number that is not in the input). Skills prompt: name a product only if the experience names it,
  never suggest certifications. Results are normalised server-side.
- edited: `components/builder/steps/ExperienceStep.tsx` — `SuggestionBullet` opens in edit mode
  when a placeholder is present; Accept is disabled (and `acceptSuggestion` refuses) until every
  placeholder is replaced; a pencil lets the user edit any suggestion before accepting.
- edited: `components/AIResultsModal.tsx` — bullet cards with placeholders start in edit mode and
  "Apply Selected Bullets" is disabled while a selected card still has one; "Use This Summary" is
  disabled while the chosen variation has one; subtitles explain the rule.
- created: `scripts/ai-eval.mjs` — MANUAL eval (spends budget): posts figure-free roles and counts
  numeric literals the input did not contain.
**Notes / risks / follow-up:**
- Eval against this build: 3 runs (2 bullets, 1 summary; then the per-IP window), 11 generated
  items, **0 invented numeric literals, 12 placeholders emitted**. Before the change the same
  fixture produced four invented metrics in one call.
- UI verified with a mocked `/api/ai-improve` response (Playwright): placeholder suggestion → Accept
  disabled + hint; after replacing `{{number}}` with a real value → Accept enabled, bullet stored
  without any token; summary modal: "Use This Summary" disabled on a placeholder variation,
  enabled on a clean one.
- Company names from the input may still be echoed ("…at Example Logistics LLC") — that is input,
  not invention. Years of experience are now a placeholder unless the input states them.
**Suggested commit:** fix(ai): suggestions write {{number}} placeholders instead of inventing figures

---

## [2026-10-24 02:05] WP-3: the first click on Continue no longer vanishes; last keystrokes are no longer dropped; toasts replace instead of stacking; builder smoke script

**Goal:** Audit findings F01, F02, F03 (`_cowork/audit-2026-10/06-REPORT.md`). On the Summary
step a <30-word summary made the first click on "Continue →" do nothing: the length warning was
inserted on blur, 24 px of layout shift landed between mousedown and mouseup, and the click was
lost — reproducible 3/3, invisible to every existing test. The Experience step's role card folded
itself on blur (−219 px). "Section done ✓" toasts stacked four high over the skills chips.
**Files:**
- edited: `components/FieldError.tsx` — new `reserve` prop keeps the helper line's height when
  there is no message, so a blur-time message cannot move what is below it.
- edited: `components/builder/steps/SummaryStep.tsx` — the length warning now updates from the
  debounced `watch` while typing (and still on blur); `FieldError` is rendered with `reserve`.
- edited: `components/builder/steps/ExperienceStep.tsx`, `EducationStep.tsx` — entry cards no
  longer fold on blur (`complete`/`onAutoCollapse` removed from `ExpandRoleCard`). The Education
  one was caught by the new smoke script on its first run, not by the audit. Cards still fold via
  the header, "Add another", and when another card opens.
- edited: `lib/store/uiStore.ts` — `pushToast` replaces a visible action-less toast of the same
  tone instead of stacking, and caps the queue at two; action (Undo) toasts are never displaced.
- edited: all eight form steps (`PersonalStep`, `UAEEssentialsStep`, `SummaryStep`, `ExperienceStep`,
  `EducationStep`, `LanguagesStep`, `CertificationsStep`, `ProjectsStep`) — **the debounced
  form→store write is now flushed on unmount instead of cancelled.** The cleanup used to
  `clearTimeout` the pending 250 ms write, so pressing Continue / Enter / a step bead right after
  the last keystroke silently dropped that keystroke (the whole field, when autofill or paste set
  it in one go). The smoke script's first run lost "Personal Info", "Work Experience" and
  "Education" entirely this way. A `flushRef` holds the pending commit; cleanup runs it.
- created: `scripts/builder-smoke.mjs`; edited `package.json` (`smoke:builder`) and `CLAUDE.md`
  (checks list + the layout-on-blur rule). Drives the real builder against `next start`, clicks
  Continue ONCE per step with a field still focused, asserts the URL moved, asserts the Review
  step shows no amber box for a complete CV, and asserts a PDF downloads. Not a `test:*` script
  on purpose — `npm test` must stay runnable without a server.
**Notes / risks / follow-up:** `Field.tsx`'s own invalid-message line can still appear on blur
for required fields; that case already blocks submission with a visible red message, so it was
left alone — reserve a line there too if a swallowed click is ever reported on Personal.
**Suggested commit:** fix(builder): keep layout stable on blur so one click on Continue always works

---

## [2026-10-24 01:40] WP-5 (app half): Review step warns only about required sections; checker timing copy matches reality

**Goal:** Audit findings F05, F04, F18 (`_cowork/audit-2026-10/06-REPORT.md`). The Review step
showed an amber "MISSING SECTIONS" box listing Certifications and Projects on a CV scored
"Strong" — contradicting the house rule that only required things may warn — and still said
"All six export as real text" with ten templates. The checker promised "about 30 seconds" while
a one-page CV measured 38 s, so the "taking a moment" phase fired on every run.
**Files:**
- edited: `components/builder/steps/ReviewStep.tsx` — `incomplete` split into `missingRequired`
  (amber box, unchanged styling) and `optionalEmpty` (neutral "Optional — add if relevant:" chips
  that still jump to the step); template count now reads `templates.length`.
- edited: `app/resume-checker/page.tsx` — every "about 30 seconds" → "about a minute" (title,
  OG/Twitter descriptions, hero, example caption, final CTA). Formats FAQ untouched (WP-2 changes it).
- edited: `components/resume-checker/UploadDropzone.tsx` — phase timers 2.5/6/12 s → 4/14/45 s so
  "Still working…" only appears when a run is genuinely slow.
**Notes / risks / follow-up:** The site half (marketing claims, same-tab CTAs, timing copy) is in
`makemycv-site` on `staging`, same date. The parser round-trip fix that made the checker flag a
builder-made CV is WP-2, not this entry.
**Suggested commit:** fix(review): warn only about required sections; align checker timing copy

---

## [2026-10-24 01:10] WP-1: GA4 hits were blocked by the app CSP — fixed, and CSP violations now reach Sentry

**Goal:** The Oct-2026 audit (`_cowork/audit-2026-10/06-REPORT.md`, finding F23) found that
app.makemycv.ae has sent **zero** GA4 collect requests since GTM was added on 2026-08-10. The
CSP `connect-src` listed `https://*.analytics.google.com`, and a CSP wildcard never matches the
apex host — but GA4 posts to the apex `https://analytics.google.com/g/collect`, and with Google
signals also to `www.google.com` and `stats.g.doubleclick.net`. gtm.js and gtag.js loaded, so
Tag Assistant looked healthy while `cv_export`, `builder_start`, `builder_step` and the import
events never left the browser. This restores the north-star measurement.
**Files:**
- edited: `next.config.ts` — connect-src now lists the GA4 apex hosts and the Google-signals
  hosts alongside the regional wildcards, with a comment explaining the wildcard trap.
- edited: `instrumentation-client.ts` — `securitypolicyviolation` listener reports the first 3
  violations per page to Sentry (directive + blocked host only; no bodies, no CV content), so
  the next silent block is visible instead of invisible.
- edited: `app/layout.tsx`, `.env.example` — comments no longer claim the tag "works" once it
  loads; they point at the connect-src requirement and at GA4 Realtime as the only real check.
**Notes / risks / follow-up:**
- Verify after deploy from PRODUCTION: load /builder, confirm ≥1 `…/g/collect` request returns
  204/200 and the console shows no CSP violation; download a PDF and watch `cv_export` in GA4
  Realtime. Tag Assistant cannot see a refused POST.
- Verified locally: typecheck + lint green; a prod build serves the new header and a page-side
  `fetch` to analytics.google.com is no longer refused (audit script `pw/csp-check.mjs`).
- The GTM container still needs a Custom Event trigger + GA4 Event tag for each `track()` name
  (`cv_export`, `builder_start`, `builder_step`, `cv_import`, `cv_import_failed`) — that part
  lives in GTM, not in this repo, and could not be verified from code.
**Suggested commit:** fix(analytics): allow GA4 collection hosts in CSP and report CSP violations to Sentry

---

## [2026-10-10] Claude model: Haiku 4.5 → Haiku 5.5 on all four AI routes

**Goal:** Move the AI features (ai-improve, JD match, bullet rewrite, resume-checker parse)
to Claude Haiku 5.5 (`claude-haiku-5-5`, released 2026-10-07). List price is about 10x lower
than `claude-haiku-4-5-20251001` ($0.10/$0.50 vs $1/$5 per MTok, for prompts under 100K tokens).
**Files:**
- created: `lib/server/anthropic.ts`. It holds `CLAUDE_MODEL`, `CLAUDE_EFFORT` and
  `responseText()`, so the next model bump is a one-line change.
- created: `lib/server/anthropic.test.ts`, 5 tests.
- edited: `app/api/ai-improve/route.ts`, `app/api/jd-match/route.ts`,
  `app/api/jd-match/rewrite-bullet/route.ts` and `lib/resumeChecker/parse.ts`. Each one
  now uses the shared model ID, sends `output_config: { effort: "low" }`, reads text blocks
  by type and not `content[0]`, and doubles `max_tokens`
  (1024→2048, 1024→2048, 512→1024, 4096→8192).
- edited: the stale max_tokens comments in the routes and `lib/server/spendGuard.ts`, the
  `.env.example` comment, and the cost section of `docs/resume-checker-smoke-test.md`.
**Notes / risks / follow-up:**
- **Why it is not just an ID swap.** Haiku 5.5 thinks by default, so a response can start
  with a `thinking` block that has empty text. With the old `content[0].text` read, every
  route would have quietly dropped to its fallback: the heuristic parser, a "couldn't read"
  error, or an empty rewrite. Thinking tokens also count toward `max_tokens`, and the new
  tokenizer counts ~30% more tokens. That is why `max_tokens` was raised and effort set to `low`.
- `temperature`/`top_p`/`top_k` and assistant prefill now return a 400. None of the routes
  send them, so don't add them.
- A refusal (`stop_reason: "refusal"`) comes back as empty text. The existing "unparseable"
  paths handle it, and Haiku 5.5 has no server-side fallback.
- **Not live-tested from here.** Typecheck, lint (11/11) and `test:unit` (405/405) pass.
  Exercise all four features on the stagingmmc preview before merging to main. Watch Sentry
  and the parse `usedFallback` rate for a rise.
- The spend-guard units are unchanged. Real cost per unit drops roughly 5x, so
  `AI_DAILY_GLOBAL_CAP` could be raised once real usage numbers are in.
**Suggested commit:** feat(ai): migrate Claude routes to claude-haiku-5-5

---

## [2026-10-10] CLAUDE.md: changelog rule, commands, route map

**Goal:** Close gaps that made new Claude Code sessions rediscover things: the changelog rule
was not written down anywhere in CLAUDE.md, and nothing said how to run a single test file.
**Files:**
- edited: `CLAUDE.md`. It adds the standard header line and the COWORK_CHANGELOG rule under
  the branch workflow. A new "Sibling repo and route map" section names `../makemycv-site` as
  the design source of truth and lists the app's routes and APIs. The Checks section gains
  `dev`, `tsc --noEmit`, how to run one unit test file, how test suites are discovered, and
  what CI does.
**Notes / risks / follow-up:** Docs only. The header comment in `scripts/run-all-tests.mjs`
still says "failing fast", which contradicts its own no-fail-fast code below it.
**Suggested commit:** docs(claude): changelog rule, single-test command, route map

---

## [2026-09-18] Skills step: paste a list, get separate skills

**Goal:** Fix a real defect. The Skills search box strips commas and line breaks as you type
(`sanitizeSkillLive`), so pasting "Excel, SAP, Negotiation" from an old CV or LinkedIn added
ONE skill named "Excel SAP Negotiation", and it printed on the CV that way.

**Files:**
- created: `lib/skills/paste.ts`, which does the splitting and planning. Pure, with no network
  and no AI. It splits on `, ; | tab newline` and bullet glyphs, but never on `/` (CI/CD) or
  on commas inside parentheses, which become `/`. It strips bullets, numbering, `Label:`
  prefixes and "etc.". It keeps the user's wording and never rewrites an alias to our
  canonical name. Duplicates are caught by name and by bank alias ("SFDC" when "Salesforce"
  is held). **Licences are never added directly**: they come back for the existing "I hold
  it" guard. Lines over 50 chars or 6 words are reported as too long, not added. At most
  30 skills are added per paste, and the rest are listed.
- created: `lib/skills/paste.test.ts`, 19 tests, including negative tests for guard bypass
  and sentences.
- edited: `components/builder/steps/SkillsStep.tsx`. It adds an `onPaste` on the search box,
  and a single-term paste behaves as before. The whole batch is added in one write. A
  dismissible `role="status"` summary accounts for every piece: added, already listed,
  too long, over limit, and licences with a tap-to-confirm button each. The hint line now
  mentions pasting.

**Verified** against a production build in a browser. "Excel, SAP, Negotiation" became 3
skills. A single term was not intercepted. A messy CV paste (heading, bullets, duplicate
"excel", "Microsoft Office (Word, Excel)", CFA, a sentence, "etc.") added exactly 3, with
categories. It reported the duplicate and the skipped line, and held CFA back. Tapping CFA
opened the guard, and "I hold it" added it and removed the button. The live preview
updated. No render loop: 60fps while idle. tsc clean · lint 11/11 · tests green ·
`smoke:pdf` ok · build green.

**Notes / risks / follow-up:**
- Not checked visually at 375px. The summary is a wrapping block with no fixed widths.
- No analytics event for paste. Add `skills_paste {added, skipped}` later if the funnel
  shows Skills is where people drop.

**Suggested commit:** feat(skills): paste a list and get separate skills

---

## [2026-09-18] Mid-funnel analytics: builder_start, builder_step, cv_import, cv_import_failed

**Goal:** Prompt 3 of the 18 Sep handover. `cv_export` was the only event in the app, so
~1,500-2,000 visitors vs 10 exporters in 28 days had no visible drop-off point. These four
events give a start → step → export funnel and show whether CV import works.

**Files:**
- edited: `lib/analytics.ts` — new `trackOncePerSession(key, event, params)`: sessionStorage
  flag (survives reloads) + module-level Set (covers blocked storage and Strict Mode
  double effects). Keys are namespaced `mmcv_evt_*`.
- edited: `components/builder/BuilderShell.tsx` —
  `builder_step {step_number 1-10, step_id}`: effect on `stepId`, once per step per session
  (furthest-reached). Keyed on `stepId`, not `onStepChange`, because browser Back/Forward
  changes the URL step without calling `goToStep`.
  `builder_start` (no params): first `data` reference change after hydration, once per
  session. Opening the builder without editing does not count.
  `cv_import {file_type pdf|docx, merge_mode replace|merge, sections_filled 0-7}` in
  `handleImportConfirm`: confirmed imports only, not parses the user cancels.
  `cv_import_failed {file_type, error_reason corrupt-file|empty-text|unknown}` in the
  `handleImport` catch.
- edited: `components/builder/ImportFromReportBanner.tsx` — same two events for the
  ATS-report path, `file_type: "ats_report"`; failure reasons `report-expired` |
  `fetch-failed` | `no-cv-data` | `network`.
- edited: `lib/importers/fieldMapper.ts` — `countSectionsFilled()` extracted from
  `handleImportConfirm` so the toast and both import paths count sections the same way.

**Verified** against a production build (`next start`) in a real browser, reading
`window.dataLayer`: step 1 fires on mount; `builder_start` fires once after the first
keystroke and not on later keystrokes or after a reload; steps 2 and 3 fire once each;
Back ×2 / Forward fire nothing; reload on step 3 fires nothing; moving to step 4 after the
reload fires only step 4. Broken `.pdf` → `cv_import_failed {pdf, corrupt-file}`.
Generated text PDF → no event at the parse/review stage, then `cv_import {pdf, replace, 4}`
on confirm, which matches the "Imported 4 sections" toast. Unknown report ID →
`cv_import_failed {ats_report, report-expired}`. `tsc --noEmit` clean · lint 11/11
(unchanged) · 170 tests passed · `smoke:pdf` exit 0 · build green.

**Notes / risks / follow-up:**
- All four events are silent no-ops until GTM has matching Custom Event triggers and GA4
  Event tags **published**. Register the GA4 custom definitions first; GA4 does not backfill.
- Not verified: a successful ATS-report import (it needs a real report in KV) and the DOCX
  path. Both use the same `track()` calls as the verified paths.
- Switching template mutates `data.settings` and so counts as a `builder_start`.
- A deep link straight to `?step=review` records step 10 without steps 1-9. That is accurate
  but shows up as a gap in the funnel.
- `form_start` (GA4 enhanced measurement) fires once per step form (9 forms), so it is
  not a start count. Use `builder_start`.

**Suggested commit:** feat(analytics): mid-funnel builder and import events

---

## [2026-09-18] Post-export tip modal replaced by an inline support card

**Goal:** Prompt 2 of the 18 Sep handover. The handover asked for a new post-export
support card; Step 0 found one already shipped as `DownloadTipModal`, so the real work
was converting it from a full-screen modal to an inline card rather than adding a second
ask on the same trigger (which would have made three prompts off one export: success
toast + modal + card).

**Files:**
- created: `components/builder/DownloadSupportCard.tsx` — in-flow strip, `role="status"`,
  ff-accent tokens, one `SUPPORT_URL` text link, 48px dismiss target. No localStorage, no
  timers, no suppression; frequency is the parent's business.
- deleted: `components/DownloadTipModal.tsx` — `BuilderShell.tsx` was its only code
  consumer.
- edited: `components/builder/BuilderShell.tsx` — import swap; `downloadTipOpen` →
  `supportCardOpen`; `runDownload` re-arms the card at entry and opens it synchronously in
  the existing `kind !== "json"` success block; card mounted after the error bar; modal
  mount removed.
- edited: `components/TipJar.tsx` — comment at :85 referenced the deleted modal as a
  cross-surface size constraint; corrected, no code change.
- edited: `DECISION_LOG.md` — records the two reversals (no suppression; link to
  `/support` instead of Ko-fi/PayPal direct).

**Notes / risks / follow-up:**
- **`cv_export` is untouched.** Still fires once, after the await, non-JSON only,
  `BuilderShell.tsx` success block. Not moved, not duplicated.
- **The card now shows on EVERY successful export** — no 90-day window, no session flag.
  This reverses DECISION_LOG 2026-05-31 and the handover's own "once per browser, ever".
  Abdullah's explicit call on 2026-09-18. Watch for nag complaints.
- Verified: `npx tsc --noEmit` clean; `npm run lint` still **exactly 11 warnings, 0
  errors** (cap is 11, zero headroom); `npm run build` green; `npm test` 170 passed, 0
  failed; `npm run smoke:pdf` exit 0. The "Incomplete or corrupt PNG file" lines in the
  smoke output are **pre-existing** — 18 of them on a stashed clean baseline too — and the
  smoke script imports only `components/pdf/CVDocument` and `lib/types/cv`, neither of
  which this change touches.
- **Verified in a browser against the production build** (`next start`, not dev): card
  appears after export on both the TopBar and ReviewStep paths and on the "Export anyway"
  route; dismiss hides it; a second export brings it back; a JSON backup produces neither
  the card nor a `cv_export` event; `cv_export` fired exactly once per PDF export with
  `{format:"pdf", template:"classic"}`.
- **Card height measured, not estimated:** 59.3px at 320 / 360 / 375 / 414px, link visible
  at all four. The first draft opened with "Downloaded." and spilled to 3 lines (78.6px) at
  320 and 360px — both real Android widths — so the prefix was cut. The copy length is
  therefore load-bearing; re-measure before lengthening it. There is a comment in the
  component saying so.
- **Still unverified:** (a) the export-failure path — the card sits after the `await` inside
  the existing `try`, so a throw skips it exactly as it already skips `track()`, but I did
  not force a real failure; (b) a byte-level PDF comparison against pre-change output.
  Nothing in this change touches the PDF path (`smoke:pdf` imports only
  `components/pdf/CVDocument` and `lib/types/cv`), but the comparison is still worth doing.
- `docs/ux-audit-2026-06.md` still names `DownloadTipModal.tsx` in ENG-13 / ENG-18 / UI-1.
  Left as-is: it is a dated audit record, not live documentation.

**Suggested commit:** feat(builder): replace post-export tip modal with an inline support card

---

## [2026-08-20 10:30] Dead-weight removal + ROADMAP rebuilt from git history

**Goal:** close the four ROADMAP cleanup items, delete code and tokens with zero
consumers, and make ROADMAP.md true again — it was last updated 2026-04-19 while
100+ commits shipped, so its "must do next" was already done twice and its
backlog still listed JD Match, AI bullet improvement, a 5th template and
thumbnail generation as unstarted work. All four are shipped.

**Files:**
- deleted: `lib/resumeChecker/storage.ts` legacy KV adapter (~90 lines —
  `MaybeLegacy*` types, `upgradeScore`, `upgradeStored`, `gradeFromTotal`). It
  re-shaped pre-2026-06 reports on read; entries have a 24h TTL, so nothing it
  could upgrade has existed for ~2 months. `getReport`/`devGet` now return the
  stored value directly.
- edited: `lib/resumeChecker/types.ts` + `lib/scoreEngine.ts` — deprecated
  aliases `ScoreCategory.category/.label` and `ScoreReport.status/.issueCount`
  removed, along with the writes that fed them.
- edited: `app/resume-checker/report/[reportId]/page.tsx` (`cat.category` →
  `cat.id`) and `lib/scoreEngine.test.ts` (dropped the assertion that only
  checked the removed alias stayed in sync with `issueCounts`) — the two live
  consumers a first-pass grep missed; `tsc` caught both.
- edited: `app/globals.css` — ~20 zero-consumer tokens deleted: the retired
  `--sidebar-*` set, the `/* Legacy aliases */` block, the pre-emerald
  `--brand-blue` pair, unused surface/status/border/text aliases, and
  `--font-brand` (the wordmark has been live text since the reskin). Stale
  pre-reskin header comment rewritten.
- rewrote: `ROADMAP.md` — Shipped rebuilt from the commit log by month; new
  🗄️ Superseded section so decisions can't be silently reverted (the Pro-tier →
  tip-jar pivot in particular); governance rule 5 added for it.
- removed: empty `_to_delete/` directory; the `mmc-polish-wt` git worktree and
  its `tmp/builder-polish` branch (0 unique commits, fully merged, clean tree —
  262 MB reclaimed).

**Method:** every token in `:root` was checked against a repo-wide scan for
`var(--token)`, generated Tailwind utilities AND `[var(--token)]` arbitrary
values before deletion — the arbitrary-value form is easy to miss and would
have broken `--surface-overlay`, which is used that way and was kept.

**Notes / risks:** deliberately KEPT — dead members of live sets, because
deleting them would leave an incoherent system: `--radius-sm/-xl`,
`--shadow-sm/-md-soft/-lg-soft`, `--transition-slow`, the
`--severity-*-border` triple (one member live), and `--brand-cream` /
`--brand-gold-lt` (documented May-2026 brand palette, siblings live). The Pro/
coupon scaffolding is untouched per the standing rule. No dependency is unused
— all 16 runtime deps were checked.

**Verified:** tsc clean, lint at the 11-warning cap, 90/90 tests, `npm run
build` succeeds — the first production build since the font migration, which
also proves the self-hosted faces need no network at build time.

**Suggested commit:** `cedcec2` (cleanup) + `be6a0af` (roadmap) on `stagingmmc`.

---

## [2026-08-20 01:00] Premium design reskin — match the marketing site (Outfit, glass pills, floating paper)

**Goal:** the site shipped its premium reskin on 2026-08-19 (site commits
`df81f23`/`0c7689d`/`ddf5b0f`): Outfit as the single UI face, fully-rounded
pill CTAs with a 5-layer 3D-glass shadow, 5-layer "floating paper" card
shadows whose ring layer replaces 1px borders, retired mono labels, and a
glass-mark + live-text logo lockup. The app must read as the same brand.
Colors unchanged; CV output pixel-identical (verified — see below).

**The one thing future edits must not "simplify" away — the font decoupling:**
`FONT_FAMILY_MAP` in `lib/templates/theme.ts` used to point CV font picks at
`var(--font-body/display/serif)` — the SAME tokens the UI uses. Retargeting
the UI to Outfit would have silently restyled every user's on-screen CV while
the PDF stayed Helvetica. So the CV faces are frozen behind new
`--cv-font-body/display/serif` tokens (globals.css), theme.ts consumes only
those, and `.cv-print` (every template root) REMAPS `--font-body/display/serif`
back to the CV faces — because modern.tsx's name `<h1>` uses the Tailwind
`font-display` utility inside the CV, which would otherwise have leaked
Outfit into the product output. Never point `--cv-font-*` at a UI face, and
never remove the `.cv-print` remap block.

**Files:**
- created: `app/fonts/app.ts` + six woff2 files — ALL faces now self-hosted
  via next/font/local (Outfit new; Inter/Bricolage/Instrument/JetBrains moved
  off next/font/google, whose build-time gstatic URLs killed a site deploy on
  2026-08-11). Outfit + JetBrains copied byte-identical from the site repo.
- edited: `app/layout.tsx` — font loaders swapped to the local module; Outfit
  variable added to <html>.
- edited: `app/globals.css` — UI tokens → Outfit; `--cv-font-*` block;
  `.cv-print` token remap; `--shadow-cta(-hover)` replaced (green glow → 5-layer
  glass), `--shadow-float(-hover)` added (+ Tailwind exposure); all `.cv-btn-*`,
  `.cv-top-btn*`, `.cv-score-chip` fully rounded (glass on primaries, float on
  secondaries; hover = lift + brightness, no bg-darken); `.cv-step-card` /
  `.cv-entry-card` / `.tip-card` drop borders for `--shadow-float` (entry card
  lifts on hover); `.cv-tip-box` becomes a flat inset; `--radius-card` 14→16px;
  `.logo-mark-3d` glass tile rules.
- edited: `lib/templates/theme.ts` — FONT_FAMILY_MAP → `--cv-font-*` (the ONLY
  template-layer edit, exists to keep output identical).
- edited: `components/Logo.tsx` — `horizontal` variant is now a live lockup
  (glass mark tile + Outfit wordmark, navy/gold); collapses to mark-only under
  480px; `white`/`stacked`/`mark` SVG variants untouched.
- edited: 21 builder/jdmatch/checker component files — 33 mono eyebrow/label
  sites moved to the UI face (mono kept ONLY on counters/numeric readouts:
  char/word counts, step counters, "n of m", scores, hex input, report id);
  jd-match + resume-checker line-border cards → float; small icon buttons and
  ad-hoc CTAs → fully rounded; report headline got the single allowed gradient
  accent word.

**Verified:** tsc clean, lint at the 11-warning cap, 90/90 tests, smoke:pdf
renders all 10 templates. In-browser: `/preview/classic` renders Inter and
`/preview/modern`'s `font-display` h1 renders **Bricolage** (decoupling proven);
UI computed styles show Outfit, glass + float shadows with the exact site
layer values, ring `rgb(230,228,221)`, accent `#0e7c4a`, paper
`rgb(251,250,247)`; zero elements carry border + float simultaneously; no
horizontal overflow at 375px.

**Notes / risks:** PDF/DOCX/print pipeline untouched (Helvetica, off-limits
list respected). `--font-brand` (Poppins stack) is now dead weight for the
horizontal logo but still referenced nowhere critical — left as-is. FAQ
`<details>` cards on /resume-checker keep their border (it carries the open
state). Founder's 2026-07 "hover must be unmistakable" rule preserved on the
top bar via accent ring + lift.

**Suggested commit:** shipped as five commits, `0d31f21`…`386a483` on
`stagingmmc` (fonts / tokens+buttons / cards+labels / logo+sweep / mobile fix).

---

## [2026-08-18 01:30] Wire the score delta pill (was built, never connected)

**Goal:** competitor teardown found dubaicv.app frames its ATS score as a
before/after ("up from 41%") while we show a static "77 · Strong". A delta reads
as proof the product did something; a bare number does not.

**Finding that changed the shape of the work:** the delta pill **already exists**
in `ScoreChip.tsx` — green/red tinting, `+N` formatting, the lot. It was simply
never passed a value (`<ScoreChip report={scoreReport} />`, no `delta`). This was
wiring, not a build.

**Files:**
- edited: `lib/store/cvStore.ts` — new `scoreBaseline: ScoreBaseline | null`
  (persisted to `makemycv:scoreBaseline`, hydrated on load, cleared by `reset()`)
  and a new `captureScoreBaseline()` action.
- edited: `components/builder/BuilderShell.tsx` — computes `scoreDelta`, threads
  it through `TopBar` (new optional prop) into `ScoreChip`; calls
  `captureScoreBaseline()` after a file import.
- edited: `components/builder/ImportFromReportBanner.tsx` — calls
  `captureScoreBaseline()` after the Checker-report import.
- edited: `components/builder/ScoreChip.tsx` — `title` on the pill and the delta
  folded into the button's `aria-label`, so "+36" is not a mystery number to
  either sighted or screen-reader users.

**Two traps found and avoided — read before changing this:**

1. **Ordering.** `ImportFromReportBanner` calls `importCvVersion()` and THEN
   `setParseSignals()`. Capturing the baseline inside `importCvVersion` (the
   obvious place) would score the "before" WITHOUT the signals the live score is
   scored WITH. The delta would then be measuring our own scoring inputs
   arriving, not the user improving anything. Hence `captureScoreBaseline()` is
   a separate action called LAST, at both call sites.
2. **Scope.** `<ScoreChip>` lives inside the `TopBar` sub-component, ~740 lines
   above where `scoreDelta` is computed. Declaring the const in `BuilderShell`
   alone leaves `scoreDelta` undefined inside `TopBar` — a build-breaking
   `Cannot find name` on Vercel. It is passed as an explicit prop.

**Honesty guardrail:** a baseline is set **only by an import**. A CV typed from
scratch has none, so no pill is shown. "You went from 0 to 77" is not an
improvement, it is just the user existing — and claiming it would be the same
unsourced-uplift move the competitor teardown criticises dubaicv.app for
("87% vs 45% without AI"). Negative deltas are shown, in red: the component was
built for both directions and hiding a regression would be the dishonest half.

**Notes / risks / follow-up:**
- Full `tsc --noEmit` could not be completed over the device mount (>5 min, killed).
  Types were verified by inspection instead: `ScoreGrade` is exported from
  `lib/resumeChecker/types`, `ScoreReport` carries `.total` and `.grade`, no
  import cycle (`scoreEngine` imports only types + `data/genericPhrases`).
  **Run `npm run typecheck`/`build` locally before pushing.**
- Existing users mid-CV get no pill until their next import — there is no
  retroactive baseline, by design.

**Suggested commit:** feat(builder): show CV score as a delta from the imported baseline

---

## [2026-08-17 22:20] Instrument cv_export — the north-star metric

**Goal:** the 10 Aug GA4 audit found seven event types, all Google automatics, and zero product
events. `app.makemycv.ae` has been tagged since this morning's `stagingmmc` → `main` push, so it now
records pageviews — but nothing about whether anyone finishes a CV. This adds the one event the
product is actually judged on.

**Files:**
- created: `lib/analytics.ts` — `track()`, a dataLayer push. Deliberately mirrors
  `makemycv-site/lib/analytics.ts`: both surfaces share ONE container (GTM-5H2LMVJT) and ONE GA4
  stream, so an event name must mean the same thing on both.
- edited: `components/builder/BuilderShell.tsx` — import + one `track("cv_export", …)` call.

**Why in BuilderShell and nowhere else.** `runDownload()` is the single export gate for the whole
builder — TopBar, ReviewStep and the template preview modal all route through it (ReviewStep's
`fallbackExport` only exists for a mount outside the shell). The call sits **after** the `await` and
inside the success path, so it counts exports that produced a file, not clicks and not attempts that
threw.

**Two deliberate omissions, both to keep the number honest:**
- **`json` excluded.** A backup is housekeeping, not a finished CV. The code already draws that line
  three lines below, where the tip jar is suppressed for `json`. Counting backups would inflate the
  one metric that matters.
- **No `plan` parameter.** Every call site passes `"pro"` — it would be a constant dressed up as a
  dimension. Add it when a real free/pro split exists.

Parameters sent: `format` (`pdf` | `docx`) and `template`.

**🔴 THIS IS HALF A PIPELINE — it records nothing until GTM is configured.**
A `dataLayer.push` with no matching trigger goes nowhere: the code is right, the build passes, and GA4
stays empty. Still required in container **GTM-5H2LMVJT**:
1. Custom Event trigger, event name exactly `cv_export`
2. GA4 Event tag → measurement ID `G-8MWPD87FJH`, event name `cv_export`, firing on that trigger
3. Data Layer Variables for `format` and `template`, mapped as event parameters
4. **Publish the container** — an unpublished change ships nothing
5. GA4 Admin → Custom definitions: register `format` and `template` as event-scoped dimensions, and
   mark `cv_export` a key event. Parameters do not appear in reports until registered.
The container currently holds exactly one tag (`GA4 - Config`, Google Tag, Initialization – All
Pages), audited 13 Aug — so none of the above exists yet.

**Notes / risks / follow-up:**
- **Not committed** — needs `git add` / `commit` / `push`. Production branch is `main`; dev is `stagingmmc`.
- Zero product risk: `track()` no-ops on SSR and when the container is absent, and never throws.
- The site's ~21 `[data-event]` CTA pushes are in the same position — pushing correctly into a
  container with nothing listening. Worth fixing in the same GTM session.
- **Stale docs corrected while here:** `PENDING-FEATURES.md` line 34 and the project log both say the
  JD Match entry link from the builder is outstanding. It is not — there are **two** live entry
  points, `BuilderShell.tsx:300` and `ReviewStep.tsx:488` ("Tailor to a job"), and `app/jd-match`
  exists, so neither link 404s.

**Suggested commit:** feat(analytics): fire cv_export on successful PDF/DOCX export

---

## [2026-08-10 18:40] Tag app.makemycv.ae with the marketing site's GTM container

**Goal:** §2 of the 10 Aug GA4 analytics brief. `app.makemycv.ae` appeared in **zero** hostname
rows across 28 days of GA4 data — the actual product, the CV builder itself, was entirely
unmeasured while the marketing site was fully tagged. Not one CV export could be attributed to
the traffic that produced it. Serves **trustworthy metrics before monetisation**. This is the
piece the 2026-08-02 analytics note in `app/layout.tsx` called "the GA4 cross-domain config,
which lands separately".

**Files:**
- edited: `app/layout.tsx` — loads GTM via `next/script` (`lazyOnload`), gated on
  `NEXT_PUBLIC_GTM_ID`, renders nothing when absent. Container id is format-guarded with
  `/^GTM-[A-Z0-9]+$/` because it is interpolated into an inline `<script>`. The 2026-08-02
  comment about cross-domain config being pending was updated rather than left stale.
- edited: `next.config.ts` — **CSP change, approved in-session by Abdullah before editing.**
  `script-src` += `https://www.googletagmanager.com`; `connect-src` +=
  `https://www.google-analytics.com https://*.google-analytics.com
  https://*.analytics.google.com`. Nothing else in the header set was touched.
- edited: `.env.example` — documents `NEXT_PUBLIC_GTM_ID` with an **empty** value.

**One container, one stream — deliberately.** `app.makemycv.ae` and `www.makemycv.ae` share the
root domain `makemycv.ae`, so gtag sets the `_ga` cookie on `.makemycv.ae` and sessions stitch
across the www → app hop automatically. A second GA4 property or data stream would split that
into two sessions and turn the handoff into a self-referral. Cross-domain linking is for
different *root* domains and is not needed here. **Do not create a second property or stream.**

**The brief did not account for this app's CSP, and §2 would have failed silently without the
change.** The app ships a strict `Content-Security-Policy` that allowed neither
`googletagmanager.com` nor the GA4 collection endpoints; the browser would have blocked the tag
with no error visible in GA4. The `*.google-analytics.com` / `*.analytics.google.com` wildcards
are not cosmetic — GA4 routes collection through regional endpoints
(`region1.google-analytics.com` and similar), so allowing only the bare `www` host drops hits
for some users and not others, which is the worst failure mode because the data still looks
present.

**Notes / risks / follow-up:**
- **Abdullah must set `NEXT_PUBLIC_GTM_ID = GTM-5H2LMVJT` in this project's Vercel env vars,
  scoped to Production ONLY.** Same container id as `makemycv-site`. Until then this host stays
  unmeasured — exactly as it is today, so no regression, but also no fix.
- No GTM `<noscript>` iframe here, unlike the marketing site. This is a client-rendered CV
  builder that does nothing without JavaScript, so a noscript pixel would only count users who
  cannot use the product — and it would have needed a `frame-src` CSP exemption to load.
- Verified the CSP **survives the `withSentryConfig` wrap** (the standing gotcha in this repo):
  read back from the built `routes-manifest.json`, both new entries present, and all seven
  other security headers — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy, X-DNS-Prefetch-Control, X-XSS-Protection — still intact.
- `npm run build` and `npx tsc --noEmit` both pass. Build output confirmed to carry
  `GTM-5H2LMVJT` when the env var is set.
- `package-lock.json` shows as modified in `git status`. **This is not from this session** — the
  diff is empty; it is purely a CRLF line-ending artifact. Left untouched.
- Acceptance check once deployed: visit `app.makemycv.ae` and confirm the hostname appears in
  GA4 Realtime; then navigate `www.makemycv.ae → app.makemycv.ae` in one session and confirm
  GA4 shows **one** session with source/medium preserved, not `makemycv.ae / referral`.
- §4 (product event instrumentation — `cv_export`, `cv_start`, `template_select` et al.) was
  deferred by agreement and is **not** in this change. This commit adds the transport only;
  nothing product-specific is measured yet.

**Suggested commit:** `chore(analytics): tag app subdomain with shared GTM container`

---

## [2026-08-03 12:01] Project orientation + changelog setup

**Goal:** First Cowork run with write access to this repo. Establish the accountability trail
before any code is touched, and reconcile the project log against what the app actually
contains. Serves **maintainability** — every future Cowork change lands with a reviewable
record, and several repo docs currently describe features as pending that in fact shipped.

**Files:**
- created: `COWORK_CHANGELOG.md` — this file. The per-repo change record required by the Cowork
  project instructions.

**No other file in this repo was created, edited or deleted on this run.** Recon was read-only
(`device_list_dir` / `device_stage_files` → `Read`, plus read-only `git log` / `git status` /
`git branch`). `.env.local` was deliberately **not read** — only `.env.example` key names.
Related non-repo writes this run: `_cowork/makemycv-project-log.md` was merged (additive only)
and `makemycv-site/COWORK_CHANGELOG.md` was created.

**Notes / risks / follow-up:**

*Branch state:*
- Current branch is **`stagingmmc`**. Tip is `c260ae9` (2026-08-02, the CI workflow).
- Remotes: `origin/main`, `origin/stagingmmc`. Standing rule from project memory: **commit to
  `stagingmmc` only — Abdullah merges to `main`.**
- Working tree shows 212 modified tracked files, but `git diff --stat` is exactly symmetric
  (49,068 insertions / 49,068 deletions) — **pure CRLF/LF churn from the device mount, not real
  drift.** Write LF when editing so diffs stay readable. Only genuinely new path is the untracked
  `artifacts/` directory (output of `scripts/capture-previews.js`).

*Repo docs that are wrong right now — do not plan work from them:*
- 🔴 **`ROADMAP.md` (last updated 2026-04-19) still lists JD Match as "v2, requires auth system as
  a prerequisite" and DOCX export as pending. Both shipped.** JD Match Phase A *and* Phase B are
  live (`docs/jd-match-spec.md` marks Phase B shipped 2026-06-13); DOCX export ships via
  `lib/utils/docxExport.ts`. It also lists a "5th template" (there are 10) and AI bullet
  improvement (shipped) as backlog.
- `ARCH-RECON-makemycv-app.md` — claims "error tracking: none", `@vercel/analytics` /
  `@vercel/speed-insights` not installed, no `.github/workflows/`, and no test runner. All four
  are now false (Sentry shipped `f0b52ab`; both Vercel packages are installed and render in
  `layout.tsx`; CI exists; 18 lib suites + a parser suite + a PDF smoke test exist). It also lists
  `/export` and `/templates` routes that no longer exist.
- `AUDIT_APP.md` already carries a "HISTORICAL — DO NOT TREAT AS CURRENT STATE" banner. Good.
- `audit-report.md` (form-field audit, 2026-04-26) recommended 5 new fields. `visaStatus` and
  `availability` were added; `fullNameArabic`, `noticePeriod`, `openTo`, `boardRoles[]`, `awards[]`
  and `experience[].scopeMetrics` were not. `emiratesId` was **not** added — worth noting, because
  the marketing site's FAQ advertises an Emirates ID field that does not exist in this product.
- `README.md` is still untouched `create-next-app` boilerplate (it even names the wrong fonts).

*Code-level loose ends found during recon (reported, not fixed):*
- `lib/server/couponRedemptions.ts` is referenced in `DECISION_LOG.md` (2026-06-12) as retained,
  but **does not exist on disk** — `lib/server/` holds only `rateLimit.ts` and `spendGuard.ts`.
- Contradictory comments in `lib/store/cvStore.ts`: the `KEEP — DO NOT REMOVE` block (lines
  ~196–247) sits directly above `TODO: Remove applyCoupon/clearCoupon in next release` (~line 260).
  Project memory is unambiguous that **KEEP wins** — the TODO is the stale one.
- `scripts/pdf-smoke.tsx` documents `npm run test:pdf-smoke`; the real script key is `smoke:pdf`.
  Because `scripts/run-all-tests.mjs` filters on `test:*`, `npm test` runs exactly two suites
  (`test:unit`, `test:parser`) — the PDF smoke test is **not** in `npm test`. CI runs it as a
  separate non-blocking job.
- `lib/utils/docxExport.ts` does not use the consolidated `triggerBlobDownload` / `buildCvFilename`
  / `sanitizeFilenamePart` helpers that `lib/utils/download.ts` exists to provide — it keeps its own
  un-appended-anchor and unsanitised-filename copy.
- The `.gitignore` entry intended to cover `.claude/` is corrupted (UTF-16 fragment with spaces
  between characters, matching nothing) — recorded in `eslint.config.mjs` as audit `A-W5-053`.

*Ground truth captured for future runs:*
- Next.js **16.1.6**, React 19.2.3, Tailwind v4, Zustand ^5, Zod ^3.
- Routes: `/` (redirect → `/builder`) · `/builder` · `/jd-match` · `/resume-checker` ·
  `/resume-checker/report/[reportId]` · `/preview/[templateId]`. Root layout sets
  `robots: { index: false, follow: false }` for the whole host; `app/sitemap.ts` returns `[]`
  deliberately.
- 8 API routes: `/api/ai-improve`, `/api/jd-match`, `/api/jd-match/rewrite-bullet`,
  `/api/resume-checker/parse`, `/api/resume-checker/report/[id]`,
  `/api/resume-checker/import/[id]`, `/api/coupons/apply`, `/api/health`.
  **No auth endpoints. No payment integration** (no Stripe/Tap/Paddle/Lemon Squeezy anywhere).
- **PDF export is a real file download** via `@react-pdf/renderer`, client-side. There is **no
  `window.print()` anywhere in app code** — `lib/utils/pdfExport.ts` is a deprecated stub that
  throws. A4 page, template-aware margin scaling, `minPresenceAhead={48}` page-break control, and
  hyphenation disabled (the default en-US hyphenator was inserting real `-` glyphs into names and
  emails and corrupting ATS text extraction).
- **Watermark exists in code but is unreachable.** `CVDocument` renders it only when
  `plan === "free"`, and every call site passes `"pro"` (`useDownloadCV` defaults to `"pro"`,
  `BuilderShell.tsx:1061` passes `"pro"`, `/preview/[templateId]` hardcodes `"pro"`). `isPro` is
  hardcoded `true` in the store. **Any doc claiming a free-tier watermark is wrong.**
- Coupons: `PRO_COUPONS` = `EARLY-ACCESS`, `MARY AN`, `MAKEMYCVPRO`, `MAHALKO`. The route validates
  the code then returns "free for everyone — no promo code needed" and unlocks nothing. Dormant by
  design. **Standing rule: do not delete this scaffolding.**
- Tests: `node --test` (no Jest/Vitest), 18 `*.test.ts` under `lib/` + `scripts/parser-fixtures.test.cjs`
  against 7 `__fixtures__/*.txt` snapshots. `npm test` ≈ 6 seconds since `50aeeba`.
- Observability: Sentry (traces 0, PII off, **Session Replay off — do not enable without a
  PDPL/GDPR review**), `@vercel/analytics`, `@vercel/speed-insights`. No PostHog. No GA4 in code.
- Cost controls: per-IP Upstash windows on all four Claude routes + a shared global daily budget
  (`lib/server/spendGuard.ts`, `AI_DAILY_GLOBAL_CAP` default **1500 units/day**) with an in-memory
  fallback when KV is unreachable. `next.config.ts` carries a full CSP.

*Open items from Audit A that need a live check, not a code change:*
- Does Vercel **append to** or **overwrite** `x-forwarded-for`? `getClientIp()` takes the *first*
  entry, so if Vercel appends, every per-IP rate limit in the product is bypassable (`A-W2-004`).
- Do preview deployments share production's KV instance? KV keys carry no environment prefix
  (`report:`, `aiGuard:daily:`, `mmcv_*`), so a shared instance means previews spend production's
  daily AI budget (`A-W5-046`).
- Historical `mmcv_*:events:*` sorted sets may still hold client IPs written before `6c3f8d9` set
  `analytics: false`. **Check Upstash before deciding whether this is a disclosure obligation or
  just a fix** (`A-W3-001`).

**Suggested commit:** `docs(cowork): add COWORK_CHANGELOG.md and record the orientation run`
