# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Conventions and constraints for `makemycv-app` that are **not** derivable from
the code, the git history, or `README.md` (which is still create-next-app
boilerplate). Read this before changing anything.

---

## What this product is — and what it is not

MakeMyCV helps a job seeker produce and sharpen their own application material.
Three things, and only these three:

1. **CV builder** — the core, shipped (`/builder`).
2. **Cover letter** — v1 shipped 2026-10-24 (`/cover-letter`, audit WP-9).
   Written from an *excerpt* of the CV (`lib/coverLetter/payload.ts` is the
   one place that decides what leaves the browser); `{{number}}` placeholders
   block copy/download until the user fills them in. Entry points: the Review
   step and a nudge under the JD Match score.
3. **Customised LinkedIn recruiter outreach message** — v1 shipped 2026-10-31
   (`/linkedin-message`). Same architecture as the cover letter with a smaller
   excerpt (`lib/linkedinMessage/payload.ts`: headline, latest role + ≤2
   bullets, ≤3 skills, visa/availability — no name, no summary) plus the pasted
   job / recruiter text (required). 60–90-word message or a ≤200-character
   connection note, copy-only, `{{number}}` placeholders block copy, and the
   route answers 422 when the model refuses because the paste is not a job /
   recruiter context. Entry points: the Review step and the JD Match nudge.

**We are not a job board and we do not aggregate job postings.** Features that
ingest, list, search or recommend live vacancies are out of scope. A job
description enters the product only as text the user pastes about a role they
are personally applying to (`/jd-match`), and it is used to tailor *their*
document — never to present them with opportunities.

Direction worth knowing when touching builder UX: the intended growth path is
**friendly in-flow discovery**, not new surfaces. While a user is building their
CV, a light, warm nudge — *"did you know you can also get a tailored cover
letter and a LinkedIn message for this role?"* — is how the other two products
should be introduced. Tone is a peer offering help, never an upsell interstitial.

---

## Branch and release workflow

- **Work on `stagingmmc`.** It is the working branch. Do not commit directly to
  `main`.
- `main` is updated by **pull request** from `stagingmmc` (see the PR merge
  commits in history). Expect `origin/stagingmmc` to occasionally carry
  content-free merge commits from a `stagingmmc → main → stagingmmc` round
  trip; merge them down rather than force-pushing over them.
- `.claude/settings.local.json` is machine-local. Do not commit it.
- **Every change gets a `COWORK_CHANGELOG.md` entry before the task is done.**
  Newest on top, using the Goal / Files / Notes-risks / Suggested-commit format
  shown at the head of that file. It is the shared handoff record between
  Cowork, Claude Code and the founder.

---

## Sibling repo and route map

`../makemycv-site` is the marketing/content site (makemycv.ae, branch
`staging`, its own CLAUDE.md). It links into this app via `APP_URL` in its
`lib/seo.ts`, and it is the **design source of truth**: the 2026-08-20 reskin
copied CSS and font files byte-identical from it. Copy from it again for
brand-level UI changes rather than re-deriving them.

This app (app.makemycv.ae): `/builder` (the CV builder, entry
`components/builder/BuilderShell.tsx`), `/jd-match`, `/cover-letter`,
`/linkedin-message`, `/resume-checker`, `/preview`. Server routes live in
`app/api/` (`ai-improve`, `jd-match`, `cover-letter`, `linkedin-message`,
`resume-checker`, `coupons`, `health`, and the feedback trio `rating`,
`ratings/summary`, `subscribe`), rate-limited and spend-capped through
`lib/server/`. Everything CV-shaped stays client-side (see privacy below) —
the cover letter and the LinkedIn message are the two disclosed exceptions,
and each sends an excerpt, not the CV.

**Entry links from the site (2026-11).** www sends two intents in the query
string: `/builder?template=<id>` (its "Use this template" buttons — applied
once after the saved CV loads, then removed from the URL so a reload cannot
override a later choice; an unknown id is ignored) and `/builder?import=1`
(the hero's "Already have a CV?" link — the Personal step puts the keyboard
on the import button). The root redirect lives in `next.config.ts`, not in
`app/page.tsx`, because the page version dropped every query string (campaign
tags included). Keep it there, and keep it temporary.

---

## Privacy posture — the hard constraint

