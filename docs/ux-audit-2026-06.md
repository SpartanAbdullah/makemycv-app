# UX/UI Audit — makemycv-app (app.makemycv.ae)

**Date:** 2026-06-10 · **Branch:** `stagingmmc` · **Mode:** read-only (this report is the only file output)
**Method:** 13-agent audit — 7 code-mapping passes, 2 live-site fetches (app.makemycv.ae verified; cvtoolspro.com rendered via browser), 4 pillar reviews. Every claim carries a file:line reference.

---

## 1. Executive summary

We beat the baseline (cvtoolspro = a ResumeDone white-label funnel with an AED 5.99 → AED 144.99/mo trial-rebill) on everything that matters ethically and structurally: one-click entry into the builder, no account, downloads never gated, tips suppressed 90 days after one interaction, real UAE depth (visa status, attestation bodies, language chips) competitors don't have, and a genuinely well-code-split bundle (every heavy lib loads on first use, not first paint). SSR safety is clean — zero unsafe patterns found.

Where we fall short: **(1) honesty leaks** — a fabricated "Top N% in UAE" percentile and an unsubstantiated "DIFC firms, UAE banks, government entities" claim sit on our two highest-trust surfaces (P0, both trivially fixable copy); **(2) the scoring system is three systems** — engine, zod step-completion, and ad-hoc ReviewStep math disagree by construction, producing every reported contradiction; **(3) the flow punishes edge users** — fresh graduates cannot pass the required Experience step, four steps fail Continue silently, and skipped steps lock; **(4) the strongest true differentiator (fully client-side builder) is stated nowhere** while the AI features that DO send data server-side are undisclosed; **(5) chrome runs four competing primary colors** and 8 of 10 steps have no heading.

### Stale assumptions in the brief, corrected by evidence

| Brief said | Reality |
|---|---|
| Primary brand Indigo-600 #4F46E5, Plus Jakarta Sans, dark sidebar #0F172A | False on all three. Canonical system is Focus Flow: UAE green `--ff-accent` #0E7C4A (app/globals.css:10-13, 32), display font Bricolage Grotesque (globals.css:107); the sidebar was removed (globals.css:71-76). Indigo survives only as 6 unmigrated legacy files. |
| Homepage `0+` / `0.0s` / `< 0 min` placeholder stats | **Not in this repo.** `app/page.tsx:4` is a bare 308 redirect to /builder. The placeholders live in the separate `makemycv-site` repo (ROADMAP.md:17) — verified absent here by exhaustive grep and by live fetch of app.makemycv.ae. Replacement copy is proposed in §5 anyway. |
| Ko-fi `/support` and `/thanks` pages | Not in this repo — they're marketing-site pages (lib/config/support.ts:8, DECISION_LOG.md:30-32). This repo's tip surfaces: TipJar/TipJarModal, DownloadTipModal (post-download), PostReportTipJar (post-report), AI rate-limit nudge, "Built by Abdullah" footer links. |
| "Browser print" export flow | Dead. No `window.print()` anywhere; export is fully client-side @react-pdf/renderer via hooks/useDownloadCV.ts (docs/cv-schema-reference.md:336). ~115 lines of vestigial print CSS still ship (globals.css:757-864). |
| LinkedIn import + `NEXT_PUBLIC_LINKEDIN_IMPORT` flag (project memory) | Deleted in commit 694c314 (2026-05-24). `lib/importers/` has no linkedinAdapter; the flag has zero references. |

---

## 2. Pillar-by-pillar findings

Severity: **P0** = liability/broken/blocking · **P1** = significant friction · **P2** = polish.
Risk tier: **GREEN** = copy/spacing/colors/standalone components · **AMBER** = form flow or store · **RED** = print/PDF, parsing engine, or score engine.
IDs are stable — use them in your strike-list.

### Pillar 1 — Performance & technical friction

What's already good: all heavy deps (@react-pdf/renderer, pdfjs-dist, mammoth, docx) are dynamic-imported on first interaction with zero static leaks (hooks/useDownloadCV.ts:25-27, lib/importers/pdfAdapter.ts:122, docxAdapter.ts:15, lib/utils/docxExport.ts:9); keystrokes never hit the store directly (react-hook-form + 250ms debounce, e.g. PersonalStep.tsx:80-96) with a further 500ms autosave debounce; step forms use sliced selectors; page roots are proper server components; static assets are near-zero (inline SVGs, 437-724-byte logos).

| ID | Sev/Tier | Finding | Evidence |
|---|---|---|---|
| **PERF-1** | P1/AMBER | Hidden desktop preview drawer mounts + re-renders the full A4 template on every phone; in mobile preview mode a **second** full instance mounts — two complete template trees re-render per 250ms commit on the lowest-powered devices. No `React.memo` anywhere in the repo. | BuilderShell.tsx:1010-1021 (`hidden xl:block`, CSS-hidden not unmounted), PreviewPanel.tsx:16 (whole-store subscribe), :37; second instance BuilderShell.tsx:1003-1007, :556 |
| **PERF-2** | P1/GREEN | Font pipeline loads 8 families, ships ≥4 as dead weight (Sora, Fraunces, Poppins, Plus Jakarta — ~110KB+ preloaded, never painted), Inter is double-loaded, and the 4 fonts that DO paint arrive via a render-blocking third-party `@import` chain with zero preconnect hints. | app/layout.tsx:8-45, app/globals.css:7, :107-112; Logo uses SVGs not Poppins (components/Logo.tsx:7-12) |
| **PERF-3** | P2/AMBER | BuilderShell subscribes to the whole store and on every debounced commit re-runs the 1,238-line `computeScore` + an O(n²) step-completion scan, just to feed a TopBar chip whose popover is closed; ReviewStep duplicates the same `computeScore` call so the engine runs twice per commit on the review step. No `useDeferredValue`/`useTransition` in the repo. | BuilderShell.tsx:660, :698-718, :721-728; ReviewStep.tsx:98-105 |
| **PERF-4** | P2/AMBER | Review step renders **six complete live A4 template instances** as gallery thumbnails; every accent-swatch click re-renders all six. Lightweight skeleton Thumbnails already exist (lib/templates/index.tsx:19-152) and are unused. | ReviewStep.tsx:476-493, TemplateThumb :31-77; CustomizePanel.tsx:106 |
| **PERF-5** | P2/GREEN | Three orphan routes ship live client bundles with **zero inbound links**: `/export`, `/templates`, `/preview` (grep-verified). Worse: ExportClient.tsx:16 still calls `downloadCV(data, "free")`, so an old bookmark yields a PDF stamped "Created with MakeMyCV.ae — Free Plan" months after paywall removal. `components/ScoreWidget.tsx` is never imported, making `/builder?step=score` URL-only. | app/export/ExportClient.tsx:16; CVDocument.tsx:2098-2102; ScoreWidget.tsx:23 |
| **PERF-6** | P2/AMBER | /builder first-load JS statically bundles ~2,500 lines no first-time user executes: MappingReview (743 lines, rendered only mid-import), textParser (816 lines, pulled eagerly via static adapter imports), ScorePanel (571 lines, for the unreachable score step). | BuilderShell.tsx:14-16; BuilderClient.tsx:17 |
| **PERF-7** | P2/GREEN | Mobile: fixed Edit\|Preview toggle (bottom 62px, z-50) overlaps the form's last controls — edit mode reserves only 32px bottom padding vs preview mode's 96px; and the 10-bead strip hides its scrollbar with no scrollIntoView, so mid-flow the active bead is off-screen on a 380px viewport. | BuilderShell.tsx:586-601, :1098-1102, :528; StepBeads.tsx:43-44 |
| **PERF-8** | P2/RED | PDF text extraction loads its pdf.js worker from **cdnjs.cloudflare.com at the exact moment a user uploads** — corporate networks/ad-blockers break both import paths with only a generic error. The file's own header admits it ("swap for local path"). | pdfAdapter.ts:124-126; consumed by BuilderShell.tsx:789-794 and UploadDropzone.tsx:82 |
| **PERF-9** | P2/GREEN (deferred) | ~115 lines of dead browser-print CSS + the `cv-print`/`avoid-break` hook classes ship on every page for a path nothing invokes. Bundle removal with the deferred print rewrite. | globals.css:757-864, :903-909; classic.tsx:21-22, 112 etc. |

