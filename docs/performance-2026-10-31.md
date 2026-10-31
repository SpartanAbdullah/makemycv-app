# Performance and reliability review — 2026-10-31

Session 4, priority 9. Branch `stagingmmc`, baseline HEAD `9ee3757`. Measured
first, changed second; only low-risk items with before/after numbers shipped.

## Method

- **Build:** `npm run build` (Next 16.4.3, Turbopack). Next 16 no longer prints
  a First-Load-JS route table, so per-route JS is computed from the scripts the
  prerendered HTML in `.next/server/app/<route>.html` references, raw and
  gzip-9 (`/tmp/bundle-report.mjs`, reproduced inline below as the method).
  Chunk contents were attributed by grepping each chunk for package markers.
- **Runtime:** `scripts/perf-measure.mjs` (new) — Playwright driving the
  installed Chrome against `npx next start -p 3750`, 3 runs, medians reported.
  Desktop 1440×900; mobile = Playwright `devices["Pixel 7"]` + CDP
  `Emulation.setCPUThrottlingRate 4`. Definitions:
  - *TTFB / FCP / LCP* from Navigation Timing, Paint Timing and a buffered
    `largest-contentful-paint` observer read 1.5 s after `load`.
  - *hydrated* = ms since navigation start until React has attached props
    (`__reactProps*`) to the first `<input>` — before that, typing is lost.
  - *keystroke React work* = `input` event seen by a capture listener on
    `document` → bubble listener on `window` (fires after React's discrete
    event flushed its synchronous render). *input → paint* adds a rAF + task.
    50 characters typed with a 40 ms gap. The Event Timing API was not used:
    Chrome clamps `durationThreshold` to 16 ms, hiding exactly the keystrokes
    of interest.
  - *preview re-render* = `input` event → first MutationObserver callback
    inside the rendered `.cv-print` root.
  - *PDF export* = Download click → the `URL.createObjectURL(blob)` call for
    the `application/pdf` blob (hooked before app scripts run). Dense persona
    = the classic preview profile with its experience list tripled (the same
    stress `smoke:pdf`'s `-long` pass uses). "cold" = first export in a fresh
    context (lazy `@react-pdf` chunk not cached), "warm" = second.
  - *import* = file chosen → MappingReview dialog visible (or the error bar for
    the 25 MB case, which the 15 MB gate rejects before any bytes are parsed).
  - *checker* = file chosen → `POST /api/resume-checker/parse` request sent.
    The route is answered locally (no key, no spend), so this is client-side
    extraction only; the report page needs KV and is out of scope.
- Everything ran on one Windows 11 laptop; absolute numbers are that machine's,
  the before/after deltas are what matters.

## Bundle — baseline (HEAD 9ee3757)

Per-route client JS (eager scripts referenced from the prerendered HTML):

| route | scripts | raw KB | gzip KB |
|---|---|---|---|
| / | 11 | 739 | 234 |
| /builder | 18 | 1305 | 385 |
| /resume-checker | 14 | 798 | 257 |
| /jd-match | 18 | 1033 | 308 |
| /cover-letter | 14 | 821 | 264 |
| /linkedin-message | 14 | 820 | 264 |

Largest chunks:

| chunk | raw KB | gzip KB | loaded by | contents (marker grep) |
|---|---|---|---|---|
| 14lwj2y9jbyu1 | 1453 | 477 | lazy (Download click) | `@react-pdf/renderer` + yoga + fontkit |
| 3zo2ctfyzm0fi | 511 | 125 | lazy (DOCX import) | `mammoth` |
| 3vei_ewp3yb8y | 347 | 111 | every route | react-dom, `@sentry/nextjs` browser SDK, react-hook-form |
| 0zra460w3ahfe | 326 | 91 | lazy (.docx export) | `docx` |
| 356t-96xvg1my | 323 | 94 | lazy (PDF import / checker upload) | `pdfjs-dist` |
| 2sem4_yd5ztzq | 320 | 89 | /builder | the builder itself: 14 templates, 10 step forms, score engine, skill/role banks, zod |
| 1afs31rw5tltl | 156 | 43 | every route | Next runtime |
| 0zb4-23p0z2t9 | 117 | 20 | /builder, /jd-match | shared builder/jd code (docxExport wrapper, template helpers) |
| 0cz1d0mv5g_q7 | 110 | 39 | every route | React / framework |

**Finding:** the four suspects (`@react-pdf/renderer`, `pdfjs-dist`, `mammoth`,
`docx`) are already `import()`ed at the point of use (`hooks/useDownloadCV.ts`,
`lib/importers/*Adapter.ts`, `lib/utils/docxExport.ts`) and `MappingReview` is
behind `next/dynamic`; none of them is in `/builder`'s eager 385 KB. There is no
icon pack (`components/builder/Icon.tsx` is a hand-rolled set). The three
largest *eager* dependencies on `/builder` are therefore:

1. **react-dom + the Sentry browser SDK** (chunk `3vei`, 111 KB gz, shared by
   every route) — Sentry is roughly half of it.
2. **The builder's own code** (chunk `2sem4`, 89 KB gz): all 14 CV templates
   (needed by the live preview and the gallery on every step), all 10 step
   forms (only one renders at a time), the 61 KB-source score engine and the
   domain skill banks.
3. **Next/React runtime** (`1afs` + `0cz1`, 82 KB gz).

On `/resume-checker` the eager set is the shared chunks plus the checker UI
(257 KB gz); `pdfjs-dist`/`mammoth` load on upload.

The preview personas (`lib/data/preview-profiles.ts`, 41 KB source) are
confirmed absent from the builder bundle (only `/preview/[templateId]` and the
scripts import them).

## Runtime — baseline (HEAD 9ee3757, production build)

Medians of 3 runs (individual runs in brackets). Raw JSON in `.perf-results/`.

| area | metric | median | runs |
|---|---|---|---|
| desktop cold load /builder | TTFB | 14 ms | 14 / 12 / 15 |
| | FCP | 280 ms | 340 / 128 / 280 |
| | LCP | 492 ms | 676 / 428 / 492 |
| | hydrated (React props on first input) | 413 ms | 413 / 402 / 461 |
| | JS transferred (gzip over the wire) | 376 KB | 22 requests |
| | JS decoded | 1274 KB | |
| | fill 3 fields + first Continue → next step | 253 ms | 253 / 246 / 382 |
| | Continue click → next step | 163 ms | 163 / 155 / 232 |
| desktop typing, First name (preview visible) | keystroke React work median / p95 | 0 / 1 ms | 50 chars, 40 ms gap |
| | input → paint median / p95 | 8 / 259 ms | see note |
| desktop typing, Summary textarea | keystroke React work median / p95 | 1 / 2 ms | |
| | input → paint median / p95 | 8 / 326 ms | see note |
| desktop preview re-render | last input → `.cv-print` mutation | 269 ms (First name), 267 ms (Summary) | exactly one mutation per 50 chars |
| PDF export, dense persona (9 roles / 1 edu / 7 skills, classic) | cold: click → PDF blob | 577 ms | 622 / 577 / 569 |
| | warm: click → PDF blob | 168 ms | 168 / 157 / 209 |
| | PDF size | 21 KB | |
| import | `text-cv.pdf` → MappingReview visible | 878 ms | 904 / 875 / 878 |
| | `header-contact.docx` → MappingReview visible | 872 ms | 872 / 840 / 921 |
| | 25 MB PDF → error bar (15 MB gate, no parse) | 27 ms | 44 / 19 / 27 |
| checker | `classic.pdf` chosen → POST /parse sent | 313 ms | body 3 KB |
| | `classic-long.pdf` chosen → POST /parse sent | 274 ms | body 6 KB |
| mobile cold load (Pixel 7, 4× CPU) | TTFB | 11 ms | |
| | FCP | 236 ms | 236 / 200 / 292 |
| | LCP | 1876 ms | 2308 / 1876 / 1696 |
| | hydrated | 1819 ms | 2046 / 1819 / 1692 |
| | JS transferred | 353 KB | 19 requests (no preview drawer) |
| | Continue click → next step | 1037 ms | 1037 / 264 / 1062 |
| mobile typing, First name (4× CPU) | keystroke React work median / p95 | 3 / 7 ms | |
| | input → paint median / p95 | 23 / 302 ms | see note |

**Reading the typing numbers.** Each step form syncs to the store on a 250 ms
debounce (`PersonalStep` / `SummaryStep` `watch` subscription) and the score
engine runs on `useDeferredValue(data)` in `BuilderShell`, so a keystroke's
synchronous React work is 0–3 ms and the preview re-renders once, ~265 ms
after the last keystroke (250 ms debounce + ~15–20 ms render). The input→paint
p95 outlier is a single stretch of 4–5 consecutive keystrokes whose paints all
resolve together (e.g. 288 → 241 → 193 → 129 → 67 ms, 40 ms apart) with **no
`longtask` entry at all** during typing — a renderer frame-scheduling pause,
not application JavaScript. Below the 50 ms threshold the task set for adding
`React.memo` / `useDeferredValue` to the preview; nothing changed there.

**Not measured:** checker upload → report render (needs KV and a key; the
route was answered locally, so the figure is client-side extraction only).

## Runtime — after this session's changes

Same harness, same machine, after the three code changes (bounded Anthropic
calls, `writeStorage`, checker-smoke fix). The client bundle is byte-identical
per route (385 KB gzip on `/builder`, 376 KB transferred), so every runtime
delta below is run-to-run noise on a laptop, not an effect of the changes —
reported anyway, as the task asked for before/after.

| area | metric | before (median) | after (median) | after runs |
|---|---|---|---|---|
| desktop cold load /builder | TTFB | 14 ms | 14 ms | 18 / 10 / 14 |
| | FCP | 280 ms | 392 ms | 392 / 116 / 540 |
| | LCP | 492 ms | 772 ms | 1464 / 420 / 772 |
| | hydrated | 413 ms | 641 ms | 641 / 406 / 764 |
| | JS transferred | 376 KB | 376 KB | identical |
| | Continue click → next step | 163 ms | 178 ms | 169 / 178 / 473 |
| desktop typing, First name | keystroke React work median / p95 | 0 / 1 ms | 0 / 1 ms | |
| | input → paint median | 8 ms | 9 ms | |
| | long tasks during typing | — | 0 | 0 / 0 / 0 |
| desktop typing, Summary | keystroke React work median / p95 | 1 / 2 ms | 1 / 2 ms | |
| | input → paint median | 8 ms | 8 ms | |
| | long tasks during typing | — | 0 | 0 / 0 / 0 |
| desktop preview re-render | last input → `.cv-print` mutation | 269 / 267 ms | 264 / 265 ms | |
| PDF export, dense persona | cold | 577 ms | 612 ms | 790 / 612 / 574 |
| | warm | 168 ms | 259 ms | 298 / 259 / 178 |
| import | `text-cv.pdf` → review | 878 ms | 897 ms | 903 / 857 / 897 |
| | `header-contact.docx` → review | 872 ms | 906 ms | 987 / 891 / 906 |
| | 25 MB gate | 27 ms | 27 ms | |
| checker | `classic.pdf` → POST sent | 313 ms | 363 ms | 579 / 363 / 343 |
| mobile (Pixel 7, 4× CPU) | LCP | 1876 ms | 2464 ms | 3832 / 2464 / 1868 |
| | hydrated | 1819 ms | 2470 ms | 3984 / 2470 / 1876 |
| mobile typing | keystroke React work median / p95 | 3 / 7 ms | 2 / 5 ms | |
| | input → paint median / p95 | 23 / 302 ms | 19 / 33 ms | one 58 ms long task in run 1 |

The after pass had one slow first run (desktop LCP 1464 ms, mobile hydration
3984 ms) that drags the medians; the best runs of each pass match the baseline
within ~10%. The spread is the honest finding: on this machine a 3-run median
resolves ±150 ms on cold load, so anything smaller than that needs more runs.

**Server-side change, measured by unit test rather than in the browser:** a
Claude call against a server that never answers now rejects at the configured
cap (120 ms cap → rejected after 160 ms in `lib/server/anthropic.test.ts`);
in production that is ≤ 25 s for the five small routes and ≤ 45 s for the
checker parse, followed by a 504 whose `error` sentence every hook renders.
Before, the wait was unbounded until the platform killed the function.

## Reliability review

| area | finding | status |
|---|---|---|
| Anthropic calls (6 sites) | No `signal` on any `fetch`; client hooks have no timeout either. A stalled upstream held the spinner until the platform killed the function (60 s on `/api/resume-checker/parse` via `maxDuration`, platform default elsewhere) and the user then saw "Something went wrong" from a body-less 504. | **Fixed:** `AbortSignal.timeout` 25 s (small prompts) / 45 s (parse), 504 with a sentence, no retry after a timeout. Unit test: a never-answering local server is rejected at the cap (120 ms cap → 160 ms). |
| Spend guard (`lib/server/spendGuard.ts`) | KV unreachable → in-memory per-instance bucket (30 units/h). Honestly documented as bounded per instance, unbounded in aggregate. Per-IP limiter (`rateLimit.ts`) treats Upstash's `reason: "timeout"` as *unavailable*, not success, with a 3 s cap. | OK as designed. |
| KV outage, checker | `saveReport` failure returns 500 *after* the paid Claude call. Spend without a result during a KV outage. | Deferred — a KV pre-check costs a round trip on every upload; note only. |
| `/api/health` | KV ping bounded by a race. | OK. |
| Sentry client (`instrumentation-client.ts`) | `tracesSampleRate: 0`, replay off, `beforeSend` strips user/request, console breadcrumbs dropped, CSP violations reported (capped at 3/page). Enabled only in production. | OK; privacy posture intact. |
| Error boundaries | `app/error.tsx`, `app/builder/error.tsx` (segment; Sentry capture; store survives, "Continue editing" resets), `ErrorBoundary` around the template preview (auto-reset on template change). A crash inside a *step form* unmounts the whole builder segment (not an island) but the Zustand store and localStorage are untouched. | OK; island boundary around the form column is a possible refinement, not a defect. |
| localStorage quota, CV | `saveCvToStorage` returns `false` → `saveError` → red TopBar chip; the stale-tab guard sits at the write. The debounced save never throws. | OK. |
| localStorage quota, side records | `setIsPro`, `setHasUsedFreeDownload`, `setParseSignals`, `captureScoreBaseline` wrote with a bare `setItem` before `set()`; a quota/private-mode refusal threw out of the action — a checker import could crash half-way. | **Fixed:** `writeStorage()` never throws; unit-tested. |
| 5 MB photo | `resizeAndCropToSquare` caps every upload at 200×200 JPEG q0.85 (≈ 10–15 KB base64) before it reaches the store, and `validateImageFile` rejects > 5 MB files. The photo cannot fill the 5 MB origin quota. | OK; no compression change needed. |
| PDF import | 45 s deadline that destroys the pdf.js task, 15 MB gate, 30-page cap, worker probed once with CDN fallback. | OK (2026-10-31 import work). |
| DOCX import | `mammoth.extractRawText` has no deadline and runs on the main thread. A pathological .docx (deep zip, huge XML) can freeze the tab. | Deferred — needs a worker or a byte cap below the 15 MB gate. |
| PDF export | `@react-pdf` lays out on the main thread; the tab is unresponsive for the export duration (see runtime table). | Deferred — moving to a worker is a large change; the measured time is acceptable for a one-click action. |
| Checker upload | Phase copy escalates at 4 / 14 / 45 s but there is no client abort. | Covered by the server 504 at 45 s. |

## Changes shipped

| commit | change | before | after |
|---|---|---|---|
| (see git log) | `fix(api)`: bounded Anthropic calls, 504 + message | unbounded; spinner until platform kill (≥ 60 s) | ≤ 25 s / ≤ 45 s then a sentence |
| (see git log) | `fix(store)`: `writeStorage` never throws | action throws on quota → event-handler crash | returns `false`, warns, UI continues |
| (see git log) | `chore(perf)`: `scripts/perf-measure.mjs` | no runtime numbers in the repo | reproducible medians |
| (see git log) | `test(checker-smoke)`: ignore the body-less pdf.js worker HEAD probe | `smoke:checker` red since `45ade82` (7 PASS / 1 FAIL) | 8 / 8 |

Gates at the end: `npx tsc --noEmit` clean, `npm run lint` 11 / 11, `npm test`
3 suites green, `npm run build` clean, `smoke:pdf` all checks, `smoke:builder`
27 / 27, `smoke:import` 15 / 15, `smoke:checker` 8 / 8.

## Deliberately not changed

- **No `import()` changes for `@react-pdf/renderer`, `pdfjs-dist`, `mammoth`,
  `docx`** — they are already lazy (measured, see bundle table). The task's
  hypothesis was checked and found already done.
- **No `next/dynamic` for the step forms.** They are the eager
  `2sem4` chunk together with the templates; splitting the ten steps would save
  an estimated 20–25 KB gzip on first load at the cost of a loading flash on
  each step's first visit and a new failure mode (chunk fetch fails mid-flow).
  Not worth it against the measured hydration time below.
- **No Sentry lazy-loading.** ≈ 50–60 KB gzip on every route, but errors before
  the SDK loads would go unreported, and the CSP-violation reporter depends on
  it being present early. A founder trade-off, not a refactor.
- **No `React.memo` / `useDeferredValue` on the live preview.** Measured
  keystroke cost is below the 50 ms threshold the task set (runtime table).
- **No photo compression change** — already capped at 200×200.
- **No client-side fetch timeout in the hooks** — the server 504 now covers
  the stalled-upstream case; a client timer would only matter when the
  function itself is unreachable, where the platform answers anyway.
- **No change to `lib/data/preview-profiles.ts`, `components/pdf/CVDocument.tsx`,
  `scripts/pdf-fidelity*`, `public/fonts/pdf/`** — owned by other agents this
  session.

## Deferred items

1. DOCX import deadline / worker (main-thread freeze on a pathological file).
2. KV reachability before the paid parse call (spend during a KV outage).
3. Island error boundary around the form column so a step-form crash leaves
   the TopBar and preview alive.
4. Step-form code splitting (≈ 20–25 KB gzip) — only if mobile hydration
   becomes a complaint.
5. Sentry SDK size (≈ 50–60 KB gzip on every route) — founder decision.
6. PDF export in a worker — only if the export time grows with new templates.