**The user's CV lives in their browser and must stay there.** The builder's own
footer promises this to the user, so it is a product promise, not an
implementation detail.

- The CV is persisted to `localStorage` only. There is no account, no server
  copy, no sync.
- The JD matcher is 100% client-side. **Only `{ jobText }` ever leaves the
  browser** — never CV content. Preserve this when touching `lib/jdMatch/`.
- Sentry session replay is **deliberately disabled**
  (`replaysSessionSampleRate: 0`). Users paste passport numbers, salary history
  and home addresses into the builder. Masking is best-effort and opt-out; the
  only safe setting is off. Do not enable it without a PDPL/GDPR review and a
  privacy-policy update. See `instrumentation-client.ts`.
- `beforeSend` strips `event.user` and request context so CV data cannot walk
  into an error event. Keep it.
- Any feature that would send CV text to a server (e.g. LLM-based semantic
  matching) is a **founder decision with a disclosure requirement**, not a
  refactor. See `docs/jd-match-evidence-pass.md`. The cover letter (2026-10)
  is the first such feature: it sends the excerpt defined in
  `lib/coverLetter/payload.ts` (first name, headline, summary, latest role +
  ≤4 bullets, ≤12 skill names, visa/availability — never the surname, contact
  details or the photo),
  the page says so above the button, and the privacy policy on www names it.
  Widening that excerpt means updating all three. The LinkedIn message
  (2026-10-31) is the second, with a smaller excerpt in
  `lib/linkedinMessage/payload.ts` (headline, latest role + ≤2 bullets, ≤3
  skill names, visa/availability — no name, summary, contact details or
  photo) plus the pasted job / recruiter text; same three places to update.

- **Feedback data (2026-10) is the one thing we store about people**, and it
  lives in Supabase (EU region) behind the service-role key in
  `lib/server/supabase.ts` — RLS on, no policies, server routes only. A star
  is anonymous; a quote carries a name only if the user typed one and ticked
  consent, and is shown on www only after `approved_at` is set BY HAND in the
  dashboard. Email sign-ups are double opt-in (`/api/subscribe` → Resend →
  `/confirm`), store the consent text version, and unsubscribe in one click.
  Never log the email or the quote; analytics params stay enums and counts.
- **Analytics consent is Consent Mode v2** (`lib/consent.ts`,
  `components/consent/*`, `proxy.ts`): EU/UK/CH visitors start denied,
  everyone else granted with an opt-out, stored in `mmcv_consent` on
  `.makemycv.ae`. The consent files are byte-identical copies of the site's —
  edit both. The inline default MUST stay ahead of the GTM script in
  `app/layout.tsx`. A consent command is a real `arguments` object
  (`pushConsentCommand` in `lib/consent.ts`): GTM ignores a plain Array with
  the same items, which is how "Opt out" did nothing until the next page load
  for a month (2026-11 audit, checked on production). `lib/consent.test.ts`
  pins the shape — do not turn it into a rest parameter or an arrow function.

Primary market is the UAE, so PDPL — not just GDPR — is the governing regime.

---

## Dormant Pro / coupon scaffolding — KEEP IT

The 2026-05-31 pivot made every feature free. `isPro` is **force-set to `true`**
so no UI gates (`lib/store/cvStore.ts:343`).

The scaffolding — `isPro`, `proAccessSource`, `lib/config/coupons.ts`,
`lib/utils/entitlements.ts`, the `makemycv:isPro` / `makemycv:appliedCoupon` /
`makemycv:hasUsedFreeDownload` storage keys — is **retained on purpose** for the
paid tier's revival. **Do not delete it as dead code.** It reads as unused; it
is parked.

`canTailorByDomain()` in `lib/utils/entitlements.ts` is the single checkpoint
for the free-vs-Pro line on domain personalisation. Every tailoring branch calls
it, so the gate is flipped in one place rather than hunted for. Route new gated
features through the same pattern.

---

## Store and hydration (`lib/store/cvStore.ts`)

Zustand store; `bindCvStorage()` (line ~537) does all initial hydration from
`localStorage` and is idempotent behind a `hasBoundStorage` flag.

**The gotcha:** `bindCvStorage()` must be called by any entry point that reads
the CV. It is currently called from `BuilderShell.tsx` and `JdMatchPanel.tsx`.
A new route that renders CV data without calling it gets an empty store and
looks broken in a way that reproduces only on a fresh load.