### Pillar 2 — UX: the building flow

What's already good: fastest onboarding in the category (/ 308-redirects into the form; first keystroke is one click away vs the competitor's 4-screen funnel with smuggled account creation); upload-vs-blank fork is the first thing on the first step; mobile preview is the real 794px A4 scaled (WYSIWYG, not a reflowed approximation); builder import is human-reviewed via MappingReview with swap buttons and Replace/Merge; UAE depth competitors lack (visa dropdown with Golden/Green Visa, MOFA/HEC/WES/DataFlow attestation list, language quick-add chips); "Skip for now" already exists on optional steps.

| ID | Sev/Tier | Finding | Evidence |
|---|---|---|---|
| **UX-1** | P1/AMBER | **Step beads lock out every incomplete step** — a user who skips UAE Essentials can't click back to it; recovery is pressing Back N times. Meanwhile the Review bead always shows a green ✓ (completion hardcoded `true`), implying a blank CV is done. Active bead never scrolls into view on mobile. | StepBeads.tsx:80; BuilderShell.tsx:707-715; stepValidation.ts:51-52 |
| **UX-2** | P1/AMBER | **Fresh graduates cannot pass the required Experience step**: schema demands ≥1 role with company+role+startDate+1 bullet ≥3 chars, no Skip prop, last role card can't be deleted, no "internships count" guidance. All later beads then show locked. A huge share of UAE job seekers hit a hard wall. | cvSchemas.ts:27-42; steps.ts:36-41; BuilderClient.tsx:77-82; ExperienceStep.tsx:362, :656-660 |
| **UX-3** | P1/AMBER | **Continue fails silently on 4 steps** (Certifications, Projects, Languages, UAE Essentials) — they never render validation errors. Worse: UAE Essentials binds the FULL personalSchema, so an invalid firstName (e.g. from an import) silently kills Continue on a screen that doesn't even show that field. Reads as "the app is broken". | CertificationsStep.tsx:37, ProjectsStep.tsx:38, LanguagesStep.tsx:216, UAEEssentialsStep.tsx:61-65 |
| **UX-4** | P1/AMBER (label fix GREEN, real fix RED) | Import button promises "PDF / DOCX" but hardcodes `handleImport("pdf")` — the picker accepts only PDF. docxAdapter is fully implemented dead code. Word-CV users (very common in UAE) hit a dead end on their first click. | PersonalStep.tsx:113-114; BuilderShell.tsx:784-787; docxAdapter.ts:8-24 |
| **UX-5** | P1/GREEN | **"Copy share link" copies a URL containing no CV** — the CV lives only in the sender's localStorage. A job seeker may believe they shared their CV with a recruiter; the recipient opens an empty builder. | ReviewStep.tsx:133-142, :423-431 |
| **UX-6** | P1/AMBER | **Education entries silently vanish** until BOTH school AND degree are filled — the form→store filter drops half-entered rows on unmount (navigate away = typed data gone). Every other step filters on `id` only. Silent data loss on a required step. | EducationStep.tsx:77-79 vs ExperienceStep.tsx:170-172 |
| **UX-7** | P1/GREEN | **8 of 10 steps render no heading or context** — orientation rests on a 12px bead label that can be off-screen. No "Step X of 10" anywhere. The per-step `atsTip` strings already written in steps.ts are rendered nowhere (dead content). | grep: cv-step-heading only in UAEEssentialsStep.tsx:101, ReviewStep.tsx:194; steps.ts:18-74 |
| **UX-8** | P1/RED | **Report→builder import bypasses MappingReview** and silently replaces the builder CV when empty; the confirm modal offers blind Replace/Keep with no preview. The AI parser falls back to the same heuristic parser, so misassignments are just as likely — without the review safety net the heuristic path requires. User is never told visa/notice/nationality can't be parsed. | ImportFromReportBanner.tsx:100-102, :136-173; parse.ts:241-284 |
| **UX-9** | P2/AMBER | UAE field audit: visa status ✓, notice period ✓ (but labeled "Availability" while every other surface says "notice period"), driving licence ✓, languages ✓, photo ✓. **Missing:** structured emirate select (location is free-text "City" though emirate is a primary Bayt/NaukriGulf filter and textParser already has the emirate list internally); nationality exists but is buried in "Extras" and excluded from UAE-essentials completion despite being a hard pre-screen field. | UAEEssentialsStep.tsx:161-199, :302-317; PersonalStep.tsx:232-248; stepValidation.ts:21-32; textParser.ts:83-128 |
| **UX-10** | P2/GREEN | The only photo/ATS guidance in the product is mathematically unreachable (universal tip shadowed by step-scoped tips on the only steps that mount the tip card). PhotoUpload says only "JPG, PNG or WebP · max 5MB". | tips.ts:120-125, :196-197; PhotoUpload.tsx:227-239 |
| **UX-11** | P2/GREEN | Auto-save chip lies: "auto-saved just now" is a hardcoded string on a 30s timer wired to nothing — it would still say "saved" if the localStorage write failed. And nothing anywhere tells the user the CV lives only in this browser. | BuilderShell.tsx:133-139 |
| **UX-12** | P2/GREEN | Education starts collapsed ("Education 1" card, extra discovery step on a REQUIRED step) while Experience starts expanded; the Notes placeholder is "e.g. Sharjah" — a location example in a notes field. | EducationStep.tsx:46, :136, :213 vs ExperienceStep.tsx:38 |
| **UX-13** | P2/GREEN | Reordering: skills are drag-only (HTML5 drag doesn't fire on touch — no mobile reorder at all); education/certifications/projects have no reorder; Experience's "Move up/down" buttons render sideways chevrons. | SkillsStep.tsx:281-285; EducationStep.tsx:61-64; ExperienceStep.tsx:346-361 |
| **UX-14** | P2/GREEN | "Improve all with AI" improves only the first role (`improveAllWithAI()` = `handleGenerateBullets(0)`). With the 3/60s + 10/24h rate limit, the honest fix is the label. | ExperienceStep.tsx:233-236 |
| **UX-15** | P2/GREEN | Experience's inline AI errors drop the support link and rate-limit explanation the modal flow gets — raw `error.message` in red text, no retry. | ExperienceStep.tsx:570-580 vs AIResultsModal.tsx:303-346 |
| **UX-16** | P2/GREEN | High-register idiomatic microcopy taxes the stated target user (non-native speakers): "Mirrors the role you want, not the one you held", "drop down the pile", 43-word summary placeholder, programmer jargon ("not the same string to an ATS"). | PersonalStep.tsx:214; SummaryStep.tsx:142; tips.ts:60, :88, :109, :164 |
| **UX-17** | P2/GREEN | MappingReview never says what could NOT be read — no confidence indication, no notice that visa/notice-period/nationality/projects are never extracted. Users assume the import got everything and skip UAE Essentials. | MappingReview.tsx:218-220; adapter.ts:39-47 |
| **UX-18** | P2/RED | Import parse failures can never reach the error bar — both adapters swallow errors into `{}` (success-shaped), so every failure (corrupt file, scanned PDF) lands in a demoralizing "No fields could be extracted" with no differentiation or next step. BuilderShell's error UI is dead code. | pdfAdapter.ts:152-155; docxAdapter.ts:19-22; BuilderShell.tsx:796-802 |
| **UX-19** | P2/GREEN | Phone is marked required but the schema allows empty — label overstates or validation understates (the app's own tip says UAE recruiters dial WhatsApp). | PersonalStep.tsx:249; cvSchemas.ts:8 |
| **UX-20** | P2/GREEN | Optional steps (Certifications, Projects) open as a bare Add button with no empty-state value framing, though the tips data contains exactly the right UAE-specific motivation (PMP/NEBOSH/DHA). SkillsStep already has the right pattern. | CertificationsStep.tsx:85-99; ProjectsStep.tsx:124-137; tips.ts:93-98 |
| **UX-21** | P2/GREEN | Dead `?step=score` surface: a full third score UI reachable only by hand-typing the URL (its only navigator, ScoreWidget, is never imported). | BuilderClient.tsx:119; ScoreWidget.tsx:46 |

### Pillar 3 — UI & visual critique

What's already good: a real tokenized design system exists and is adopted — Focus Flow tokens drive `.cv-input/.cv-select/.cv-label/.cv-btn-*` consistently across all 10 step forms (one height, one radius, one border spec); the Classic template + PDF twin are genuinely ATS-safe where it counts (single column, standard section names, real text, Helvetica, PDF drops the live emoji); form-control focus rings are strong; checker typography is the most coherent surface in the app.

| ID | Sev/Tier | Finding | Evidence |
|---|---|---|---|
| **UI-1** | P1/GREEN | **Four competing primary colors in chrome.** Full inventory: UAE green #0E7C4A — 21 raw + 43 token uses across 18 files (canonical); indigo-600/#4F46E5 — 39 uses in 9 files, of which 6 chrome files are unmigrated legacy (AIResultsModal ×15, ScorePanel ×7, LanguagesStep dropdown ×5, ImportFromReportBanner ×3, TipJar ×3, DownloadTipModal ×2); ink-black #0B0F0C button fills (TopBar Download, active beads — intentional); checker blue #2563EB — 19 uses in 8 resume-checker files (coherent sub-brand). Brand-pack navy/gold/cream tokens have **zero consumers**. **Verdict: standardize builder chrome on `--ff-accent` #0E7C4A; migrate the 6 indigo legacy files; keep checker blue as the documented acquisition sub-brand; do not adopt navy/gold as chrome.** | globals.css:10-13, :32-35, :117-120, :146-159; per-file counts above |
| **UI-2** | P1/GREEN | The primary action renders in 4 different colors depending on surface; the same Download action is black in the TopBar and green in the drawer/ReviewStep. Three button systems coexist (design-system classes ×27, inline style objects for the whole shell, Tailwind soup) plus near-namesake classes `.btn-primary` (blue gradient) vs `.cv-btn-primary` (green). No shared Button component. | NavigationButtons.tsx:55; BuilderShell.tsx:207-248, :381; AIResultsModal.tsx:96; globals.css:316 vs :872 |
| **UI-3** | P1/GREEN | 8 of 10 steps have no heading (no h1 landmark for screen readers); where `.cv-step-heading` IS used it appears at three different sizes (32px spec, 28px override, 42px override); checker uses an unrelated Tailwind ramp — two heading scales in one product. | globals.css:566-574; UAEEssentialsStep.tsx:102; ReviewStep.tsx:196 |
| **UI-4** | P1/GREEN | **`focus-visible` appears zero times in the repo.** Buttons in all three systems author no focus style (browser default only); the few `focus:` uses are `outline-none` + faint border swap; LanguagesStep rings indigo in a green app. Inputs ring on `:focus` (mouse clicks ring too). | grep: 0 matches; AIResultsModal.tsx:79; MappingReview.tsx:297; LanguagesStep.tsx:135 |
| **UI-5** | P1/GREEN | Primary mobile controls miss the 44px touch floor: Edit\|Preview toggle ≈34px (THE primary mobile control), TopBar Download ≈33px, beads ≈27-29px, ScoreChip ≈30px, error-bar Dismiss ≈15px bare text, skill-chip remove 16×16, swatches 24×24. | BuilderShell.tsx:616, :198, :217, :892-909; globals.css:548-550, :626-651; CustomizePanel.tsx:166-167 |
| **UI-6** | P1/AMBER | Field labels are never programmatically associated — the shared Field wrapper renders `<label>` without `htmlFor`; every labeled input flows through it. Tapping a label doesn't focus; screen readers announce unlabeled fields. | components/forms/Field.tsx:50-83, :113-116 |
| **UI-7** | P1/AMBER | Orphan `/export` still hands out PDFs watermarked "Created with MakeMyCV.ae — Free Plan" (opacity 0.3, every page) — `downloadCV` defaults `plan="free"` and ExportClient passes "free". There is no paid plan; no PDF should carry this. (Deleting the route in Wave 1 removes the trigger; the default flip is a Wave 2 one-liner.) | ExportClient.tsx:16; useDownloadCV.ts:21; CVDocument.tsx:242-248, :2101-2103 |
| **UI-8** | P1/RED | **Customize panel sells controls that don't work**: Font scale writes `settings.fontScale` which **no renderer consumes** (slider does nothing, live or PDF); Accent no-ops on Classic/Modern (Classic ignores theme.accent; Modern hardcodes emerald); Font family changes the preview but the PDF is hardwired Helvetica — WYSIWYG violation at the moment of highest trust. Panel copy promises "Apply across all templates. Live preview updates as you tweak." | CustomizePanel.tsx:17-21, :150; theme.ts:29 (no consumers); classic.tsx:11-13, :113; modern.tsx:114-116; CVDocument.tsx:100 |
| **UI-9** | P2/RED | Classic template: solid ATS core but (a) Languages/Certifications share a 2-col grid in BOTH renderers — the only multi-column trap in an otherwise clean template; (b) live contact row renders emoji icons the PDF correctly drops (preview≠PDF); (c) name renders 28px live vs 30px-equivalent in the PDF (~7% drift). | classic.tsx:308, :54-92, :132; CVDocument.tsx:225-230, :590, :117 |
| **UI-10** | P2/GREEN | Sidebar templates (Executive, Corp Sidebar) are structurally ATS-risky (two-column with sidebar contact/skills) but the gallery carries no ATS-safety signal — a user can pick Executive for a bank application unknowingly. Fix is labeling (badges in the registry), not restructuring. | executive.tsx:146-147; corp-sidebar.tsx:77; lib/templates/index.tsx |
| **UI-11** | P2/RED | Template accent drift: ModernPDFLayout fallback `#4F46E5` vs live `#1e5b54` (latent — surfaces when accentColor is empty); executive.tsx hardcodes indigo skill dots that ignore theme.accent; two navies one hex digit apart (#1E2A4A vs #1B2A4A vs --brand-navy). | CVDocument.tsx:1186; modern.tsx:14; executive.tsx:316, :629, :90; exec-split.tsx:67 |
| **UI-12** | P2/GREEN | Languages proficiency dropdown is a pre-redesign artifact (gray borders, indigo states, off-system radii) — the most jarring input inconsistency mid-flow. (Folded into UI-1's migration list.) | LanguagesStep.tsx:130-191 |

### Pillar 4 — Engagement, trust & conversion

What's already good: monetization ethics are best-in-class vs baseline (downloads never gated, 90-day tip suppression, escape-hatch dismissal, tip surfaces hidden in print CSS); time-to-value is genuinely strong (~11 required fields + 1 click on the manual path; ~4 clicks on the import path); an honesty-by-design culture exists in code (JSON-LD "no fabricated stats" rule, example report code-commented as placeholder, ROADMAP defers social proof until real data); the post-download tip moment is correctly placed.

| ID | Sev/Tier | Finding | Evidence |
|---|---|---|---|
| **ENG-1** | **P0/GREEN** | **Fabricated UAE-market percentile shown to every user at the conversion moment**: "You're scoring above {min(round(score×0.95),97)}% of CVs in the UAE market" and "Top {N}% in UAE" — arithmetic on the user's own rubric score dressed as market data. No percentile dataset exists. UAE Federal Law 15/2020 misleading-claims exposure. | ReviewStep.tsx:206-209, :295-297 |
| **ENG-2** | **P0/GREEN** | **Unsubstantiated "DIFC firms, UAE banks, and government entities" parser claim ×4** on the only indexable page (meta description, hero, answer paragraph, FAQ). Nothing substantiates which ATS parsers were tested; the actual mechanism is pdfjs text extraction + Claude parsing. Highest-exposure unverifiable claim in the product. | app/resume-checker/page.tsx:16, :92, :142-143, :153-155 |
| **ENG-3** | P0/GREEN (other repo) | Placeholder stats (`0+`/`0.0s`/`< 0 min`) verified **absent from this repo** — they live in makemycv-site. Replacement copy per slot: ① "Built for the 2026 UAE hiring season" ② "PDF generated in your browser — no upload, no queue" ③ "Free. No sign-up. Optional tip jar." Never reintroduce counters until ROADMAP.md:25's real-analytics prerequisite is met. | ROADMAP.md:17, :25 |
| **ENG-4** | P1/GREEN | "All six are ATS-tested and used by UAE recruiters" — "used by UAE recruiters" implies third-party adoption with zero substantiation, at the same conversion moment as ENG-1. | ReviewStep.tsx:471 |
| **ENG-5** | P1/GREEN | Tip-card citations claim precise unverifiable datasets ("1,200+ Bayt & LinkedIn UAE listings", "850 UAE operations CVs") while the file's own header bans vague sourcing. Precise-sounding fake-verifiable is worse than honest soft framing. | tips.ts:8-10, :33, :61, :47, :89 |
| **ENG-6** | P1/GREEN | **The builder has zero privacy copy despite being fully client-side** — the strongest true differentiator is unstated where users type their entire identity, while the checker page makes detailed promises. Must be scoped honestly: builder/import/export are local; AI improve is the exception. | grep: privacy copy only on checker; cvStore.ts, useDownloadCV.ts, pdfAdapter.ts:117-141 all verifiably local |
| **ENG-7** | P1/GREEN | **AI-improve sends CV content to a third-party AI with zero disclosure** — headline, roles, bullets, skills, summary POST to /api/ai-improve → Anthropic. No button/modal mentions it. Must land together with ENG-6 or the privacy claim becomes false. PDPL-style transparency expects this. | hooks/useAIImprove.ts:7-16; route.ts:189-197; SummaryStep.tsx:175-181 |
| **ENG-8** | P1/GREEN | "Reports are anonymous and auto-delete in 24 hours" is materially imprecise — the H1 above it prints the user's first name, and the stored report (full parsed CV incl. contact details) is readable by anyone with the URL via unauthenticated endpoints. | report/[reportId]/page.tsx:103-109; import/[reportId]/route.ts:9-33 |
| **ENG-9** | P1/GREEN | Checker FAQ omits the Anthropic forwarding + 24h rawText storage in KV, AND fails to state its strongest true fact: **the PDF file itself never uploads** (browser extracts text; only text is sent). | page.tsx:84; parse.ts:218-231; parse/route.ts:104-113; UploadDropzone.tsx:82, :102-106 |
| **ENG-10** | P1/GREEN | Post-report tip modal fires 1.5s after report mount — before the user has read a single category card; on mobile it covers the report. Wrong trigger, right machinery. The download modal (true post-value) is correctly placed. | PostReportTipJar.tsx:15-18 |
| **ENG-11** | P1/AMBER | TopBar Download is enabled from the first second on an empty store — a first-time user taps the most prominent button and gets a blank-template PDF with zero guard. `getStepCompletion` already knows; nothing consults it. | BuilderShell.tsx:755-768, :829-835 |
| **ENG-12** | P1/GREEN | /resume-checker (the acquisition page) contains exactly two anchors — logo and #dropzone. The FAQ advertises "the report and the builder are both free" without linking the builder. A visitor unwilling to upload has no path into the product. | page.tsx:88, :279-291 (verified against live HTML) |
| **ENG-13** | P2/GREEN | Tip emotional frame is split: TipJar says "Tips help cover hosting and AI costs" (utility-bill frame) vs DownloadTipModal's "keeps it free for the next person" (the preferred pay-it-forward frame). "Tip" wording ✓ everywhere; no amount picker ✓ by design. Mirror any TipJar change in makemycv-site (dual-path rule). | TipJar.tsx:98 vs DownloadTipModal.tsx:305 |
| **ENG-14** | P2/GREEN | Ko-fi page settings ($3 default / $1 min / contributor toggle OFF) are delegated to the Ko-fi dashboard and **cannot be verified from code** — needs a manual dashboard check; document the contract in .env.example. | TipJar.tsx:8-11, :29; .env.example:12-15 |
| **ENG-15** | P2/GREEN | "30 seconds" hard speed promise ×6 with no measurement (route allows 60s; progress copy is cosmetic timers). Only one instance hedges with "about". | page.tsx:16, :22, :139, :155, :173, :290; UploadDropzone.tsx:39-49, :289 |
| **ENG-16** | P2/GREEN | Example report card ("Aisha K. · 82/100") has no in-card "EXAMPLE" label — the only framing is a caption outside the card; skimmers read it as real social proof. | ExampleReportPreview.tsx:6, :41-43; page.tsx:172-174 |
| **ENG-17** | P2/GREEN | Report ShareButton copies a URL that exposes the full parsed CV to anyone with the link, with no hint to the user. Legitimate feature (nanoid-16), missing one line of informed consent. | ShareButton.tsx:8-17 |
| **ENG-18** | P2/GREEN | Shareability (3 proposed hooks, all client-side, no accounts, no dark patterns): ① WhatsApp-first `navigator.share` on both existing share surfaces (UAE is WhatsApp-first); ② a score share-card PNG rendered to canvas ("My CV scores 78/100 · UAE-ready · makemycv.ae" — shares the number, never the CV); ③ "Can't tip? Sharing helps too →" as a third exit in the AI rate-limit modal. | DownloadTipModal.tsx:143-150; ShareButton.tsx; AIResultsModal.tsx:304-330 |
| **ENG-19** | P2/GREEN | SEO/share metadata defects on the live page (verified by fetch): duplicated title suffix ("… \| MakeMyCV \| MakeMyCV"), missing `og:image` on /resume-checker (page-level openGraph replaces the layout's wholesale — WhatsApp/LinkedIn previews get no image on the shareable page), twitter tags not overridden (title mismatch). | live fetch + app/resume-checker/page.tsx:13-26 vs layout.tsx:47-126 |

---

## 3. Wave plan

Every item lists: one-line implementation note → files touched. Strike anything you disagree with before firing the wave prompt.

### Wave 1 — GREEN only (copy, color, focus, standalone components, dead-code deletion)

**Honesty & trust (do these first — two are P0):**
| Item | Implementation note | Files |
|---|---|---|
| ENG-1 | Replace both percentile lines with honest rubric framing ("Your CV scores {total}/100 on our UAE hiring rubric…") | components/builder/steps/ReviewStep.tsx |
| ENG-2 | Rewrite all 4 DIFC/banks/gov instances to describe the verifiable mechanism ("We read your CV the way ATS software does — raw text extraction and section detection") incl. meta description | app/resume-checker/page.tsx |
| ENG-4 | "All six use single-column-safe, text-first layouts that ATS parsers read cleanly." | components/builder/steps/ReviewStep.tsx:471 |
| ENG-5 | Reword count-bearing citations to honest provenance without fabricated precision | lib/data/tips.ts |
| ENG-15 | Standardize to "about 30 seconds"; trust chip → "Results in under a minute" | app/resume-checker/page.tsx, components/resume-checker/UploadDropzone.tsx |
| ENG-16 | Add in-card "EXAMPLE REPORT" pill; "Example: Marketing Manager CV" instead of a human name | components/resume-checker/ExampleReportPreview.tsx |
| ENG-6 + ENG-7 + UX-11 (land together) | Builder privacy copy: TopBar chip "saved on this device" (and stop faking the timestamp), import-button subtext "Your file is read in this browser — never uploaded", footer line with the honest AI exception; one identical disclosure line under each AI button | components/builder/BuilderShell.tsx, components/builder/steps/PersonalStep.tsx, SummaryStep.tsx, ExperienceStep.tsx, SkillsStep.tsx |
| ENG-8 | "Not linked to any account. Anyone with this link can view it until it auto-deletes in 24 hours." | app/resume-checker/report/[reportId]/page.tsx:108-109 |
| ENG-9 | Rewrite FAQ answer: file never uploads + Anthropic disclosure + 24h; keep FAQPage JSON-LD in sync | app/resume-checker/page.tsx |
| ENG-17 | Share-link hint: "Anyone with this link can view your report until it expires (24h)" | components/resume-checker/ShareButton.tsx |
| UX-5 | Relabel "Copy share link" → "Share MakeMyCV", copy https://makemycv.ae, prefer navigator.share | components/builder/steps/ReviewStep.tsx |
| UX-4 (label half) | Label → "Import existing CV (PDF)" + "DOCX coming soon — export as PDF first" (real DOCX wiring = Wave 3) | components/builder/steps/PersonalStep.tsx:113 |

**Conversion & engagement:**
| Item | Implementation note | Files |
|---|---|---|
| ENG-10 | Replace mount-timer with IntersectionObserver on last CategoryCard OR 45s dwell | components/resume-checker/PostReportTipJar.tsx, report page (sentinel ref) |
| ENG-12 | Link "the builder" in FAQ + secondary CTA "No CV yet? Build one free →" | app/resume-checker/page.tsx |
| ENG-13 | TipJar body → pay-it-forward frame; **mirror in makemycv-site** | components/TipJar.tsx:98 |
| ENG-14 | Document Ko-fi dashboard contract ($3/$1/contributor OFF) as comments; verify dashboard manually | .env.example |
| ENG-18 | navigator.share on both share surfaces; new ShareScoreCard canvas component behind a "Share your score" link; rate-limit modal third exit | components/DownloadTipModal.tsx, components/resume-checker/ShareButton.tsx, new components/ShareScoreCard.tsx, components/AIResultsModal.tsx |
| ENG-19 | Fix duplicate title suffix, add og:image + twitter overrides to /resume-checker metadata | app/resume-checker/page.tsx, app/layout.tsx |

**Visual consistency & a11y:**
| Item | Implementation note | Files |
|---|---|---|
| UI-1 + UI-12 + (UX-15 styling part) | Migrate 6 legacy indigo chrome files to --ff-accent tokens; keep checker blue; don't touch templates/PDF | components/AIResultsModal.tsx, components/ScorePanel.tsx, components/builder/steps/LanguagesStep.tsx, components/builder/ImportFromReportBanner.tsx, components/TipJar.tsx, components/DownloadTipModal.tsx |
| UI-2 | Recolor TopBar Download to --ff-accent; rename `.btn-primary` → `.tipjar-btn` | components/builder/BuilderShell.tsx:215, app/globals.css:871-881 + 2 consumers |
| UI-3 + UX-7 | New StepHeader component (h1.cv-step-heading + subtitle from steps.ts incl. the dead atsTip strings + "Step X of 10"); mount on the 8 bare steps; normalize heading sizes | new components/builder/StepHeader.tsx, 8 step files, app/globals.css, UAEEssentialsStep.tsx:102, ReviewStep.tsx:196 |
| UI-4 | Global `:focus-visible` outline rule; switch input rings to :focus-visible; kill the indigo ring | app/globals.css, components/builder/steps/LanguagesStep.tsx:135 |
| UI-5 | Raise touch targets: toggle/TopBar pills/Dismiss/skill-chip-remove/swatches to ≥44px hit areas | components/builder/BuilderShell.tsx, app/globals.css, components/builder/CustomizePanel.tsx, components/builder/steps/SummaryStep.tsx:177 |
| UI-10 | ATS-safety badge field in template registry + render in gallery cards | lib/templates/index.tsx, components/templates/TemplateCard.tsx, ReviewStep gallery |
| PERF-2 | Delete 4 dead font loaders + public/fonts woff2; replace globals @import with next/font for the 4 real families; fix variable stacks | app/layout.tsx, app/globals.css:7 + :107-112, public/fonts/* |
| PERF-5 + UX-21 | Delete /export, /templates, /preview (or body → `permanentRedirect("/builder")`), ScoreWidget, and the `?step=score` branch (this also removes the watermarked-PDF trigger and shrinks Wave 2's scoring consolidation) | app/export/*, app/templates/*, app/preview/*, components/ScoreWidget.tsx, app/builder/BuilderClient.tsx:119, components/ScorePanel.tsx |
| PERF-7 + UX (mobile) | ~96px bottom padding on .ff-form-column below xl; scrollIntoView({inline:'center'}) on active bead | components/builder/BuilderShell.tsx:1098-1102, components/builder/StepBeads.tsx |

**Form polish (copy/affordance only):**
| Item | Implementation note | Files |
|---|---|---|
| UX-10 | Photo hint under toggle ("Common in the UAE; switch off for international/blind-hiring employers") + give the tip a stepId | components/builder/PhotoUpload.tsx, lib/data/tips.ts |
| UX-12 | Education openIndex default 0; Notes placeholder → "e.g. Graduated with distinction / GPA 3.8" | components/builder/steps/EducationStep.tsx:46, :213 |
| UX-13 | Chevron up/down icons on Experience; add move up/down to Education; touch-friendly skill reorder buttons | components/builder/steps/ExperienceStep.tsx, EducationStep.tsx, SkillsStep.tsx |
| UX-14 | Rename to "Suggest bullets with AI" | components/builder/steps/ExperienceStep.tsx:266 |
| UX-15 | Inline AI error card with supportUrl + retry, branching on error code | components/builder/steps/ExperienceStep.tsx:570-580 |
| UX-16 | Plain-English microcopy pass (short sentences, concrete verbs) | PersonalStep.tsx:214, ExperienceStep.tsx:506-522, SummaryStep.tsx:142, lib/data/tips.ts |
| UX-17 | MappingReview footer note: "We can't read visa status, notice period, nationality or projects from files — you'll add these in the next steps" | components/import/MappingReview.tsx |
| UX-19 | Drop the required marker on Phone (the schema-tightening alternative is AMBER → W2 if preferred) | components/builder/steps/PersonalStep.tsx:249 |
| UX-20 | 2-line empty states for Certifications/Projects reusing tips copy, in SkillsStep's pattern | components/builder/steps/CertificationsStep.tsx, ProjectsStep.tsx |
| UI-8 (stopgap) | Fix the CustomizePanel promise copy until controls work (real fix = deferred template-parity pass) | components/builder/CustomizePanel.tsx:150 |
| UX-9 (label part) | "Availability" → "Availability / notice period" | components/builder/steps/UAEEssentialsStep.tsx:178-187 |

### Wave 2 — AMBER + the scoring bug

**W2-A — Scoring consolidation (P0, its own commit, per §4 diagnosis):** one engine, one threshold table, one completeness definition.
→ lib/scoreEngine.ts (export derived stats + single label map; decide empty-input signal policy = "not applicable" not "pass"; delete dead shims), lib/utils/stepValidation.ts (wrap engine S-signals or at minimum ignore blank stubs, trim bullets, fix `review: true`), lib/schemas/cvSchemas.ts (preprocess empty bullets), components/builder/steps/ExperienceStep.tsx:170-181 (strip empty bullets in sync; same in ProjectsStep), components/builder/steps/ReviewStep.tsx (delete local stats + label; read engine), components/builder/ScoreChip.tsx:9-14 (engine grade replaces 50/70/85), components/builder/BuilderShell.tsx:698-718, docs/score-parity-smoke-test.md. Remove the hardcoded "+4 pts" claim (ExperienceStep.tsx:956). Acceptance: (a) filled experience never reports missing; (b) label and checklist derive from the same report; (c) blank CV can never show green/passing anywhere (incl. the Review bead).

**W2-B — Flow & navigation:**
| Item | Implementation note | Files |
|---|---|---|
| UX-1 | Make visited/optional beads clickable; only required-gated steps stay locked; fix the always-done Review bead (consumes W2-A) | components/builder/StepBeads.tsx, components/builder/BuilderShell.tsx:698-718 |
| UX-2 | "I don't have work experience yet" escape (skip prop or schema-relaxing checkbox) + fresh-grad guidance copy | app/builder/BuilderClient.tsx, lib/schemas/cvSchemas.ts, lib/utils/stepValidation.ts, components/builder/steps/ExperienceStep.tsx |
| UX-3 | Render per-field errors (Field already supports an error prop) + form-level fallback on 4 steps; UAE Essentials validates only its own fields (pick() of personalSchema) | CertificationsStep.tsx, ProjectsStep.tsx, LanguagesStep.tsx, UAEEssentialsStep.tsx, components/forms/Field.tsx |
| UX-6 | Relax Education filter to `Boolean(e && e.id)` matching all other steps | components/builder/steps/EducationStep.tsx:77-79 |
| UX-9 | Emirate select writing into existing `personal.location` (NO store-shape change); move Nationality into the essentials card + count it in completion | components/builder/steps/PersonalStep.tsx, UAEEssentialsStep.tsx, lib/utils/stepValidation.ts:21-32 |
| UI-6 | useId() + htmlFor in the shared Field wrapper (test all steps) | components/forms/Field.tsx |
| ENG-11 | Non-blocking confirm before download when personal AND experience are both incomplete ("Download anyway / Keep editing") — never hard-block | components/builder/BuilderShell.tsx |
| UI-7 (remainder) | Flip useDownloadCV default plan to "pro" (one line; verify one download) | hooks/useDownloadCV.ts:21 |

**W2-C — Performance:**
| Item | Implementation note | Files |
|---|---|---|
| PERF-1 | Mount PreviewDrawer only when isDesktop (extend the existing matchMedia effect); keep CSS class as fallback | components/builder/BuilderShell.tsx:683-692, :1010-1021 |
| PERF-3 | useDeferredValue around computeScore input; hoist scoreReport to context so ReviewStep reuses it | components/builder/BuilderShell.tsx, ScoreChip.tsx, ReviewStep.tsx |
| PERF-4 | Memoize TemplateThumb on [data] + `content-visibility: auto`; or skeleton Thumbnails on <xl | components/builder/steps/ReviewStep.tsx, lib/templates/index.tsx |
| PERF-6 | next/dynamic MappingReview; move adapter imports inside handleImport; (ScorePanel already deleted in W1) | components/builder/BuilderShell.tsx:14-16, :783-803 |

**W2-D — Store hygiene (no shape change; migration system already exists at lib/store/migrate.ts, CURRENT_VERSION=2):** re-stamp `version: 2` in `importCvVersion` replace-mode and `reset` (cvStore.ts:245-251, :269-275); add the persisted-superset fields + "fluent" to the types (lib/types/cv.ts) or document the drift; note: **the UAE fields in this wave require NO migration** — visaStatus/availability/nationality/drivingLicense already exist in CvPersonal (lib/types/cv.ts:13-33).

**Print-path check required by the wave gate:** Wave 2 makes NO template changes (emirate writes into the existing location string, which all templates already render), so the full/minimal-CV A4 verification is a regression check only.

### Wave 3 — RED: upload & parsing

Fixture baseline first (per Prompt 4), then:

| Item | Implementation note | Files |
|---|---|---|
| UX-18 | Adapters rethrow typed failures (corrupt / scanned-no-text-layer / unusual layout) so BuilderShell's error bar becomes reachable; scanned-PDF hint mirroring UploadDropzone's <200-char guard; route dead-ends into the blank-start flow, never a dead end | lib/importers/pdfAdapter.ts:152-155, docxAdapter.ts:19-22, components/builder/BuilderShell.tsx:796-802 |
| UX-4 (real fix) | Accept `.pdf,.docx`, route by extension to the already-implemented docxAdapter | components/builder/BuilderShell.tsx:783-803, components/builder/steps/PersonalStep.tsx |
| UX-8 | Route the report→builder import through MappingReview (same ParsedDocument contract); post-import nudge to ?step=uaeEssentials for never-parsed fields | components/builder/ImportFromReportBanner.tsx, components/import/MappingReview.tsx |
| PERF-8 | Vendor pdf.worker.min.mjs into public/ (version-locked); CDN as catch-retry fallback | lib/importers/pdfAdapter.ts:124-126, public/ |
| Parser | Stop silently discarding the detected Projects section (textParser.ts:788-813); surface `extractionConfidence` (already parsed+stored, displayed nowhere — parse.ts:82, route drops `usedFallback` at route.ts:99); UAE field recognition (visa status, nationality, +971 normalization); date-range normalization. Every change keeps the fixture baseline green. | lib/importers/textParser.ts, fieldMapper.ts, adapter.ts, lib/resumeChecker/parse.ts (schema additions), components/import/MappingReview.tsx |
| Abuse gap | Add rate limiting to /api/resume-checker/parse (it proxies a paid Anthropic call un-throttled; ai-improve already has the pattern) | app/api/resume-checker/parse/route.ts (reuse app/api/ai-improve/route.ts:22-34 pattern) |
| Test wiring | The fixture script can double as the runner for the orphaned lib/store/migrate.test.ts (node:test, currently has no npm script) | package.json, __fixtures__/ |

---

## 4. Score/review bug diagnosis (root cause — no fix in this run)

There is no single bug. There are **three independent computation paths plus three separately-hardcoded threshold tables**, and every reported symptom is a disagreement between two of them.

**The paths:**
1. **The engine** — `computeScore()` (lib/scoreEngine.ts:1099-1180): 42 sub-signals; in builder mode 10 conditional points are excluded so the budget is 90, normalized to 0–100. Grade thresholds 40/65/85 (scoreEngine.ts:1072-1077). Consumers: TopBar ScoreChip, ReviewStep donut, ScorePanel, the checker API. Deprecated shims `calculateScore`/`computeCheckerScore` have zero production imports.
2. **Step completion** — `getStepCompletion()` (lib/utils/stepValidation.ts:17-56) backed by zod schemas (lib/schemas/cvSchemas.ts) — an entirely separate definition of "section done". Consumers: bead statuses, ReviewStep "Missing sections" chips, "Sections complete" stat.
3. **ReviewStep local math** (ReviewStep.tsx:152-177): re-implements bullet counting (untrimmed, unlike the engine), measurable-bullet detection, and its own label table (≥85 "Outstanding", ≥65 "Strong CV", ≥40 "Almost there") applied to the Path-1 total. A fourth table lives in ScoreChip (`tierFor` 50/70/85 — ScoreChip.tsx:9-14), which **disagrees with the engine's 40/65/85**: a CV scoring 65–69 is simultaneously "Strong CV" on Review and amber "Fair" in the TopBar.

**Symptom (a) — "Missing sections: Work Experience" with a filled entry.** The chip comes from Path 2, whose zod schema requires EVERY array entry to have company+role+startDate and ≥1 bullet of ≥3 chars (cvSchemas.ts:27-42). Three verified triggers: the store seeds every new experience with `bullets: [""]` (cvStore.ts:22-31) and the form→store sync never strips empty bullets (ExperienceStep.tsx:170-181; `removeBullet` even resets to `[""]`); an untouched "Add another role" stub poisons the whole array; a missing startDate. Meanwhile the score card next to it says "Experience section populated" because engine signal S7 passes on ≥1 entry with company OR role and deliberately filters blank stubs (scoreEngine.ts:564-576, :217-219). Divergent duplicated logic — not a field-path bug.

**Symptom (b) — "0 of 9 measurable bullets" + "Strong CV".** The stat is ReviewStep-local; the label is threshold-on-total. Quantification is worth only C3+C7+C8 = 8 of 90 points (≈8.9%) under the 3-points-per-signal cap, so a CV failing ALL quantification but passing everything else scores 91 → "Outstanding CV". Any CV ≥ ~66% shows "Strong CV" with 0 measurable bullets. The two numbers are mathematically independent by construction. (Bonus divergence: the local denominator counts whitespace-only bullets the engine trims.)

**Symptom (c) — blank CV shows a green checkmark.** Primary: `getStepCompletion("review")` returns `true` unconditionally (stepValidation.ts:51-52) → BuilderShell maps it to "done" (BuilderShell.tsx:707-710) → StepBeads renders the green ✓ (StepBeads.tsx:84-89) on a 100% blank CV from first load. Secondary: 7 engine signals pass on empty input (e.g. C4 "summary ≤200 words" with 0 words; A11 "no current role marked — OK if you're between jobs"; A6 "no emojis"), earning a blank CV 13/90 points and — because computeScore emits up to 2 severity-"good" issues per category (scoreEngine.ts:1141-1148) — green "what's working" rows on the checker report for an empty document.

**Consolidation contract for Wave 2:** the engine becomes the only computation site (export derived stats + ONE label map; decide empty-input signals are "not applicable", excluded from numerator+denominator like the existing conditional signals at scoreEngine.ts:1113); step completion re-expressed over engine S-signals (or minimally: ignore blank stubs, trim bullets, fix `review: true`); ReviewStep/ScoreChip/ScorePanel read engine output only. Full file list in §3 W2-A. The checker report consumes the engine already and inherits the fix.

---

## 5. Deferred (do not pull into waves 1–3)

| Item | Why deferred | Parked evidence |
|---|---|---|
| Browser-print → direct-download rewrite + dead print CSS removal (PERF-9) | Explicitly out of scope; export already IS direct download via react-pdf — the "rewrite" reduces to deleting vestiges | globals.css:757-864; classic.tsx print classes |
| **Template/PDF parity pass** (UI-8 real fix, UI-9, UI-11): implement fontScale + Font.register or capability-flag the Customize panel; Classic 2-col Languages/Certs grid; live emoji removal; name-size drift; Modern PDF fallback #4F46E5→#1e5b54; executive indigo dots; navy unification | All RED print-path; Wave 2 allows only additive fields and Wave 3 forbids print rendering — needs its own pass with before/after PDF render verification | CVDocument.tsx:1186, :100; executive.tsx:316; classic.tsx:308 |
| Placeholder stats fix (ENG-3) | Lives in makemycv-site, not this repo; copy proposed in §2 | ROADMAP.md:17 |
| Payments / Pro modal, Supabase auth | Per plan | DECISION_LOG.md |
| Arabic/RTL | Note for that phase: react-pdf has NO Font.register — built-in Helvetica is WinAnsi-only, so Arabic text cannot render in exported PDFs; the PDF filename sanitizer also strips all non-ASCII (Arabic-only names → generic filename) | CVDocument.tsx:100; useDownloadCV.ts:3-8 |
| Cover letters, JD Match, Phase 5 SEO | Per plan; JD Match additionally waits on stable bullet IDs | — |
| Real CV-sharing (send an actual CV to someone) | UX-5's honest relabel ships in W1; a true share feature is a product decision (conflicts with no-server posture) | — |
| Real social proof / numeric stats | Blocked on real analytics + consent flow per ROADMAP.md:25 | — |

---

*End of audit. No code was modified; no commits were made.*
