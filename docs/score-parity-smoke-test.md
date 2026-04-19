# Score Parity — Manual Smoke Test

The ATS Checker and the Builder pill must produce the **same score** on the same CV. This doc is how we verify that.

## Why parity matters

Users upload a CV to /resume-checker, see a score, click "Fix in Builder — $5", and land in the Builder. The pill in the top-right of the Builder must show the same number. If it doesn't, the user stops trusting the score.

## How the engine stays parity-safe

1. One function scores everything: `computeScore(cv, { mode, parseSignals })`. Both the Checker and the Builder call it.
2. 10 points of the score depend on `parseSignals` (tables, images, unusual formatting, spelling). When parseSignals are missing (hand-entered CVs), those 10 points drop out of **both** numerator and denominator — the score normalizes to the remaining 90.
3. When a Checker report is imported into the Builder, parseSignals travel with it (`/api/resume-checker/import/:reportId` returns `{ cv, parseSignals }`; the Builder's Zustand store persists parseSignals to localStorage).
4. Because the same CV + same parseSignals go through the same function, the numbers match exactly.

## Primary smoke test (run before every merge)

### Step 1 — Upload a CV via /resume-checker
1. Open `/resume-checker`.
2. Upload a real PDF CV.
3. Wait for the report to render.
4. **Write down the total score displayed in the sidebar.** e.g. `82`.
5. Also note the 4 per-category scores (Content, Section Structure, ATS Essentials, Design & Formatting).

### Step 2 — Click "Fix in Builder — $5"
1. The button hands you off to `/builder?importedFrom=<reportId>`.
2. Expect either:
   - An "Imported from your ATS report" banner (if the builder was empty), or
   - A "Replace your existing CV?" modal. Pick **Replace**.

### Step 3 — Check the pill
1. In the top-right of the Builder, the ScoreWidget pill shows `X/100`.
2. **It MUST match the Checker's total exactly.** 82 on the report = 82 on the pill.
3. If it differs by even 1 point, the engine is not unified. Stop and debug.

### Step 4 — Check the expanded panel
1. Click the pill → opens `/builder?step=score`.
2. The ScorePanel shows a circular score with the same total.
3. Category cards show the same 4 categories with the same per-category scores as the report sidebar.
4. Issue counts per category should match (errors and review-level issues).

## Secondary checks

### Weight cap (no single field > 3 points)
1. From an empty CV, fill in just one field (e.g., email).
2. The pill should jump by **at most 3 points**.
3. Repeat for a few other single-field edits (phone, headline, summary). None should jump > 3.

### Empty-CV floor
1. Hit "Reset" on the Builder.
2. Confirm the pill reads a low but non-zero number (typically 25–35).
3. Categories should render sensibly — no NaN, no empty cards.

### No-experience CV
1. Remove all experience entries.
2. Confirm:
   - S7 (≥1 experience) fires as error
   - A7/A8 (date parseability) render with a "nothing to evaluate" review state, not crash
   - D9 (bullet density) doesn't NaN-out
3. Score drops but categories stay coherent.

## Red flags that indicate parity is broken

- Checker shows 82, Builder pill shows 79 → parseSignals didn't travel. Check that `/api/resume-checker/import/:id` returns `parseSignals`, and that `ImportFromReportBanner` calls `setParseSignals(payload.parseSignals)`.
- Checker shows 82, Builder pill shows 91 → parseSignals traveled but the Builder is passing `parseSignals: undefined`. Check the `computeScore` call site in `ScoreWidget.tsx` / `ScorePanel.tsx`.
- Scores match on first load, then drift after editing → the Builder uses `useCvStore((s) => s.parseSignals)` correctly; but if you removed the re-render dependency on parseSignals the memo goes stale. Keep parseSignals in the dep array.

## Files to grep when debugging

- `lib/scoreEngine.ts` — single source of truth.
- `components/ScoreWidget.tsx` / `components/ScorePanel.tsx` — builder consumers.
- `components/resume-checker/ScoreSidebar.tsx` / `CategoryCard.tsx` — checker consumers.
- `app/api/resume-checker/import/[reportId]/route.ts` — must return parseSignals.
- `components/builder/ImportFromReportBanner.tsx` — must call setParseSignals.
- `lib/store/cvStore.ts` — parseSignals slot + localStorage persistence.
- `lib/importers/fieldMapper.ts` — headline seeding (A9 doesn't light up without it).

## Known non-parity-breaking differences

These are cosmetic, not score-altering:
- Builder pill shows grade as "Good" / "Excellent" / "Needs Work" / "Poor" (title case).
- Checker uses the same grade for colour but doesn't display it as a label.
- Issue copy differs by mode (imperative in Builder, diagnostic in Checker) — the **same issues fire**, just worded differently.
