# CV Import Parser Fixes — 2026-06-13

Four import-mapping bugs reported from a real UAE CV import were fixed in the
heuristic text parser. All changes live in `lib/importers/` and are covered by
`scripts/parser-fixtures.test.cjs` (run `npm run test:parser` — 76/76 passing,
including a new `__fixtures__/glued-uae-export.txt` regression fixture).

## Bugs and fixes

### 1. Attestation landed in Education as a fake degree
"Attested | MOFA / UAE Ministry of Foreign Affairs" was parsed as a separate
education entry (school = "Attested", degree = "MOFA").

**Fix:** `parseEducationBlock` now detects attestation lines (`isAttestationLine`)
and folds them into the **preceding** education entry's `attested` +
`attestingBody` fields instead of spawning an entry. `matchAttestingBody` maps
recognised bodies to the exact `ATTESTING_BODIES` dropdown labels in
`components/builder/steps/EducationStep.tsx` (e.g. "MOFA – UAE Ministry of
Foreign Affairs"), so the imported value selects an existing option. New fields
`attested` / `attestingBody` were added to `ParsedEducation` and wired through
`fieldMapper` (both directions, so report→builder round-trips too).

### 2. Project link stuck in the name
"Hisaab | usehisaab.com" left the URL inside the name; the Link field stayed
empty because the detector only matched `http://` / `www.` URLs.

**Fix:** `parseProjectsBlock` now also matches **bare domains** (`BARE_DOMAIN_RE`)
— our exports strip http/www — moves the link to `link`, and removes the link
token from the name/bullets.

### 3. Role + company glued in the headline/experience
The CV used a glued pipe ("Odoo Administrator| Interior360…"). `splitHeaderParts`
only split on `|` with spaces on both sides, so role+company never separated and
that mis-parsed value got seeded as the headline.

**Fix:** pipe / middot / bullet (`| · •`) now split even when glued; dash and
"at" still require surrounding spaces (so "Co-founder" stays intact).

### 4. Real headline went to the "couldn't place" bucket
The parser never extracted a headline — by prior design it dropped the title
line into `unplaced`.

**Fix:** `harvestContact` now lifts the title line just below the name into
`contact.headline` (when it reads like a job title or carries a separator) and
consumes it, so it no longer appears in the unplaced bucket. The two fixture
tests that asserted the old behaviour were updated.

## Files changed
- `lib/importers/textParser.ts` — splitHeaderParts, headline extraction,
  attestation detection + folding, project bare-domain links.
- `lib/importers/adapter.ts` — `ParsedEducation.attested/attestingBody`,
  headline doc comment.
- `lib/importers/fieldMapper.ts` — pass attestation fields through (both maps).
- `scripts/parser-fixtures.test.cjs` + `__fixtures__/glued-uae-export.txt` —
  updated headline assertions, new regression fixture.

## Not verified
- Live PDF text-extraction (pdfjs is browser-only; covered by manual QA). The
  fixture mirrors how the extracted text arrives, so the downstream mapping is
  fully covered, but a real PDF upload should be smoke-tested in the app once.
