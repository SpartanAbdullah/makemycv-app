# MakeMyCV Roadmap

Last updated: 2026-08-20
Source of truth for shipped features, active work, and backlog. Update on every completed task.

---

## 🔴 Must do next (blocking)

- [ ] Merge `stagingmmc` → `main` and deploy — the 2026-08 premium reskin is on staging only
- [ ] Store schema versioning — bump a `storeVersion` number; on app load, wipe CV state when the stored version is older than current. Prevents stale-localStorage-after-refactor bugs. (Still not implemented — no `storeVersion` in `lib/store/cvStore.ts`; versioning is timestamp-only.)

---

## 🟡 In active pipeline (agreed, not yet started)

- [ ] Weight tuning with real CVs — run 3–5 real CVs through the scoring engine and adjust weights if anything scores wrong. Characterization tests pin current behaviour, so changes are safe to make deliberately.
- [ ] Collect real social proof (stats, testimonials, hired-at logos) for the upload page hero + report page. Needs: real analytics for stats, a consent form for testimonials, verified hiring data for logos. GA4 now records `cv_export`, so the stats half is finally possible.

---

## 🟢 Next up

- [ ] Mobile builder polish pass
- [ ] DOCX support for the ATS Checker (still PDF-only — the builder exports DOCX, the checker cannot read it)
- [ ] Original / MakeMyCV template switcher inside the ATS Checker report page
- [ ] Author page + E-E-A-T improvements for Google Discover eligibility

---

## 🔵 Blocked on an account system

These cannot start until auth exists; auth itself is unscheduled.

- [ ] Account system (prerequisite for everything below)
- [ ] Saved CV system
- [ ] Server-side AI job-description optimization

---

## 📚 Long-term strategic backlog

- [ ] 11th CV template (10 shipped)
- [ ] Arabic / RTL support for UAE-market CVs

---

## ✅ Shipped

### 2026-08 — Premium reskin & instrumentation
- [x] 2026-08-20 — Premium design reskin: Outfit UI face, 3D-glass pill CTAs, floating-paper cards, glass logo lockup, mono retired from labels. CV output deliberately untouched via `--cv-font-*` decoupling.
- [x] 2026-08-20 — All five font families self-hosted (`app/fonts/app.ts`) — removes the build-time gstatic dependency that broke a sibling-repo deploy.
- [x] 2026-08-18 — Score delta pill wired (before/after movement, not just a static number)
- [x] 2026-08-17 — GA4 / GTM analytics + `cv_export` north-star event
- [x] 2026-08-04 — Import parser: letter-spaced headings no longer break section detection
- [x] 2026-08-03 — Builder guidance pass: fresh-grad Experience help, Education "Skip for now", preview empty-state ghost, pristine score-chip coaching
- [x] 2026-08-02 — CI (GitHub Actions: typecheck, lint, test on every push)
- [x] 2026-08-02 — `npm test` runtime cut from ~1 hour to ~6 seconds (19 tsc runs collapsed into one)
- [x] 2026-08-02 — ESLint to green (1570 problems → 0 errors)
- [x] 2026-08-02 — Sentry error tracking, analytics and a health endpoint
- [x] 2026-08-02 — Closed two silent CV data-loss paths; CV backup and restore added
- [x] 2026-08-02 — Stopped retaining client IPs; closed the rate-limiter fail-open
- [x] 2026-08-02 — New twin-peaks brand mark; SEO entity deferred to www.makemycv.ae

### 2026-07 — Consistency, templates & density
- [x] 2026-07-12 — Chrome-less template preview route + capture pipeline for all 10 templates
- [x] 2026-07-12 — Global daily AI spend cap + bounded KV-outage fallbacks
- [x] 2026-07-12 — Characterization test suite for the unified scoring engine
- [x] 2026-07-07 — Site-wide UI consistency pass (design-system foundations, button size tiers, one modal grammar, unified top bars, touch floors, 31 verified low-severity fixes)
- [x] 2026-07-07 — Emerald everywhere: the checker migrated off blue to one brand accent
- [x] 2026-07-03/04 — Design & Font panel: page margins, font size, line height and section spacing wired across every template and the PDF
- [x] 2026-07-03 — Professional, Onyx & Sandstone templates + contrast-safe colour intelligence for any accent
- [x] 2026-07-02 — Domain personalization (infer role family → confirm → tailored AI, bullets, skills)

