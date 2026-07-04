/**
 * Role-family matching guards for the builder's idea suggestions + soft skills.
 *
 * There is no test framework in package.json — these use only the Node 18+
 * built-in `node:test` + `node:assert`, mirroring lib/jdMatch/match.test.ts.
 *
 * Run via the npm script (compiles to CommonJS, then runs node --test):
 *
 *   npm run test:rolematch
 *
 * They lock in the trailing-space whole-word convention so a short keyword
 * meant as a standalone word ("pro ", "bd ", "ops ") can never leak into a
 * larger word again — the "Process Excellence Manager" → admin regression:
 *  1. "process" must NOT surface admin/PRO suggestions (the bug),
 *  2. genuine PRO / Public Relations Officer titles still map to admin,
 *  3. whole-word abbreviations still fire ("BD Executive" → sales),
 *  4. plain substrings still work ("Sales Manager" → sales).
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { suggestionsForRole } from "./ideaSuggestions";
import { softSkillSuggestions } from "./softSkills";

const familyFor = (title: string) => suggestionsForRole(title).family;

describe("suggestionsForRole — trailing-space whole-word matching", () => {
  test('"Process Excellence Manager" is generic, not admin (the bug)', () => {
    // "process" contains "pro" — must NOT match the "pro " whole-word keyword.
    assert.equal(familyFor("Process Excellence Manager"), "generic");
  });

  test('"PRO" maps to admin (whole-word "pro ")', () => {
    assert.equal(familyFor("PRO"), "admin");
  });

  test('"Public Relations Officer" maps to admin', () => {
    assert.equal(familyFor("Public Relations Officer"), "admin");
  });

  test('"BD Executive" maps to sales (whole-word "bd ")', () => {
    assert.equal(familyFor("BD Executive"), "sales");
  });

  test('"Sales Manager" maps to sales (plain substring still works)', () => {
    assert.equal(familyFor("Sales Manager"), "sales");
  });
});

describe("suggestionsForRole — consolidated matcher (longest-wins) fixes", () => {
  test('"Software Engineer" is IT, not Engineering (old first-match bug)', () => {
    assert.equal(familyFor("Software Engineer"), "it");
  });
  test('"Civil Engineer" stays engineering', () => {
    assert.equal(familyFor("Civil Engineer"), "engineering");
  });
  test("an explicit confirmed domain overrides title inference", () => {
    // Ambiguous headline, but the user confirmed Sales → sales bullets.
    assert.equal(suggestionsForRole("Manager", [], "sales").family, "sales");
  });
});

describe("softSkillSuggestions — same convention, no admin leak", () => {
  test('"Process Excellence Manager" does not surface admin soft skills', () => {
    const skills = softSkillSuggestions("Process Excellence Manager");
    // "Discretion"/"Diplomacy" are admin-only family skills — must be absent.
    assert.equal(skills.includes("Discretion"), false);
    assert.equal(skills.includes("Diplomacy"), false);
  });

  test('"PRO" surfaces admin soft skills', () => {
    const skills = softSkillSuggestions("PRO");
    assert.equal(skills.includes("Discretion"), true);
  });

  test('"Sales Manager" surfaces sales soft skills', () => {
    const skills = softSkillSuggestions("Sales Manager");
    assert.equal(skills.includes("Negotiation"), true);
  });
});
