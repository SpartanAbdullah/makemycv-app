# JD Match — Functional Spec (rewritten 2026-06-13)

> The original spec lived in a prior session's scratch space and isn't in the repo.
> This is the canonical, build-aligned rewrite. Phase A is what ships now.

## Problem
A UAE job seeker applies to many roles with one CV. They can't tell how well their CV matches a specific job description (JD), or which keywords the ATS will look for and they're missing. JD Match closes that gap.

## Phases
- **Phase A (free, ships now):** *Diagnosis only.* Paste a JD → get a match score (0–100) + the keywords/skills the JD wants, split into **matched** and **missing**, grouped by category (hard skills, tools/software, soft skills, certifications, other keywords). No edits applied.
- **Phase B (Pro, later):** one-click "apply fix" actions (add missing skill, rewrite a bullet to include a keyword). Requires the paid tier + stable bullet IDs. Out of scope now; UI shows a non-functional teaser only.
- **Phase C (later):** caching, history, multi-JD compare.

## Privacy / PDPL (decided)
- The **CV never leaves the browser.** Only the pasted **JD text** is sent to the server for extraction.
- JD text is processed **transiently** — extracted to structured requirements and **not persisted** (no KV write, no logging of JD body). Stated in the UI.
- Matching (requirements ↔ CV) runs **client-side** in the browser, so the CV stays local. This is both a privacy win and consistent with the product's "your data stays in your browser" promise.

## Architecture
1. **`POST /api/jd-match`** — input `{ jobText: string }`. Haiku extracts structured requirements. Rate-limited per-IP (same Upstash windows as `/api/ai-improve`: 10/24h + 3/60s). Returns `{ requirements }`. Mirrors `ai-improve` route conventions (server-only key, markdown-fence stripping, graceful 429/502/500). One retry on invalid JSON.
2. **`lib/jdMatch/extractCvText.ts`** — flattens `CvData` into a normalized token set (headline, summary, role titles, bullets, skills, certifications, projects). Lowercased, punctuation-stripped, deduped.
3. **`lib/jdMatch/match.ts`** — deterministic matcher. For each extracted requirement term, decide present/absent via token + phrase containment (with light normalization + a small synonym/alias map). Produces a weighted score and a categorized matched/missing breakdown.
   - **NOT routed through `computeScore()`** — that engine measures CV *quality*; JD Match measures *overlap*. Separate metric, clearly named, per the single-scoring-engine rule (which forbids a *second quality engine*, not a different metric).
   - Weights: hard skills & tools count most, certifications next, soft skills & generic keywords least. Score = weighted matched ÷ weighted total, 0–100.
4. **`hooks/useJdMatch.ts`** — calls the API, then runs the local matcher against the live CV from the Zustand store. Same `AIError` shape (`RATE_LIMITED` / `OTHER`) as `useAIImprove`.
5. **UI** — `components/jdmatch/JdMatchPanel.tsx` (paste box + result) and a page `app/jd-match/page.tsx` reading the store. Entry link added from the builder later (kept out of this slice to avoid editing the large BuilderShell).

## Scoring detail (Phase A)
- Category weights: `hardSkills 3, tools 3, certifications 2, softSkills 1, keywords 1`.
- A requirement is "matched" if any of its alias forms appears as a whole-token or phrase substring in the CV corpus.
- Score bands (UI labels): 80–100 "Strong match", 60–79 "Good match, close gaps", 40–59 "Partial — tailor your CV", <40 "Low — significant gaps".
- Empty/again-safe: <40 chars of JD text → ask for a fuller paste rather than scoring noise.

## Acceptance (Phase A)
- Paste a real JD → score + matched/missing categories render in <~6s.
- CV never sent to the server (verified: request body contains only `jobText`).
- Rate limit returns the same friendly 429 + Ko-fi support copy.
- Type-clean; deterministic matcher unit-sanity-checked.

## Open for Phase B
- Stable bullet IDs (already present: `CvExperience.id`; bullets are index-addressed — need per-bullet IDs for "apply fix").
- Pro gating reuses the retained `isPro` scaffolding.