**Every persisted slice follows the same pattern — follow it for new ones:**
a `makemycv:*` storage key, a **shape version** in the payload, a parse that
**discards rather than guesses** on mismatch, `removeItem` for the stale record,
a line in `reset()`, and a hydration block in `bindCvStorage()`. Existing
examples: `parseSignals`, `scoreBaseline`, `jdTarget`. Leaving an unreadable
record behind is worse than dropping it — it can never be used and silently
suppresses the feature.

**Load-time normalisers must carry every field.** `ensureSkillIds()` rebuilds
each skill on every load. It predated `CvSkill.category` and silently stripped
it for four months (2026-11 audit). A new field on a type that passes through
a normaliser is added there and to its test in the same change.

**Imports go through `applyImportedCv()`** (pure, tested). The state an import
replaces is kept in `importUndo` — memory only, cleared by `reset()` — and
`undoImport()` puts back the CV, parse signals and score baseline together.

Three rules the import screens depend on (`lib/utils/cvContent.ts`; each was
a data-loss bug found by a review of PR #45, 2026-11):

- **"Is there a CV to lose?" is `hasUserEnteredData()`, not `!isCvEmpty()`.**
  Anything the user entered counts — an email, a photo, a language, a job
  card with only its dates. It decides the review's default (Merge), whether
  the choice is shown, and whether Undo is offered. `isCvEmpty()` answers a
  different question (is there anything for JD Match to match?) and must not
  be used to decide whether data may be replaced.
- **Merge drops only untouched cards** (`hasTypedContent`). "Meaningful"
  (`meaningfulExperience` / `meaningfulEducation`) is the test for what to
  PRINT; using it for what to KEEP threw away cards the user had started.
- **Any write that changes the CV ends the import's Undo** (`updateSection`,
  `setData`, `importJson`), because Undo restores the whole pre-import CV and
  would discard the edit. `updateSection` compares with
  `sameSectionContent()` first: the forms write back what an import gave
  them, and the Personal step re-guesses the job field on a headline blur,
  and neither is an edit. A new automatic write to the store has to stay
  invisible to that comparison, or Undo dies the moment an import lands —
  `smoke:import` ("Undo after a Replace…") is the check.

**"Start a new CV" (Review step, 2026-11) calls `reset()`** behind
`StartOverDialog`, which offers the backup file first and has no undo on
purpose — on a shared computer the old CV must not be one tap away. Anything
new that holds CV-derived data has to be cleared in `reset()`;
`CV_SESSION_KEYS` lists the sessionStorage keys other modules own
(`startOver.test.ts` fails if one is renamed at its source).

**Stale-tab guard:** the debounced save checks `staleTab` before writing. A tab
whose in-memory copy predates another tab's save must never write, or it
replaces newer work with older. The check lives at the write, not only in the
subscription, because the 500ms debounce is long enough to lose the race.

---

## Templates read `cv.skills` directly

Fourteen templates under `lib/templates/`, plus `components/pdf/CVDocument.tsx` and
the DOCX export, read `cv.skills` **directly** — only a few go through
`splitSkills()`.

Consequence: **a "hide this" flag on a skill object is unsafe.** It would need
filtering in a dozen independent render paths, and missing one prints something
the user explicitly excluded onto a CV they submit to an employer. This is why
"set aside" parks a skill by **removing it from `cv.skills`** and keeping it in
a device-local list instead — it cannot print because it is not in the document.
Apply the same reasoning to any future per-skill visibility state.

---

## What each template prints (`lib/templates/capabilities.ts`)

Not every template prints every field: Harvard and Professional draw no
photo, four templates print no date of birth, and Classic, Modern and Harvard
draw nothing in the accent colour. `capabilities.ts` is the one list. The
Design panel reads it (swatches give way to one line where the colour has no
effect) and `TemplateOmissionNote` reads it (one sentence in the Review step
and the full-page preview, only when the user has that detail switched on).
`capabilities.test.ts` reads the template sources and fails when a template
starts or stops printing a field without the list changing — and when a
template that draws a photo ignores the user's "Show photo on CV" switch
(Professional Photo did until 2026-11).

