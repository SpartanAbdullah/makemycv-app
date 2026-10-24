# Cowork Changelog — makemycv-app

Newest entry on top. Every repo change made by Cowork gets an entry here before the task is
considered done. This is the shared handoff record between Cowork, Claude Code and Abdullah.

Format:

```
## [YYYY-MM-DD HH:MM] Short title
**Goal:** why — the task, and which business objective it serves
**Files:**
- created / edited / deleted: path — what and why
**Notes / risks / follow-up:** anything to know before building on this
**Suggested commit:** type(scope): concise description
```

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
