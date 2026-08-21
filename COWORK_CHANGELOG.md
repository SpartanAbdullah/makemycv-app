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