`getEssentialChips()` returns a stable `key` (`visa` / `availability` /
`licence` / `nationality`) beside the printed `label`. **Look a chip up by
`key`, never by `label`** — the label is copy ("DL" became "Driving licence")
and a lookup by it fails silently, dropping the row from the CV.

---

## Exports: one gate, one record, one naming rule

A CV download is three things besides the file, and every download button has
to do all three (JD Match's "Download for this job" did none until 2026-11):

- **Gate** — `getMissingItems()` / `getUnfilledBlanks()` open
  `ExportGateDialog` first. It warns; "Export anyway" still exports.
- **Record** — `recordCvExportStarted()` before rendering and
  `recordCvExport()` after the file exists (`lib/exportRecord.ts`). That is
  the only place `cv_export`, the number the product is judged on, is fired,
  and it returns the row the post-download card shows. Never record a JSON
  backup.
- **Name** — `lib/utils/fileName.ts` through `triggerBlobDownload()`:
  `CV_First_Last.<ext>`, accented Latin letters folded to their base letter,
  other scripts kept, and `CV.<ext>` — never the product's name — when the CV
  has no name.

`exportAsks.test.ts` and `fileName.test.ts` fail when a download path fires
the event itself or sets `a.download` itself.

The post-download card shows one row per export, in this order (owner
decision 2026-11-21): the next step (JD Match, cover letter), then email,
then stars, then follow. A row with nothing to ask gives way to the next one
(`resolveExportAsk`). The sentence above the row (karak / paid review) is a
separate alternation — the exposure test depends on it; leave it alone.

---

## Fonts and print

- `app/fonts/app.ts` loads the faces; `app/globals.css` maps them onto
  `--cv-font-body` / `--cv-font-display` / `--cv-font-serif`.
- `lib/templates/theme.ts` consumes **only** `--cv-font-*`, never the raw
  `--font-*` variables. This decoupling is load-bearing: restyling the app
  chrome must never silently restyle the CV documents themselves.
- Every rendered template root carries `.cv-print`, which remaps generic
  typography inside a CV. Check `.cv-print` and its print-media block in
  `globals.css` when changing global type rules.
- **Arabic (2026-10-31, `docs/arabic-pdf.md`).** The PDF cannot use a font
  stack and cannot take raw Arabic letters: `components/pdf/CVDocument.tsx`
  imports `Text` / `Link` from `components/pdf/ArabicText.tsx`, which shapes
  any Arabic-bearing run into presentation forms (`lib/pdf/arabicText.ts`)
  and sets it in Vazirmatn as ONE run. Never import react-pdf's `Text` into a
  layout directly, never put `fontFamily` arrays in a style, and call
  `warmPdfFonts()` after registering fonts in any new Node renderer. The
  preview gets the same face through the `'Vazirmatn CV'` @font-face
  (`unicode-range`-limited) that sits first in the `--cv-font-*` stacks.

---

## Truthfulness rules for suggestion features

These are product invariants, repeatedly re-derived; do not relax them casually.

- **Detect, never assert.** Only tell a user "you already show this" when the
  term genuinely appears in text they wrote.
- **A false "you already prove this" is the costliest error** — worse than a
  false miss, because it asserts evidence that is not there.
- Copy describes **the document, never the person**: "this word doesn't appear
  anywhere else in your CV", never "you haven't shown this".
- Rewrites edit an **existing** bullet; they never append one (appending
  fabricates an achievement). See the replace-only rule in
  `lib/jdMatch/applyFix.ts`.
- The AI rewrite endpoint is **refuse-capable** — an empty result is an honest
  decline and must surface as one, not as an error or a silent no-op.
  `/api/ai-improve` reads each reply with `readImproveReply()`
  (`lib/ai/improveReply.ts`): results, **declined** (a refusal or an empty
  list — not asked again) or **unusable** (cut off, not JSON — asked once
  more, inside the same 25 s and charged to the spend guard). Nothing usable
  is a 422 `nothing_to_suggest`, which `useAIImprove` — like an empty 200 —
  turns into `NOTHING_TO_SUGGEST`; screens show it in plain ink with a retry,
  never in red.
- **Never rank or reshape suggestions silently.** If output is being reordered
  by something invisible (a JD target, an inferred domain), say so in the UI and
  give a one-tap way off. Advice whose basis is hidden cannot be evaluated.
- Credentials (DHA/DOH/MOHAP, RERA/DLD broker card, NEBOSH, PMP) get a
  confirmation guard before being added — UAE application forms ask about them
  as knockout questions and a wrong claim is checkable against a register.
  Government *systems* a user merely operates (Ejari, Tasheel, Amer) are not
  guarded. **Every path that adds to the CV asks first**, whatever the source:
  `isCredentialTerm()` in `lib/data/domainSkills.ts` is the test (the Skills
  step's chips and paste, AI skill suggestions, and JD Match through
  `lib/jdMatch/credentialGuard.ts`). Until 2026-11 only the Skills step asked;
  a new add path without the check repeats that bug.
- **Ready-made text leaves a blank, never a figure**: `__` and `[your …]` in
  `lib/data/ideaSuggestions.ts` and `summaryStarters.ts`. `countUnfilled()` in
  `lib/ai/placeholders.ts` has to recognise whatever blank a new line uses
  (`lib/ai/blanks.test.ts` runs against the real banks), because the export
  dialog's "blanks still to fill" list is built from it. `PLACEHOLDER_RE` is
  the AI contract (what a route may emit, what blocks an insert) — do not
  widen it to cover blanks.

---

## Checks before shipping

```bash
npm run dev       # next dev on :3000 (also .claude/launch.json)
npx tsc --noEmit  # fast typecheck; first CI step
npm test          # aggregate runner; discovers every test:* script
npm run test:unit # tsc -p tsconfig.test.json + node --test
npm run test:parser
npm run smoke:pdf
npm run smoke:builder  # drives the real builder against `next start` (see scripts/builder-smoke.mjs)
npm run lint      # --max-warnings=11
npm run build
```

- **Unit tests** are `lib/**/*.test.ts`, compiled together by
  `tsconfig.test.json` (`rootDir: lib`) into `.test-build/`. To run one file:
  `npx tsc -p tsconfig.test.json && node --test .test-build/skills/paste.test.js`
  (note: no `lib/` in the output path). `lib/` must not import `components/`
  or `.tsx`, or this config breaks.
- **A new suite is just a `test:*` script** in `package.json`;
  `scripts/run-all-tests.mjs` picks it up automatically.
- **Feature switches for the feedback surfaces**: `NEXT_PUBLIC_FEEDBACK=1` shows
  the rating strip, `NEXT_PUBLIC_EMAIL_SIGNUP=1` the email field; the routes
  answer 503 without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (and
  `RESEND_API_KEY` for email). Locally they stay off; the end-to-end check
  uses a mock PostgREST/Resend (`_cowork/audit-2026-10/scripts/mock-backend.mjs`).
  Every analytics event name also needs a trigger + tag published in GTM.
- **Scanned-PDF import (2026-11-21)**: `NEXT_PUBLIC_OCR_IMPORT=1` makes the
  builder import read a PDF with no text layer by OCR in the browser
  (`lib/importers/ocr.ts`, `ocrBrowser.ts`); off, a scan fails with
  `no_text_layer` as before. Every OCR asset is same-origin under `/ocr/`:
  the worker and wasm core are copied from `node_modules` on `postinstall`
  (`scripts/copy-ocr-assets.mjs`, git-ignored) and the English data is
  committed. Never point tesseract.js at a CDN. To check it in a browser:
  build with the flag, `next start`, then `SMOKE_OCR=1 npm run smoke:import`.
- CI (`.github/workflows/ci.yml`, pushes to `main`/`stagingmmc` and PRs) runs
  typecheck → lint → test on Node 22. It does **not** run `next build`; Vercel
  does that on deploy.
- `npm test` **does not fail fast** (changed 2026-08-02, audit A-W5-016) — it
  runs every suite and reports at the end, so one broken suite cannot hide the
  rest.
- `npm run lint` is capped at **exactly 11** warnings. Do not add warnings; if
  you remove some, lower the cap so it cannot drift back up.
- **PDF output is not visually verifiable from here** and `@react-pdf/renderer`
  is not fully deterministic. `smoke:pdf` proves it renders, not that it looks
  right. Since 2026-10 the PDF embeds the real faces (Inter / Bricolage /
  Instrument Serif) from `public/fonts/pdf/*.ttf` — static instances generated
  from the variable woff2 files with fontTools (`fontkit` cannot read woff2 or
  variable fonts). Regenerate them if `app/fonts/*.woff2` changes;
  `lib/pdf/fonts.ts` falls back to Helvetica when they are not registered.
- **PDF layouts share primitives** (`components/pdf/CVDocument.tsx`, since
  2026-10-25): `pt()` for px→pt, `EducationEntry` / `ExperienceEntry` /
  `PdfChips` / `PdfHeading` driven by a per-layout variant transcribed from
  the live template, `withTopGap()` for the first-section rule,
  `safeTracking()` capping letter-spacing at 8% of the size (pdf.js and ATS
  text layers read wider tracking as spaced letters), and
  `lib/utils/education.ts` (`educationTitle`, `attestedLabel`) for the words
  both renderers print. Edge-bleed sidebars paint a `fixed` absolute band and
  a transparent column pulled over it with `-27×m / -24×m` margins; page
  padding scales with `marginScale` for every template. A new sidebar
  template must register its band in `scripts/pdf-ops-check.mjs` (`BANDS`)
  or the smoke will not guard its page-2 notch. `npm run smoke:pdf` renders
  every template three times (fixture, tripled experience, density extremes)
  and `scripts/pdf-ops-check.mjs` fails on alpha colours or a missing band.
  Verify parity with pdf.js text extraction, not by eye.
- **Every PDF `<Text>` sets its own `lineHeight`.** react-pdf does not resolve a
  line box from the run's own size: a `<Text>` without `lineHeight` inherits the
  page's already-resolved 8.6 × 1.45 = 12.47pt box whatever its font size (a 20pt
  name overprints its headline; a 9pt label sits in a box too tall), while the
  live templates inherit Tailwind's `html { line-height: 1.5 }` on every run that
  sets none. Use `LH_NORMAL` (1.5) in `CVDocument.tsx` for those runs and the live
  ratio × `lineScale` where the template sets one. `scripts/pdf-ops-check.mjs`
  fails on overprinting runs. `npm run fidelity:pdf` (needs `next start -p 3000`
  and Chrome) puts every template's preview next to its PDF and fails when a cell
  regresses against `scripts/pdf-fidelity-baseline.json` — lower a cell's baseline
  when a fix improves it; `--persona=bilingual | arabic-only | arabic-first |
  arabic-name | arabic-dense` are the Arabic checks and `npm run smoke:arabic`
  is the Arabic text-layer guard (see `docs/arabic-pdf.md` and
  `docs/ai-mission/PDF_FIDELITY.md` in the parent folder).
