/**
 * Sanity checks for the deterministic JD matcher (lib/jdMatch/match.ts).
 *
 * There is no test framework in package.json — these use only the Node 18+
 * built-in `node:test` + `node:assert`, mirroring lib/store/migrate.test.ts.
 *
 * Run via the npm script (compiles to CommonJS, then runs node --test):
 *
 *   npm run test:jdmatch
 *
 * They guard the three properties the matcher must never regress on:
 *  1. present terms match (SAP, Lean Six Sigma),
 *  2. absent terms are reported missing (PMP),
 *  3. single tokens respect word boundaries ("java" must NOT match
 *     "javascript"), and the small alias map works ("Microsoft Excel" ↔
 *     "Excel").
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { matchRequirementsToCv } from "./match";
import type { JdRequirements } from "./types";
import type { CvData } from "../types/cv";

/** Minimal but type-complete CvData with controllable text. */
function makeCv(opts: { bullets: string[]; skills: string[] }): CvData {
  return {
    personal: {
      firstName: "Test",
      lastName: "User",
      headline: "Process Excellence Manager",
      email: "",
      phone: "",
      location: "Dubai",
      website: "",
      linkedin: "",
      summary: "",
    },
    experience: [
      {
        id: "exp-1",
        company: "Acme FZE",
        role: "Process Excellence Manager",
        location: "Dubai",
        startDate: "",
        endDate: "",
        isCurrent: true,
        bullets: opts.bullets,
      },
    ],
    education: [],
    skills: opts.skills.map((name, i) => ({ id: `sk-${i}`, name })),
    languages: [],
    certifications: [],
    projects: [],
    settings: { templateId: "classic" },
  };
}

const cv = makeCv({
  bullets: [
    "Led SAP ERP rollout and Lean Six Sigma process improvements across UAE sites.",
  ],
  skills: ["JavaScript", "Excel"],
});

const requirements: JdRequirements = {
  jobTitle: "Process Excellence Manager",
  hardSkills: ["Lean Six Sigma", "Java", "JavaScript"],
  tools: ["SAP", "Microsoft Excel"],
  certifications: ["PMP"],
  softSkills: [],
  keywords: [],
};

const result = matchRequirementsToCv(requirements, cv);
const matchedOf = (term: string) =>
  result.terms.find((t) => t.term === term)?.matched;

describe("matchRequirementsToCv", () => {
  test("present multi-word and single-token terms match", () => {
    assert.equal(matchedOf("Lean Six Sigma"), true, "Lean Six Sigma present");
    assert.equal(matchedOf("SAP"), true, "SAP present in a bullet");
    assert.equal(matchedOf("JavaScript"), true, "JavaScript present as a skill");
  });

  test("absent terms are reported missing", () => {
    assert.equal(matchedOf("PMP"), false, "PMP is not anywhere in the CV");
  });

  test("single tokens respect word boundaries (java !== javascript)", () => {
    // "javascript" is in the corpus; the requirement "Java" must NOT match it.
    assert.equal(matchedOf("Java"), false, "Java must not match javascript");
  });

  test("alias map: Microsoft Excel matches an 'Excel' skill", () => {
    assert.equal(matchedOf("Microsoft Excel"), true, "Excel alias matches");
  });

  test("score is a weighted 0–100 integer with a band", () => {
    assert.ok(
      Number.isInteger(result.score) &&
        result.score >= 0 &&
        result.score <= 100,
      `score in range: ${result.score}`,
    );
    assert.ok(
      ["strong", "good", "partial", "low"].includes(result.band),
      `band valid: ${result.band}`,
    );
    // 4 of 6 terms matched, but weighting differs by category — just assert
    // the count rollup is internally consistent.
    assert.equal(
      result.matchedCount,
      result.terms.filter((t) => t.matched).length,
    );
    assert.equal(result.totalRequirements, result.terms.length);
  });
});
