# Founder Feedback Round — 2026-06-11 — Verified Analysis

Source: founder dogfooding session on app.makemycv.ae (built own CV, downloaded PDFs).
Every item below was verified against the code by a 12-agent analysis run. Status legend:
**Confirmed** = real, as described. **Partial** = real but root cause / coverage differs from assumption.

Effort scale: trivial < 30min · small < 2h · medium = half day · large = multi-day.

---

## A. Template / PDF output items (what recruiters see)

### T1 — Links should be prominent + clickable in PDFs — PARTIAL · effort: medium · value: HIGH
- Only Classic + Modern PDF contacts are clickable (`<Link>` w/ mailto/tel, CVDocument.tsx:416-434, 1196-1214) — but styled identically to plain text (gray, `textDecoration: "none"`, `contactLink` style CVDocument.tsx:142-146), so nobody knows.
- Executive / ATS-Clean / ExecSplit / CorpSidebar PDFs: **nothing clickable** (contacts are plain joined strings).
- **Project links are never clickable in any of the 6 PDF layouts.** DOCX has zero hyperlinks (no `ExternalHyperlink` import, docxExport.ts:9).
- Existing parity break: live Executive project link is a clickable indigo anchor (executive.tsx:624-635); its PDF is plain gray text (CVDocument.tsx:881-885).
- Fix: `normalizeHref()` helper (prepend https:// — raw stored "linkedin.com/in/x" makes dead PDF links), wrap all URL fields in `<Link>` in all 6 layouts, per-template accent/underline styling, DOCX `ExternalHyperlink` with `style: "Hyperlink"`.
- Constraint: ATS Clean stays visually plain (deliberate, ats-clean.tsx:537 comment) but clickable — link annotations don't affect text extraction.
- Watch: splitting joined contact strings into per-item nodes changes wrapping in narrow sidebars — verify long URLs on Executive/CorpSidebar/ExecSplit.

### T2 — "Odoo Administrator| Interior360" missing space before pipe — CONFIRMED · effort: small · value: HIGH
- **PDF-only bug; live templates are fine.** 10 sites in CVDocument.tsx (exp role|company + project name|link in Classic/Executive/Modern/ExecSplit/CorpSidebar: lines 543, 640, 834, 883, 1329, 1426, 1606, 1653, 1852, 1899).
- Root cause: ` | ${company}` lives in its own sibling `<Text>` inside a flex row; @react-pdf textkit's `adjustOverflow` strips leading U+0020 at the start of every text block (textkit.js:1378-1390). Space exists in the text layer; visually cancelled.
- Fix: switch to the nested-`<Text>` pattern already used for certifications in the same file (CVDocument.tsx:608-617) — nested Texts merge into one block, space survives. Move `flex: 1` onto the merged Text so the date column stays aligned.
- Do NOT touch live templates or DOCX (correct already). NBSP fallback works but pollutes the ATS text layer — avoid.

### T3 — Language name should be bold — CONFIRMED · effort: small · value: MEDIUM-HIGH
- Nothing is bold in any of the 12 render paths. All concatenate one plain string.
- Bonus bug confirmed: **double parens** — `formatLanguageLevel` already returns "Professional Working (C1)" (lib/language.ts:9-22) and 10 call sites wrap it in another `(...)` → "English (Professional Working (C1))". Only live Modern (dash separator) escapes it.
- Bonus bug: **DOCX drops proficiency entirely** (docxExport.ts:128-132 — names only).
- Fix: change wrap to `${name} — ${formatLanguageLevel(level)}` at the 10 sites (single parens kept around CEFR); bold name via `<span style={{fontWeight:600}}>` live / nested `<Text style={{fontFamily:"Helvetica-Bold"}}>` PDF (precedent: CVDocument.tsx:608-611); add level to DOCX with bold TextRun for name.

### T4 — Name hyphenates "Muham-mad", email breaks in sidebar — PARTIAL (real, different mechanics) · effort: small · value: HIGH
- Screenshot is the **Executive** template (green = chosen accent; sidebar 150pt, ~120pt usable). No `Font.registerHyphenationCallback` exists anywhere → react-pdf's default en-US Knuth-Liang hyphenator inserts real "-" glyphs. Affects all 6 PDF layouts.
- The hyphenated email is **ATS-hostile**: extraction yields "sendmailtoabdul-\nlah@gmail.com" — fails email regexes. This is a correctness fix, not just cosmetics.
- Live Executive already stacks first/last name (executive.tsx:210-213); the PDF diverges (single joined string, CVDocument.tsx:659-661, 717).
- Fix (all CVDocument.tsx): (1) `Font.registerHyphenationCallback((w) => [w])` at module scope — global kill-switch; (2) stack firstName/lastName as two `<Text>`s in ExecutivePDFLayout (fields already separate in CvPersonal); (3) long-email font-size step-down (`value.length > 26 ? 6.2 : 7.5`) in Executive + CorpSidebar sidebars so disabling hyphenation can't cause overflow.
- NEVER split the email string or insert ZWSP — corrupts the text layer.

### T5 — Reduce page margins so bigger CVs fit — CONFIRMED · effort: small · value: MEDIUM-HIGH
- One shared `s.page` for all 6 layouts: 36pt top/bottom, 30pt left/right (CVDocument.tsx:96-99).
- **Lockstep hazard:** exactly 3 full-bleed sites / 8 negative-margin values consume page padding (execSidebar CVDocument.tsx:258-260; ExecSplit header 1483-1485; CorpSidebar sidebar 1917-1919). All 12 values must change in one commit or you get white gutters / phantom blank pages.
- Proposal: 36/30 → **27pt vertical / 24pt horizontal** (= 36px/32px, clean Tailwind `py-9 px-8` for live mirrors). +2.2% width, +2.3% height; ≥24pt stays print/ATS safe.
- Mirror in live templates (classic.tsx:112, modern.tsx:73, ats-clean.tsx:121, exec-split.tsx:115+223, corp-sidebar.tsx:136). Note pre-existing live/PDF padding mismatches (modern vertical, ats-clean horizontal, executive inner) — decide whether to fix in the same pass.
- Update MEMORY.md full-bleed pattern note (-36/-30 → -27/-24) when done.

## B. Builder items

### B1 — Review step: sticky columns + "Choose your own Color" — CONFIRMED FEASIBLE · effort: small · value: MEDIUM-HIGH
- Verdict: agree with the idea. TopBar/ProgressBar are already fixed chrome outside the scroller (BuilderShell.tsx:952-1008); `<main>` is the single scroll container (1073-1081). CSS-only fix inside ReviewStep's inline `<style>` (ReviewStep.tsx:593-638).
- Approach A (recommended): at ≥1500px add `align-self:start; position:sticky; top:0` to `.ff-review-hero` and `.ff-review-customize`, plus `max-height: calc(100dvh - var(--topbar-h) - var(--progressbar-h) - 56px); overflow-y:auto; overscroll-behavior:contain` on the hero — this IS the founder's own caveat (score area scrolls within its own bounds). `align-self:start` is mandatory or sticky silently no-ops in grid.
- Gotcha: at 1200–1499px the customize panel sits BELOW templates in the same column (grid areas, ReviewStep.tsx:610-612) — rearrange to `"hero templates" "customize templates"` there, or scope to ≥1500px.
- Hex label: it's a native `<input type="color">` labeled "Hex" (CustomizePanel.tsx:191-205). Relabel to "Choose your own Color" + aria-label = trivial. Recommend ALSO adding a typeable hex text field (validate `/^#?[0-9a-fA-F]{6}$/`).
- NOTE: **photo placement does not exist** — only shape round/square/hidden (lib/types/cv.ts:88). Placement would be a new cross-cutting feature (both render paths).

### B2 — Highlights textarea auto-grow — CONFIRMED · effort: trivial-small · value: MEDIUM
- Projects bullets: fixed `rows={2}`, missing even `cv-textarea` (no manual resize) — ProjectsStep.tsx:191-196. No autosize primitive exists in the repo.
- Fix: new `components/forms/AutoGrowTextarea.tsx` (scrollHeight in useLayoutEffect + onInput, merge react-hook-form ref; must also resize on programmatic value changes — AI suggestion accept rewrites values). Use for Projects AND Experience bullets. Cheap alternative: `field-sizing: content` on `.cv-textarea` (keep `rows` fallback).

### B3 — Collapse Projects + Certifications like Experience/Education — CONFIRMED · effort: small · value: MEDIUM
- Education is the cleanest pattern to port (EducationStep.tsx:52, 134-161): `openIndex` state, summary line from `watch`, header toggle + chevron, `{isOpen && body}`, open-on-add. ~30-45 lines per step.
- MUST add: auto-open first errored card on failed submit (`handleSubmit(onNext, onError)`) — otherwise collapsed cards hide zod errors (existing flaw in Exp/Edu too; fix all 4 while there).
- Don't touch the debounced watch→store wiring (fragile, UX-6 history).

### B4 — Beautify "Add bullet" button — CONFIRMED · effort: trivial · value: LOW-MEDIUM
- ExperienceStep.tsx:661-670: `.cv-btn-ghost` has **no `:disabled` rule** (looks clickable at MAX_BULLETS), `width:100%` fights sibling `flex:1`, padding mismatch with "Generate more" next to it. Same action styled differently in ProjectsStep (:215-217, cv-btn-secondary, no icon).
- Fix: match proportions of the well-styled "Add project" button (ProjectsStep.tsx:144-152), add `.cv-btn-ghost:disabled` rule to globals.css (~line 420), unify ProjectsStep's variant. Careful: `width:100%` removal must be scoped inline — class is shared by full-width add buttons.

### B5 — "Step X of 10" line — CONFIRMED · effort: trivial · value: LOW-MEDIUM
- StepHeader.tsx:21-32; costs ~19px on 9 steps. Counter was added deliberately in the June audit for phone wayfinding (beads scroll off-screen).
- Recommendation: founder's own option B — inline right of the title (flex row, `alignItems:baseline`, `flexWrap:wrap`, `whiteSpace:nowrap` on counter). Saves the height, keeps the "of 10" for mobile. Keep counter outside the h1 for SR cleanliness.

### B6 — Preview drawer wastes space / duplicate buttons — CONFIRMED · effort: small · value: VERY HIGH
- Root cause is NOT drawer width (`clamp(460px, 48vw, 820px)` — 614-820px effective on xl+). It's the **fit-whole-page scaling**: `scale = min(scaleW, scaleH, 1)` (BuilderShell.tsx:442-446). On 1440×900: 1-page CV → 0.60 scale (~475px page, ~107px dead gutters each side); 2-page CV → 0.30 scale, body text ~3px. Unreadable.
- The fit-to-width pattern ALREADY EXISTS in MobilePreviewView (BuilderShell.tsx:505-581: width-fit scale + spacer height + scrollable parent) — copy it into DrawerPreviewBody. Result: 1.3×–2.9× larger page, edge-to-edge.
- Add "Fit page | Fit width" toggle (default fit-width) — whole-page-at-a-glance was deliberate, keep it reachable.
- Dedupe: keep TopBar "Download" as the single global CTA (it routes through the export gate, exists on every step); DELETE drawer-footer "Download PDF". Keep the drawer template cycler (genuinely different from TopBar "Templates" navigation); rename TopBar button "All templates". Reassess "Fullscreen" (on wide screens it shows a 794px page next to an ~818px drawer — near no-op once fit-width lands).
- **BUG found in passing: ReviewStep download buttons call `downloadCV` directly and BYPASS the ExportGateDialog guard** (ReviewStep.tsx:146; TemplatePreviewModal.tsx:156) — unify on one guarded download hook.
- Optional: dashed page-break guides at 1123px intervals in the preview wrapper (preview-chrome only; never in templates).

### B7 — Light-green border on filled fields — PARTIAL (half-built already) · effort: medium · value: MEDIUM
- Commit e53377b already shipped green-on-valid: `Field` wrapper + `useBlurFeedback` + `.cv-input-valid` (full UAE green #0E7C4A + check badge, blur-triggered) — but only 8 required fields (names, email, exp title/company/start, edu degree/school/year).
- Gaps: ~20 optional inputs + 3-4 selects unwired; `.cv-select` has no valid-state CSS (badge would collide with chevron); prefilled/imported values show nothing until blurred; "light green" tier doesn't exist.
- Recommendation: add a second, quieter "filled" tier centralized in `Field` (border-only light green, no badge, no padding shift; explicit validity feedback always wins so broken-but-filled email stays red). Mount-time seeding so imported CVs light up.
- **Product decisions needed:** live-on-fill vs blur trigger; should prefilled values seed green; badge on optional fields or border-only (recommend border-only).

---

## C. Sweep findings (not on the founder's list)

### Templates/PDF sweep — top finds
1. **Date formatter chaos — HIGH/small.** Three formatters: Classic live normalizes "2021-03"→"Mar 2021" (lib/utils/format.ts:55-66); other 5 live templates print raw with plain hyphen (lib/templates/utils.ts:3-8); PDFs print raw with en dash (CVDocument.tsx:28-35). Same data renders 3 ways; Classic preview ≠ Classic PDF. Unify on lib/utils/format.ts.
2. **Font scale control is a complete no-op — HIGH/medium.** CustomizePanel writes `settings.fontScale`, resolveTheme returns it, **zero render paths read it**. Wire it or remove the control.
3. **toTitleCase corrupts proper nouns in every PDF — HIGH/small.** "JavaScript"→"Javascript", "iOS"→"Ios" in all 6 PDF skill lists (CVDocument.tsx:18-26 used at 583, 754, 1094, 1369, 1684, 2008) while 5 of 6 live previews show them correctly. Trust user casing; delete from render layer.
4. **Modern PDF ≠ Modern live — HIGH/large (accent fix: small).** Live = 2-col grid, cards, pills, green default; PDF = single-column Classic clone with **indigo `#4F46E5` default accent** (CVDocument.tsx:1186 vs modern.tsx:14) — user previews green, downloads indigo. Minimum fix now: match the fallback accent. Full redesign: separate ticket.
5. Modern live: dangling " - " on empty issuer, cert date dropped (11 of 12 paths show it), literal "Company"/"Headline" placeholder leaks (modern.tsx:82-84, 190, 228) — MEDIUM/small.
6. PDF EducationEntry uniform across all 6 layouts vs 6 different live compositions (joiners, attested chip styling, Modern's inverted hierarchy) — MEDIUM/medium.
7. `wrap={false}` on unbounded entry blocks (13 sites): long roles → big end-of-page gaps; taller-than-page block can't render. Prefer wrap + `minPresenceAhead` on headers — MEDIUM/small.
8. Executive hardcoded off-theme indigo skill markers/project link + fixed navy attested chip ignore the accent picker (executive.tsx:316, 629, 561-562); PDF drops skill markers entirely — MEDIUM/small.

### Builder sweep — top finds
1. **Step navigation keeps scroll position and drops focus — HIGH/small.** `goToStep` is a bare router.push (BuilderClient.tsx:32-34); persistent `<main>` keeps scroll; next step opens mid-scroll, focus falls to body. Scroll-to-top + focus h1 (`tabIndex={-1}`) on step change.
2. **Entry delete is instant, no confirm/undo — HIGH/medium.** All 5 list steps wire straight to `remove(index)`; 250ms debounce persists to localStorage = unrecoverable. The in-house Toaster is the natural "Entry removed — Undo" vehicle.
3. **Autosave indicator can lie — HIGH/small.** Static "saved on this device" label (BuilderShell.tsx:189-202), hidden below md; `saveCvToStorage` calls `setItem` with no try/catch (localStorage.ts:43-53) — base64 photos + QuotaExceededError = silent data loss while UI claims saved.
4. Fullscreen overlay isn't a dialog (no Esc/aria-modal/focus trap) — MEDIUM/small.
5. ScoreChip popover: no Esc/aria-expanded; 320px fixed width clips ~110px off-screen on 360px phones — MEDIUM/small.
6. Mobile preview is a dead end: no template cycler/download below xl; Templates button hidden below sm — only path to gallery is knowing to tap the Review bead — MEDIUM/medium.
7. Reorder fails keyboard+touch (tabIndex=-1 drag handle, move buttons only when expanded, no aria-expanded anywhere in builder) — MEDIUM/medium.
8. 28px icon buttons vs the project's own 44px touch rule (drawer chevrons, move buttons, **AI suggestion accept/reject** — mis-tap burns the 10/24h AI quota) — MEDIUM/trivial.

---

## D. Proposed implementation waves

**Wave 1 — "Trust the PDF" (highest leverage; mostly CVDocument.tsx):**
T2 pipe fix → T4 hyphenation kill-switch + name stack + email sizing → T3 language bold + double-paren + DOCX level → sweep #3 toTitleCase → sweep #1 date unification → sweep #4 accent fallback → T1 clickable links (+DOCX hyperlinks) → T5 margins (atomic 12-value commit, last so visual QA covers everything).
Verify: export all 6 templates with a long 2-page fixture + long links; check Chrome+Adobe; `npm run build`, `npm run test:parser`.

**Wave 2 — Builder quick wins (cheap, independent):**
B5 inline counter · B4 add-button + `:disabled` ghost rule · B2 AutoGrowTextarea · B3 collapse Projects/Certs (+error auto-open in all 4 steps) · B1 sticky review + color label (+typeable hex) · builder-sweep #1 scroll/focus reset · #8 touch targets.

**Wave 3 — Preview overhaul (B6):**
Fit-width default + Fit toggle · delete drawer Download PDF · rename "All templates" · fix ReviewStep/TemplatePreviewModal export-gate bypass · reassess Fullscreen overlay (or make it a real dialog, builder-sweep #4).

**Wave 4 — Resilience + decisions needed:**
Autosave error surfacing · delete undo toast · B7 filled tier (after product decisions) · font-scale: wire or remove · Modern PDF redesign (separate ticket) · mobile preview chrome.

## E. Open product decisions
1. B7: trigger (live vs blur), prefill seeding, badge vs border-only for the filled tier.
2. Font scale: wire into both render paths (medium) or remove the control (trivial)?
3. Modern PDF: quick accent-fallback fix now + full 2-col redesign later, or redesign immediately?
4. Link prominence on ATS Clean: clickable-but-plain (recommended) or styled too?
5. T5: also reconcile the pre-existing live/PDF padding mismatches, or same-delta shift only?