- **Anything that changes layout on blur needs `smoke:builder`.** A helper line
  that appears when a field loses focus moves the Continue button during the
  user's own click and the click is lost (2026-10 audit F01). `FieldError` has a
  `reserve` prop for exactly this; role cards no longer fold on blur. Run
  `npm run build && npx next start -p 3000`, then `npm run smoke:builder` — it
  clicks Continue once per step with a field still focused and fails on a
  swallowed click. It also runs **axe-core** on the builder steps, the checker
  and JD Match and fails on serious/critical violations (template-gallery
  thumbnails are `inert` and excluded — their colours belong to the CV
  templates). Keep the CV templates out of a11y fixes: the document's own
  colours (e.g. `text-slate-400` dates) are a template design decision.
- **Turbopack dev mode has a known wedge** — the builder can hang on
  "Loading builder..." with all chunks 200 and no console error. It is not
  necessarily your change. Verify against a **production build** before
  concluding a change broke the app.

---

## Docs map

| File | What it holds |
|---|---|
| `docs/cv-schema-reference.md` | CV data shape, store, storage keys |
| `docs/jd-match-spec.md` | JD matcher design |
| `docs/jd-match-evidence-pass.md` | Evidence detection: what shipped, and the reverted dead end — **read its status header first** |
| `docs/import-parser-fixes-2026-06.md` | Import parser heuristics |
| `docs/resume-checker-*.md`, `docs/score-parity-smoke-test.md` | Checker and score parity |
| `docs/ux-audit-2026-06.md`, `docs/feedback-round-2026-06.md` | UX audit findings |
| `ROADMAP.md`, `DECISION_LOG.md` | Direction and settled decisions |

`README.md` is unmodified boilerplate — do not rely on it.
