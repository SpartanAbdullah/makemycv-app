/**
 * Tests for the ready-made-blank detector (BLANK_RE / countUnfilled in
 * lib/ai/placeholders.ts) and the export-dialog list built on it
 * (getUnfilledBlanks in lib/validation/cvRequirements.ts).
 *
 * The bug being prevented (audit 2026-11 A1): the builder's own idea bullets
 * and summary starters leave "__" and "[your industry]" for the user to fill,
 * and nothing checked they had been filled, so a CV could be exported reading
 * "Closed __ new B2B accounts".
 *
 * The first two suites run against the REAL banks, so a new starter written
 * with a blank this detector does not know fails here, not in a user's CV.
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { BLANK_RE, countUnfilled, hasPlaceholder } from "./placeholders";
import { ALL_SUMMARY_STARTERS } from "../data/summaryStarters";
import { suggestionsForRole } from "../data/ideaSuggestions";
import { ROLE_FAMILIES } from "../data/roleFamily";
import { getMissingItems, getUnfilledBlanks } from "../validation/cvRequirements";
import { defaultCvData } from "../store/cvStore";
import type { CvData } from "../types/cv";

describe("countUnfilled — the real banks", () => {
  test("every summary starter is seen as unfinished until edited", () => {
    assert.ok(ALL_SUMMARY_STARTERS.length > 0);
    for (const starter of ALL_SUMMARY_STARTERS) {
      assert.ok(countUnfilled(starter) > 0, `no blank detected in: ${starter}`);
    }
  });

  test("no square-bracket prompt in a starter goes undetected", () => {
    for (const starter of ALL_SUMMARY_STARTERS) {
      const brackets = starter.match(/\[[^\]]*\]/g) ?? [];
      for (const b of brackets) {
        BLANK_RE.lastIndex = 0;
        assert.ok(BLANK_RE.test(b), `bracket prompt not treated as a blank: ${b}`);
      }
    }
  });

  test("every idea bullet that contains underscores is counted", () => {
    let withBlank = 0;
    for (const family of ROLE_FAMILIES) {
      for (const bullet of suggestionsForRole(undefined, [], family).bullets) {
        const underscoreRuns = (bullet.match(/_{2,}/g) ?? []).length;
        assert.equal(countUnfilled(bullet), underscoreRuns, bullet);
        if (underscoreRuns > 0) withBlank++;
      }
    }
    assert.ok(withBlank > 50, `expected most idea bullets to carry a blank, saw ${withBlank}`);
  });
});

describe("countUnfilled — what is and is not a blank", () => {
  test("counts each blank separately", () => {
    assert.equal(countUnfilled("Grew pipeline from AED __ to AED __ over __ months"), 3);
    assert.equal(countUnfilled("[Your role] with __ years in [your industry]"), 3);
    assert.equal(countUnfilled("Seeking a senior role in [Dubai / Abu Dhabi]"), 1);
    assert.equal(countUnfilled("Specialist in [domain]"), 1);
  });

  test("counts AI placeholders too", () => {
    assert.equal(countUnfilled("Cut costs by {{number}}% across [X] sites"), 2);
  });

  test("finished text has none", () => {
    for (const text of [
      "Grew pipeline from AED 2M to AED 5M over 18 months",
      "Client: [Confidential]",
      "See reference [1] and snake_case identifiers",
      "Led a team of 12 (3 nationalities)",
      "",
    ]) {
      assert.equal(countUnfilled(text), 0, text);
    }
    assert.equal(countUnfilled(undefined), 0);
    assert.equal(countUnfilled(null), 0);
  });

  test("does not widen the AI contract: a ready-made blank is not an AI placeholder", () => {
    assert.equal(hasPlaceholder("Closed __ new accounts"), false);
    assert.equal(hasPlaceholder("[Your role] with experience"), false);
  });
});

describe("getUnfilledBlanks", () => {
  const cv = (): CvData => ({
    ...defaultCvData,
    personal: {
      ...defaultCvData.personal,
      firstName: "Sara",
      lastName: "Khan",
      email: "sara@example.com",
      summary: "[Your role] with __ years in the UAE market.",
    },
    experience: [
      {
        id: "e1",
        company: "Al Noor Trading",
        role: "Sales Executive",
        location: "",
        startDate: "2022",
        endDate: "",
        isCurrent: true,
        bullets: ["Closed __ new B2B accounts, exceeding the annual target by __%.", "Managed 40 retail accounts"],
      },
      {
        id: "e2",
        company: "Gulf Retail",
        role: "Sales Associate",
        location: "",
        startDate: "2019",
        endDate: "2022",
        isCurrent: false,
        bullets: ["Served 60 customers a day"],
      },
    ],
    education: [{ id: "d1", school: "University of Sharjah", degree: "BBA", field: "", startDate: "2015", endDate: "2019" }],
    skills: [{ id: "s1", name: "Negotiation" }],
    projects: [{ id: "p1", name: "Store relaunch", bullets: ["Raised footfall by __%"] }],
  });

  test("lists each line with blanks, with a count, under its section", () => {
    const out = getUnfilledBlanks(cv());
    assert.deepEqual(
      out.map((m) => [m.sectionId, m.label]),
      [
        ["summary", "2 blanks to fill in your summary"],
        ["experience", "2 blanks to fill in the bullets for Sales Executive"],
        ["projects", "1 blank to fill in the bullets for Store relaunch"],
      ],
    );
  });

  test("is empty once the blanks are filled", () => {
    const filled = cv();
    filled.personal.summary = "Sales Executive with 6 years in the UAE market.";
    filled.experience[0].bullets[0] = "Closed 14 new B2B accounts, exceeding the annual target by 20%.";
    filled.projects[0].bullets[0] = "Raised footfall by 12%";
    assert.deepEqual(getUnfilledBlanks(filled), []);
  });

  test("is separate from required content: blanks never make a section 'missing'", () => {
    // Complete CV, blanks present: nothing required is missing.
    assert.deepEqual(getMissingItems(cv()), []);
    assert.ok(getUnfilledBlanks(cv()).length > 0);
  });
});
