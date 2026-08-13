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