### 2026-06 — JD Match
- [x] 2026-06-15 — JD Match: heatmap, guided Coach, per-job tailored CV + non-destructive download, split-view one-click fixes
- [x] 2026-06-14 — Premium top-bar buttons + score dial; segmented-focus stepper; industry-standard form semantics
- [x] 2026-06-13 — Import fix: two-column PDFs no longer import languages & certifications as skills

### 2026-04 — ATS Checker v1
- [x] 2026-04-19 — ATS Checker v1 (upload, parse, report, KV storage, 24h TTL) + client-side PDF parsing
- [x] 2026-04-19 — Unified score engine (`computeScore`): same score in Checker and Builder for the same CV
- [x] 2026-04-19 — Upload and report page visual polish; design tokens in globals.css

### 🧹 Cleanup (all four items closed)
- [x] 2026-06 — Removed the `@deprecated calculateScore` / `computeCheckerScore` shims from `lib/scoreEngine.ts`
- [x] 2026-08-20 — Removed the `upgradeStored()` legacy-KV adapter from `lib/resumeChecker/storage.ts` (24h TTL rolled over months ago)
- [x] 2026-08-20 — Removed the legacy alias fields (`category`, `label` on `ScoreCategory`; `status`, `issueCount` on `ScoreReport`) and migrated the two remaining consumers to `.id` / `.issueCounts`
- [x] 2026-08-20 — Removed ~20 dead CSS tokens (sidebar set, legacy back-compat aliases, retired blue palette, `--font-brand`)

---

## 🗄️ Superseded — do not revive without re-reading the decision

- ~~Pro Gate + payment integration (Lemon Squeezy / Paddle)~~ — superseded by the 2026-05-31 pivot to **free + voluntary support (tip jar)**. UAE trade-licence risk; see `DECISION_LOG.md`. The Pro/coupon scaffolding stays in the code deliberately — do not delete it.
- ~~Job Description Matching (server-side, needs auth)~~ — shipped 2026-06 as **client-side JD Match**; only `{jobText}` reaches the server, so no auth was needed.
- ~~Resume Tailoring section~~ — shipped as part of JD Match (per-job tailored CV + download).
- ~~AI Bullet Improvement~~ — shipped (`/api/ai-improve`, 3 free uses, spend-capped).
- ~~5th CV template~~ — shipped and passed; there are 10.
- ~~Static template thumbnail generation~~ — shipped 2026-07-12 (`scripts/capture-previews.js`, 10 PNGs in `artifacts/template-previews/`).
- ~~Marketing-site `/resume-checker` SEO landing page~~ — tracked in the sibling `makemycv-site` repo, not here.

---

## 🏛️ Governance

**How we use this file:**

1. Every commit that ships a feature should move its item to `✅ Shipped` with the date.
2. Every new task gets added to the appropriate section (🔴/🟡/🟢/🔵/📚) with one line of context.
3. When starting a new Claude Code session, reference this file: "Read ROADMAP.md first — then work on [task]."
4. Update `Last updated` on every meaningful change.
5. When a backlog item is overtaken by a decision or shipped in a different shape, move it to 🗄️ Superseded with the reason — don't silently delete it.
6. If an item stays in 🟡 (active pipeline) for more than 2 weeks, it either ships or moves back to 🟢/🔵 honestly.

**Principles:**

- Ship first, polish in public. Every day an item sits in "must do next" is a day of lost signal.
- No item in `✅ Shipped` without a commit/date. If you can't point to code, it didn't ship.
- The backlog is finite. If this file grows past 80 items, we have a focus problem, not a backlog problem.
- This file drifted four months once (2026-04 → 2026-08) and grew a backlog of things that were already built. Stale is worse than short.
