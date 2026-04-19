# MakeMyCV Roadmap

Last updated: 2026-04-19  
Source of truth for shipped features, active work, and backlog. Update on every completed task.

---

## 🔴 Must do next (blocking)

- [ ] Merge `stagingmmc` → `main`, deploy to production
- [ ] Verify `app.makemycv.ae/resume-checker` works end-to-end on live domain

---

## 🟡 In active pipeline (agreed, not yet started)

- [ ] ATS Checker report page — visual polish (match Enhancv product-feel, fix "vibe-coded" feel)
- [ ] Marketing site — `makemycv.ae/resume-checker` SEO landing page (separate repo: `makemycv-site`)

---

## 🟢 Next up (post-polish)

- [ ] Store schema versioning — bump `storeVersion` number; on app load, if stored version is older than current, wipe CV state. Prevents stale-localStorage-after-refactor bugs.
- [ ] Weight tuning with real CVs — test 3–5 real CVs against the scoring engine, adjust weights if anything scores incorrectly. Only tested with founder's CV so far.

---

## 🔵 Scheduled for v2

- [ ] Original / MakeMyCV template switcher inside the ATS Checker report page
- [ ] DOCX support for ATS Checker (PDF-only in v1)
- [ ] Resume Tailoring section (paste JD → match) — overlaps with Job Description Matching roadmap item; implement together
- [ ] Job Description Matching feature (server-side, requires auth system as prerequisite)

---

## 🧹 Cleanup (safe to do anytime 25h+ after production deploy)

- [ ] Remove `@deprecated calculateScore` shim from `lib/scoreEngine.ts`
- [ ] Remove `@deprecated computeCheckerScore` shim from `lib/scoreEngine.ts`
- [ ] Remove `upgradeStored()` legacy-KV adapter from `lib/resumeChecker/storage.ts`
- [ ] Remove legacy alias fields (`category`, `label` on `ScoreCategory`; `status`, `issueCount` on `ScoreReport`) from `lib/resumeChecker/types.ts`

---

## 📚 Long-term strategic backlog

- [ ] AI Bullet Improvement feature (scoping already done: 3 free uses via localStorage, 2–3 variations per rewrite)
- [ ] Pro Gate + payment integration — Lemon Squeezy recommended (Stripe not viable without registered UAE business, Paddle viable alternative)
- [ ] 5th CV template
- [ ] Static template thumbnail generation (PNG renders) for marketing site `/templates` gallery
- [ ] Account system (prerequisite for saved CVs and server-side AI features)
- [ ] Saved CV system (requires account system)
- [ ] Author page + E-E-A-T improvements for Google Discover eligibility
- [ ] Mobile builder polish pass
- [ ] Fifth CV template
- [ ] Server-side AI job description optimization (requires auth system)

---

## ✅ Shipped

- [x] 2026-04-19 — ATS Checker v1 (upload, parse, report, KV storage, 24h TTL)
- [x] 2026-04-19 — Client-side PDF parsing (switched from server-side pdfjs after Turbopack worker bug)
- [x] 2026-04-19 — Unified score engine (`computeScore` replaces split `calculateScore` / `computeCheckerScore`; same score in Checker and Builder on same CV)
- [x] 2026-04-19 — Field mapper improvements (headline seeded from current role)
- [x] 2026-04-19 — Score pill repositioning (bottom-right, paired with Preview CV)
- [x] 2026-04-19 — Reset All Counters moved bottom-left with hardened dev-only gate
- [x] 2026-04-19 — Template thumbnails fixed on Review step (A4 portrait, 2-col desktop / 1-col mobile)

---

## 🏛️ Governance

**How we use this file:**

1. Every commit that ships a feature should move its item from the pipeline sections to `✅ Shipped` with the date.
2. Every new task gets added to the appropriate section (🔴/🟡/🟢/🔵/📚) with one line of context.
3. When starting a new Claude Code session, reference this file: "Read ROADMAP.md first — then work on [task]."
4. Update `Last updated` on every meaningful change.
5. Cleanup items in 🧹 are safe to batch — do them together on a quiet day.
6. If an item stays in 🟡 (active pipeline) for more than 2 weeks, it either ships or moves back to 🟢/🔵 honestly.

**Principles:**

- Ship first, polish in public. Every day an item sits in "must do next" is a day of lost signal.
- No item in `✅ Shipped` without a commit/date. If you can't point to code, it didn't ship.
- The backlog is finite. If this file grows past 80 items, we have a focus problem, not a backlog problem.
