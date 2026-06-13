# JD Match — Evidence pass (keystone spec)

> Draft 2026-06-13. The strategic "stop selling a score, sell evidence" redesign.
> This doc specifies **only the keystone**: the bullet-evidence pass + the third
> `evidenced` chip state. The other moves (named-vs-demonstrated dot, refusal
> trust card, tiered batch, per-application versions) build on this and are
> scoped in their own follow-ups — see *Out of scope* below.

## Problem

Today a JD requirement is either **matched** (literally present in the CV) or
**missing**. That produces two bad outcomes the founder flagged:

1. **False misses → demoralisation + friction.** "Stakeholder management" is
   reported MISSING even though a bullet says *"managed cross-functional teams
   across 3 departments."* The user did the thing; we tell them they failed it,
   then make them fix 25 such chips one by one.
2. **Hollow fixes.** The cheapest fix ("Add to Skills") claims a skill that no
   experience bullet demonstrates — exactly the padding recruiters flag and the
   founder rejects.

The keystone closes #1 honestly and sets up the fix for #2: surface the evidence
the user **already wrote**, and let them re-thread the JD's wording into the
sentence they already have — never inventing anything.

## Goal

Add a third verdict between matched and missing: **`evidenced`** — "you already
show this in your experience; match the wording so the ATS sees it too." It is
the purest possible fix because it **adds nothing** — it relabels existing,
truthful content.

## Data model changes (`lib/jdMatch/types.ts`)

```ts
export type JdTermStatus = "matched" | "evidenced" | "missing";

/** Where in the CV a term is already demonstrated (for the "match the wording" CTA). */
export type JdEvidence = {
  experienceId: string;
  bulletIndex: number;
  snippet: string;      // the existing bullet text, for the chip + to pre-seed the weaver
};

export type JdTerm = {
  term: string;
  category: JdCategory;
  status: JdTermStatus;  // replaces `matched: boolean`
  evidence?: JdEvidence; // present iff status === "evidenced"
};

export type JdCategoryResult = {
  category: JdCategory;
  matched: string[];
  evidenced: { term: string; evidence: JdEvidence }[];  // NEW
  missing: string[];
};
```

`JdMatchResult` is unchanged in shape, but `matchedCount` semantics need a
decision (see Decision 1). Add a helper `isCovered(t) = t.status !== "missing"`.

**Migration note:** `t.matched` is read in `JdMatchPanel.tsx` and both test files.
Replace every `t.matched` with `t.status === "matched"` or `isCovered(t)` as
appropriate. This is mechanical but must touch every consumer — grep
`\.matched\b` before shipping.

## Matcher changes (`lib/jdMatch/match.ts`)

Today `cvPhraseTokens` (the variant-match corpus) is built from skills, certs,
role titles and headline — **bullets are deliberately excluded.** Add a separate,
**stricter** bullet scan that tracks origin:

```ts
// Built once, alongside cvPhraseTokens:
const cvBulletPhrases: Array<{ experienceId: string; bulletIndex: number;
  snippet: string; tokens: TokenSets }> = ...   // experience + project bullets only
```

For each requirement still unmatched after the literal + variant passes, test it
against `cvBulletPhrases`. If it matches under the **bullet-evidence rule**
(below), set `status = "evidenced"` with the matched bullet's locator (first/best
match wins). Otherwise `missing`.

### The bullet-evidence rule (the precision crux — read this)

A bullet is prose with many tokens, so the existing skill-phrase rule
(significant-token subset + one verbatim distinctive anchor) is **too loose**
here: a 2-token requirement is trivially a subset of a 20-token bullet. That
produces the worst possible bug — a **false** "you already prove this," which is
worse than a false miss because it asserts evidence that isn't there and burns
the trust brand.

So bullet evidence requires **phrase proximity**, not scattered tokens:

- Single-token requirement (e.g. "Tableau"): must appear as a whole word in the
  bullet (reuse the existing word-boundary `corpusHas`). No stem-only hits.
- Multi-token requirement (e.g. "machine learning"): its significant tokens must
  appear **within a small window** (recommend ≤ 3 words apart, any order) in the
  bullet — i.e. as a near-contiguous phrase — AND clear the existing
  distinctive-anchor + stem guards. This rejects *"learned to operate the coffee
  **machine**"* matching *"**machine learning**"* (tokens far apart, not a phrase).
