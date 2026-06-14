/**
 * Sanity checks for per-job CV tailoring (lib/jdMatch/tailorCv.ts).
 * Built-in node:test only. Run: npm run test:tailor
 *
 * Invariants:
 *  1. relevant skills kept, irrelevant dropped (focused copy),
 *  2. relevance is variant-aware (M365 ↔ Microsoft 365),
 *  3. the user can KEEP a hidden skill explicitly,
 *  4. NON-DESTRUCTIVE — the master CV is never mutated,
 *  5. non-skill sections pass through unchanged.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { buildTailoredCv, skillIsRelevant } from "./tailorCv";
import type { CvData } from "../types/cv";

function makeCv(skills: string[]): CvData {
  return {
    personal: {
      firstName: "Aisha", lastName: "Khan", headline: "Analyst",
      email: "", phone: "", location: "Dubai", website: "", linkedin: "", summary: "Experienced analyst.",
    },
    experience: [
      { id: "e1", company: "Acme", role: "Analyst", location: "Dubai", startDate: "", endDate: "", isCurrent: true, bullets: ["Did things."] },
    ],
    education: [],
    skills: skills.map((name, i) => ({ id: `s${i}`, name })),
    languages: [],
    certifications: [],
    projects: [],
    settings: { templateId: "classic" },
  };
}

describe("skillIsRelevant", () => {
  test("exact + variant matches are relevant; unrelated is not", () => {
    const reqs = ["Microsoft 365", "Power BI", "SQL"];
    assert.equal(skillIsRelevant("Power BI", reqs), true, "exact");
    assert.equal(skillIsRelevant("M365", reqs), true, "variant abbreviation");
    assert.equal(skillIsRelevant("Gardening", reqs), false, "unrelated");
  });
});

describe("buildTailoredCv", () => {
  test("keeps relevant skills, drops irrelevant into hiddenSkills", () => {
    const cv = makeCv(["Power BI", "Excel", "Gardening", "Cooking"]);
    const { tailoredCv, hiddenSkills } = buildTailoredCv(cv, ["Power BI", "Microsoft Excel"]);
    assert.deepEqual(tailoredCv.skills.map((s) => s.name), ["Power BI", "Excel"]);
    assert.deepEqual(hiddenSkills.map((s) => s.name), ["Gardening", "Cooking"]);
  });

  test("keepNames restores a hidden skill into the focused copy", () => {
    const cv = makeCv(["Power BI", "Leadership"]);
    const { tailoredCv, hiddenSkills } = buildTailoredCv(cv, ["Power BI"], new Set(["Leadership"]));
    assert.deepEqual(tailoredCv.skills.map((s) => s.name), ["Power BI", "Leadership"]);
    assert.equal(hiddenSkills.length, 0);
  });

  test("does NOT mutate the master CV", () => {
    const cv = makeCv(["Power BI", "Gardening"]);
    const before = cv.skills.length;
    buildTailoredCv(cv, ["Power BI"]);
    assert.equal(cv.skills.length, before, "master skills untouched");
    assert.equal(cv.skills.length, 2);
  });

  test("passes non-skill sections through unchanged", () => {
    const cv = makeCv(["Power BI"]);
    const { tailoredCv } = buildTailoredCv(cv, ["Power BI"]);
    assert.equal(tailoredCv.experience, cv.experience, "experience passed by reference");
    assert.equal(tailoredCv.personal.summary, "Experienced analyst.");
  });

  test("no relevant skills → all hidden (focused copy has an empty skills list)", () => {
    const cv = makeCv(["Gardening", "Cooking"]);
    const { tailoredCv, hiddenSkills } = buildTailoredCv(cv, ["Power BI"]);
    assert.equal(tailoredCv.skills.length, 0);
    assert.equal(hiddenSkills.length, 2);
  });
});
