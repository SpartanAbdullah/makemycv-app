# Form-field audit · 2026-04-26

**Source of truth:** consolidated manifest in [`CV Templates (bundle src).html`](C:/Users/MuhammadAbdullah/Downloads/CV%20Templates%20(bundle%20src).html) (lines 1094–1160). Cross-referenced against [`CLAUDE_CODE_BRIEF.md`](C:/Users/MuhammadAbdullah/Downloads/CLAUDE_CODE_BRIEF.md) §2 and §5.

**Existing form/data model audited:** [`lib/types/cv.ts`](lib/types/cv.ts), [`lib/schemas/cvSchemas.ts`](lib/schemas/cvSchemas.ts), [`components/builder/steps/PersonalStep.tsx`](components/builder/steps/PersonalStep.tsx), [`lib/store/cvStore.ts`](lib/store/cvStore.ts), [`lib/utils/localStorage.ts`](lib/utils/localStorage.ts).

**Important manifest-vs-brief note.** The manifest (HTML) lists **7 NEW** fields for the audit gate. The brief (§2) records that the gate has *already been run* and only **4 NEW + 1 nested NEW** survived: `noticePeriod`, `openTo`, `boardRoles[]`, `awards[]` (gated), and `experience[].scopeMetrics` (gated). Per the user instruction, the manifest wins as the source of truth — but for each NEW row in the table I also flag whether the brief has *already dropped* it post-triage so the next prompt doesn't accidentally rebuild rejected work.

---

## Summary

- **32 rows in manifest** (the manifest footnote says "28" because it excludes 4 sub-fields counted under their parents — `bullets[]`, `outcomes[]`, `scopeMetrics`, `skills[].proficiency`).
- **11 EXIST** in current form (concept + name match closely; trivial work).
- **9 EXIST_DIFFERENT** (concept exists, shape/name differs; migration required).
- **12 MISSING** (no equivalent in current form).
- Of the 12 MISSING, **5 survive the brief's triage** and need to be added: `fullNameArabic`, `noticePeriod`, `openTo`, `boardRoles[]`, `awards[]`. Plus the nested NEW: `experience[].scopeMetrics`. The remaining 6 missing items (`headlineQuote`, `experience[].outcomes[]`, `skills[].proficiency`, `tools[]`, `recognition[]` (renamed → `awards[]`), `speakingAndWriting[]`) are explicitly rejected by the brief — do not add them.
- The current form also carries **6 fields the manifest does not use** (`country`, `dateOfBirth`, `showPhoto`/`photoShape`, education start/end dates, education `attested`+`attestingBody`, `projects[]`). Decide per §"Existing fields not in the manifest" below whether to keep, drop, or migrate.

---

## Field-by-field comparison