- Experience + project bullets **only** — never summary/headline/skills (those
  are the literal-match corpus already).

Start strict; loosen only with fixtures. See Decision 2.

## UI changes (`components/jdmatch/JdMatchPanel.tsx`)

- `CategoryBlock` renders three groups: `missing` (existing `MissingFix` chips),
  **`evidenced` (new amber chip)**, then `matched` (existing `Chip`).
- New `EvidencedChip` — amber (`var(--ff-warn)` family), one button **"Match the
  wording"**. Copy:
  > **Stakeholder management** — your bullet *"managed cross-functional teams
  > across 3 departments"* already shows this. **[ Match the wording ]**
- "Match the wording" opens `BulletWeaver` **pre-seeded** with `evidence.experienceId`
  + `evidence.bulletIndex` (BulletWeaver already accepts a role + bullet; add an
  optional `seed` prop so it skips the role/bullet picker and goes straight to the
  rewrite of that bullet). The rewrite still routes through the existing
  refuse-capable `/rewrite-bullet` endpoint — a weak link still declines.
- An evidenced item flips to `matched` once the woven wording surfaces the term
  literally — reuse the existing `stillMissing` recompute at `JdMatchPanel.tsx`
  (the `applyPendingChanges` → re-match loop already does this for Weave).

The category count line becomes e.g. `5 shown · 3 already in your experience · 4 to add`.

## Truthfulness invariants (must hold)

- Evidence is **detected, never asserted**: we only label a term `evidenced`
  when its phrase genuinely appears in a bullet the user wrote.
- "Match the wording" only ever **rewrites the existing bullet** that supplied the
  evidence — it never appends a bullet (that would fabricate an achievement; see
  `applyFix.ts` replace-only rule) and never edits a different bullet.
- The rewrite endpoint's refuse-to-fabricate behaviour is unchanged; an empty
  result stays an honest decline, surfaced as such.
- Bullet-evidence precision is gated by adversarial fixtures before ship.

## Tests (`lib/jdMatch/match.test.ts`) — required before ship

Positive:
- "stakeholder management" ⇐ bullet "managed cross-functional teams across 3 departments" → `evidenced` with the right locator.
- "data analysis" ⇐ bullet "analysed sales data weekly" → `evidenced`.
- a literal skill ("SQL" in skills) stays `matched`, not downgraded.

Negative (the precision guards — these are the point):
- "machine learning" ✗ bullet "learned to operate the coffee machine" (tokens not a phrase) → `missing`.
- "Java" ✗ bullet "wrote JavaScript" → `missing` (existing boundary guard).
- a genuinely absent term ("Kubernetes", nowhere) → `missing`.
- single common token ("management" alone) ✗ scattered occurrences → not over-claimed.

## Open decisions (founder's call)

1. **Does `evidenced` count toward the score / `matchedCount`?**
   Recommend **yes, full credit** — the user genuinely has the competency, so
   counting it fixes the demoralising low number honestly; the amber chip still
   nudges them to surface the literal keyword for the ATS. Alternative: partial
   credit (messier to explain). *Affects scoring + the "X of Y" copy.*
2. **Bullet-evidence sensitivity.** Recommend starting strict (phrase-proximity
   window ≤ 3, experience/project bullets only, existing anchor guard) and
   loosening only behind fixtures. You own the precision/recall trade-off; a
   false "you already prove this" is the costliest error.
3. **Appended bullets (later move, not this slice).** The refusal card's "tell us
   in one line" elicitation must rewrite an *existing* bullet, never append one,
   unless we add an explicitly-flagged user-authored append change kind. Policy
   call on the truthfulness boundary.

## Out of scope for this slice (follow-ups, depend on this)

- "named vs demonstrated" evidence dot on skill chips + CV preview.
- Refusal-as-trust card + evidence-elicitation input.
- "Close the gaps that matter" evidence-tiered batch (relabel / weave / quarantine).
- Per-application tailored CV versions (the only store-shape change — defer).

## Acceptance criteria

- A term demonstrated in a real bullet shows as the amber `evidenced` chip, not
  as MISSING.
- "Match the wording" opens the weaver on the exact evidencing bullet and, on a
  truthful rewrite, flips the chip to matched and updates the score live.
- No false `evidenced` on the adversarial negative fixtures.
- `tsc` + `npm run test:jdmatch` + `npm run test:applyfix` + production build clean.