| Manifest field | Manifest type | Status | Existing field name | Existing type/shape | Notes |
|---|---|---|---|---|---|
| `fullName` | text | EXISTS_DIFFERENT | `personal.firstName` + `personal.lastName` | two `string` fields, both required | Trivial concat for render; for the form, decide whether to merge into one `fullName` input or keep two and join at the schema layer. Existing fields are *required*; manifest is Core. |
| `fullNameArabic` | text · rtl | MISSING | — | — | **NEW (survives brief).** No Arabic-name field anywhere. RTL detector exists at `lib/utils/rtl.ts` but is not wired into a name field. |
| `jobTitle` | text | EXISTS_DIFFERENT | `personal.headline` | `string` (optional) | Same concept, different name. The label in [PersonalStep.tsx:222](components/builder/steps/PersonalStep.tsx) already says "HEADLINE / JOB TITLE". Pure rename. |
| `location` | text "City, Country" | EXISTS | `personal.location` | `string` (optional) | Existing field is "City" only in the UI label, but stored as free text — fits manifest. Note collision with separate `personal.country`. |
| `email` | email | EXISTS | `personal.email` | `string` (zod email) | Match. |
| `phone` | tel | EXISTS | `personal.phone` | `string` (optional) | Match. Manifest says "UAE format hinted, not enforced" — current sanitizer already permissive. |
| `linkedin` | url | EXISTS | `personal.linkedin` | `string` (optional) | Match. Manifest says "display as path only" — render-side decision, no schema change. |
| `portfolio` | url | EXISTS_DIFFERENT | `personal.website` | `string` (optional) | Same concept. Pure rename (`website` → `portfolio`) or alias both. |
| `visaStatus` | select (UAE National / Residence / Employment / GCC / Visit / None) | MISSING | — | — | Not present in any form. Strategically critical UAE field per the brief. |
| `nationality` | select (ISO list, UAE-relevant ordering) | EXISTS_DIFFERENT | `personal.nationality` | free-text `string` (optional) | Field exists but as a free-text input with placeholder "Emirati, Pakistani, Indian". Manifest wants a select. Migration: introduce ISO list, keep free-text fallback for legacy data. |
| `emiratesId` | select ("Valid · YYYY" / "In progress" / hidden) | MISSING | — | — | Not present. |
| `drivingLicence` | text ("UAE · manual" / "UAE · automatic" / "International") | EXISTS_DIFFERENT | `personal.drivingLicense` | free-text `string` (optional) | **Spelling differs (US `drivingLicense` vs. brief's UK `drivingLicence`).** Existing accepts any text; manifest implies a constrained vocabulary. Decide: rename + constrain, or keep US spelling and just constrain values. |
| `noticePeriod` | select (Immediate / 1 / 2 / 3 / 6 mo / Negotiable) | MISSING | — | — | **NEW (survives brief).** No equivalent exists. |
| `openTo` | multi-select (cities + remote) | MISSING | — | — | **NEW (survives brief).** No relocation/openness field exists in any form. |
| `photo` | image · optional | EXISTS | `personal.photo` + `personal.showPhoto` + `settings.photoShape` | `string` data-URI; bool toggle; "round"/"square" shape | Concept matches. Brief requires `data-empty` HTML attribute collapse; current implementation uses a JS `showPhoto` boolean. Render side will need to switch from JS toggle → empty-attribute pattern (per brief §6). Schema can stay. |
| `summary` | longtext | EXISTS | `personal.summary` | `string` (optional, ≥30 chars in `summarySchema`) | Match. Note: in current store, summary lives **inside `personal`**, not at top level. Render code branches will need to know that. |
| `headlineQuote` | longtext | MISSING | — | — | Manifest lists it as NEW for T3. **Brief §2 explicitly DROPS this** ("removed from the original v1 proposal"). Do not add. |
| `experience[]` | repeater | EXISTS_DIFFERENT | `experience: CvExperience[]` | `{id, company, role, location, startDate, endDate, isCurrent, bullets[]}` | Concept matches. Field-by-field gaps: existing has plain `company` (manifest wants `organisationDescriptor` — see next row); existing splits date logic into `endDate: string` + `isCurrent: boolean` (manifest implies `endDate: string \| 'present'`). |
| `experience[].bullets[]` | string[] | EXISTS | `experience[].bullets` | `string[]` (zod min(1), each min length 3) | Match. |
| `experience[].outcomes[]` | string[] | MISSING | — | — | Manifest NEW for T3. **Brief §2 DROPS this.** Do not add. |
| `experience[].scopeMetrics` | object `{teamSize?, mau?, arr?, revenue?, pAndL?, geographies?, budget?}` | MISSING | — | — | **NEW (survives brief, GATED per §5).** No nested object on experience items. Per-role toggle "Add scope metrics" required in builder UX. |
| `organisationDescriptor` | text (generic — defensibility rule) | EXISTS_DIFFERENT | `experience[].company` | free-text `string`, required | Concept differs in *intent*. Existing accepts any company name (e.g. "Emirates Airlines"); manifest mandates a generic descriptor ("A regional airline group") enforced by branded type + ESLint denylist. Rename + add validation + add live suggester (per brief §3). The biggest behaviour change in this audit. |
| `education[]` | repeater `{degree, field, honours, school, graduationYear}` | EXISTS_DIFFERENT | `education: CvEducation[]` | `{id, school, degree, field, startDate, endDate, notes?, attested?, attestingBody?}` | Concept matches but shape differs. Manifest has `honours` and `graduationYear` (single year) — existing has `startDate`/`endDate` (range) and no `honours`. Existing has UAE-specific `attested`/`attestingBody` which the manifest omits. Decide: keep date range *and* add `graduationYear` derived, or migrate. Don't lose the attestation fields — they are UAE-distinctive. |
| `certifications[]` | repeater `{name, issuer, year, expiry?, status?}` | EXISTS_DIFFERENT | `certifications: CvCertification[]` | `{id, name, issuer, date?}` | Same shape spine. Missing `expiry` and `status`. `date` ↔ `year` mismatch (existing accepts any date string; manifest wants year-only). |
| `skills[]` | tag-array, first two `priority: true` get accent | EXISTS_DIFFERENT | `skills: CvSkill[]` | `{id, name, level?: "beginner"\|"intermediate"\|"advanced"}` | Concept matches but no `priority` flag. Existing `level` is *not* the manifest's `proficiency` (see next row). Migration: add `priority: boolean` (or derive from first two by position). |
| `skills[].proficiency` | 0–100 | MISSING | (existing `level` is categorical, not numeric) | enum 3 levels | Manifest NEW for T2. **Brief §2 DROPS this** ("removed from the original v1 proposal"). Do not add. Existing categorical `level` is unaffected by the brief — keep or drop independently. |
| `tools[]` | repeater `{tool, frequency: Daily/Weekly/Occasional}` | MISSING | — | — | Manifest NEW for T2. **Brief §2 DROPS this.** Do not add. |
| `languages[]` | repeater `{language, level: Native/Fluent/Professional/Conversational}` | EXISTS_DIFFERENT | `languages: CvLanguage[]` | `{id, name, level?: 8-value enum}` | Concept matches. Field name `name` vs. manifest `language` — trivial. **Level enum is wider in the existing form** (8 values incl. `elementary`, `full_professional`, plus the categorical skill-style `beginner/intermediate/advanced`). Manifest wants 4 values. Migration: tighten to 4, map legacy values (`elementary`→`Conversational`, `full_professional`→`Professional`, the three skill-levels → either drop or map to closest). |
| `boardRoles[]` | repeater `{role, organisationDescriptor, startYear, endYear?}` | MISSING | — | — | **NEW (survives brief).** No board/governance section. |
| `recognition[]` | repeater `{award, issuer, year}` | MISSING | — | — | Manifest name is `recognition[]`. **Brief §2 explicitly RENAMES this to `awards[]`** and keeps it (gated by per-CV "Add awards" toggle per §5). Add as `awards[]` only. |
| `speakingAndWriting[]` | repeater `{item, venue, year, scaleNumber?}` | MISSING | — | — | Manifest NEW for T2. **Brief §2 DROPS this.** Do not add. |
| `references` | enum `'on-request' \| ReferenceItem[]` | MISSING | — | — | No references field anywhere in current form/types. Optional per manifest. |

---

## The five new fields — verification

| Brief-approved NEW field | Audit verdict | Evidence |
|---|---|---|
| `noticePeriod` | **Confirmed MISSING.** No equivalent. | Not in `lib/types/cv.ts`, not in `lib/schemas/cvSchemas.ts`, not in any builder step. Grep for "notice" in form code returns nothing. |
| `openTo` | **Confirmed MISSING.** No partial equivalent — no `relocationWilling`, no `preferredCities`, no `remoteOk` flag exists. The closest concept is `personal.location` (where you currently are), which is the inverse. | Not in types, not in schema, not in form steps. |
| `boardRoles[]` | **Confirmed MISSING.** | No board/governance/director array exists. `experience[]` is the only role array and it's a single shape. |
| `awards[]` (renamed from manifest's `recognition[]`, gated) | **Confirmed MISSING.** Closest existing field is `certifications[]` — manifest explicitly notes the distinction ("Distinct from certifications"). They are not interchangeable. | `CvCertification` shape is `{name, issuer, date}`; an award would need `{award, issuer, year}` and per the brief sits behind a per-CV toggle. |
| `experience[].scopeMetrics` (nested, gated) | **Confirmed MISSING.** Each `CvExperience` carries no nested metrics object — just `bullets[]` for narrative. | `lib/types/cv.ts:31-40`. No `teamSize`, `mau`, `arr`, `revenue`, `pAndL`, `budget`, `geographies` anywhere in the codebase. |

All five are genuinely new. No false-MISSING risk.

---

## Existing fields not in the manifest

These exist in the current form/types and have **no counterpart** in the consolidated manifest. They are not wrong — just unaccounted-for. Decisions needed before the new schema is cut.

| Existing field | Where | Recommendation |
|---|---|---|
| `personal.country` | [lib/types/cv.ts:26](lib/types/cv.ts) | Likely redundant with `location` ("City, Country"). Consider folding into `location` or dropping. |
| `personal.dateOfBirth` | [lib/types/cv.ts:27](lib/types/cv.ts) | Common on UAE CVs but flagged as discrimination risk in many markets. Manifest deliberately omits. Decide policy. |
| `personal.showPhoto` (bool toggle) | [lib/types/cv.ts:24](lib/types/cv.ts) | Brief §6 mandates `data-empty` HTML-attribute collapse, **not** a JS toggle. Replace at render time; the schema flag becomes vestigial. |
| `settings.photoShape` ("round"/"square") | [lib/types/cv.ts:87](lib/types/cv.ts) | Manifest doesn't reference photo shape — templates choose treatment. Decide whether user retains the choice or templates own it. |
| `experience[].startDate` + `endDate` + `isCurrent` (separate bool) | [lib/types/cv.ts:36-38](lib/types/cv.ts) | Manifest implies the simpler `endDate: string \| 'present'`. Migration: collapse `isCurrent` into `endDate === 'present'`. |
| `experience[].location` | [lib/types/cv.ts:35](lib/types/cv.ts) | Optional in manifest schema sketch (§2 of brief) but not surfaced as a manifest row. Keep — useful for UAE multi-emirate stints. |
| `education[].startDate` / `endDate` / `notes` | [lib/types/cv.ts:47-49](lib/types/cv.ts) | Manifest wants `graduationYear` (single value) and adds `honours`. Either migrate end-date → graduationYear, or extend manifest. Don't lose existing user data on deploy. |
| `education[].attested` + `education[].attestingBody` | [lib/types/cv.ts:50-51](lib/types/cv.ts) | **UAE-distinctive (MOFA/emirate authority attestation).** Strong keep. Manifest omits — propose extending manifest rather than dropping. |
| `skills[].level` ("beginner/intermediate/advanced") | [lib/types/cv.ts:57](lib/types/cv.ts) | Different concept from manifest's dropped numeric `proficiency`. Decide: keep categorical level for some templates, or drop entirely (manifest implies skills are tag-only with `priority` flag). |
| `certifications[].date` (free string) | [lib/types/cv.ts:70](lib/types/cv.ts) | Manifest wants `year` only + adds `expiry`/`status`. Reshape required. |
| `projects[]` (entire section) | [lib/types/cv.ts:73-78](lib/types/cv.ts) — full step at [components/builder/steps/ProjectsStep.tsx](components/builder/steps/ProjectsStep.tsx) | **Manifest does not include `projects[]` at all.** Three templates have no project section. Decide: drop projects from the new product, or extend the manifest with a fourth template / project block. Notable user-facing regression risk if dropped silently. |
| `settings.{templateId, accentColor, fontScale, sectionOrder}` | [lib/types/cv.ts:82-88](lib/types/cv.ts) | Doc-level rendering controls. Manifest has only `scopeBand?: ScopeBand` (T3 only) at doc level. Decide which existing controls survive in the new system; templates per brief have a fixed accent ("one ochre moment"). `accentColor` likely conflicts with the brief's lint rule. |

---

## Migration / persistence concerns

1. **Persistence shape will break.** CV data is stored client-side under a single `localStorage` key (`makemycv:data` in [lib/utils/localStorage.ts:3](lib/utils/localStorage.ts)) as a JSON blob conforming to `CvData`. There is **no schema version field** in the stored payload. Any rename (`firstName`+`lastName` → `fullName`, `headline` → `jobTitle`, `website` → `portfolio`, `company` → `organisationDescriptor`, language enum tightening) will silently fail to load existing user data unless a migration step is added to `loadCvFromStorage`. Recommend adding a `version` field to `CvData` and a one-time migrator before any rename ships.
2. **`organisationDescriptor` is a behaviour change, not just a rename.** The brief (§3) introduces a branded TypeScript type plus an ESLint denylist plus a live in-form suggester. Existing user data will contain real company names ("Emirates", "Careem", etc.) that the new validation will reject. Migration policy required: one-shot warning UI, soft-flag old values, or auto-replace with a generic placeholder.
3. **`languages[].level` enum tightening will lose information.** Existing accepts 8 values; manifest wants 4. Map legacy values rather than dropping (`elementary` → `Conversational`, `full_professional` → `Professional`, plus decide what to do with the three categorical-skill-style values that are obvious copy/paste from `skills.level`).
4. **`education[]` shape change risks losing UAE-specific attestation.** Don't migrate `education[]` to the manifest shape verbatim — the manifest omits `attested`/`attestingBody` which are genuine UAE-CV value. Extend the manifest before reshaping.
5. **`projects[]` is not in the manifest.** If the new product genuinely drops projects, existing user data containing populated `projects[]` will become orphaned in storage. Either retain the field as carry-along data or warn users on first load.
6. **Photo collapse implementation must change at render time.** Brief §6 mandates `data-empty` attribute on the photo wrapper, not a JS-controlled `display: none`. The schema-level `showPhoto` bool is no longer needed by the renderers; remove from the new schema or keep purely as a UI affordance.
7. **Coupon redemption JSON file** ([lib/server/couponRedemptions.ts](lib/server/couponRedemptions.ts)) is unrelated to this audit but is broken on Vercel cold starts (file's own comment admits it). Flagging because a schema migration deploy is the natural moment to fix it.
8. **`accentColor` setting conflicts with brief §6 lint rule.** Brief mandates "one ochre moment per template" enforced by a linter that fails at >1 distinct purpose of `var(--accent)`. Letting the user pick `accentColor` in `settings` undermines the rule. Decide before the templates ship.

---

## Files inspected

- [`C:/Users/MuhammadAbdullah/Downloads/CLAUDE_CODE_BRIEF.md`](C:/Users/MuhammadAbdullah/Downloads/CLAUDE_CODE_BRIEF.md) — §2 schema sketch, §3 defensibility rule, §5 form-builder UX gates
- [`C:/Users/MuhammadAbdullah/Downloads/CV Templates (bundle src).html`](C:/Users/MuhammadAbdullah/Downloads/CV%20Templates%20(bundle%20src).html) — consolidated manifest (lines 1094–1160)
- [`lib/types/cv.ts`](lib/types/cv.ts) — canonical TypeScript shapes (`CvData`, `CvPersonal`, `CvExperience`, `CvEducation`, `CvSkill`, `CvLanguage`, `CvCertification`, `CvProject`, `CvSettings`)
- [`lib/schemas/cvSchemas.ts`](lib/schemas/cvSchemas.ts) — Zod validators per section + `cvSchema` aggregate
- [`components/builder/steps/PersonalStep.tsx`](components/builder/steps/PersonalStep.tsx) — Personal form UI (verifies which type fields are actually surfaced to users)
- `components/builder/steps/` directory listing — confirms no other field categories exist beyond Personal / Experience / Education / Skills / Languages / Certifications / Projects / Summary / Review
- [`lib/store/cvStore.ts`](lib/store/cvStore.ts) — Zustand store (verifies persistence path; no schema-version field)
- [`lib/utils/localStorage.ts`](lib/utils/localStorage.ts) — `STORAGE_KEY = "makemycv:data"`, raw JSON serialisation
