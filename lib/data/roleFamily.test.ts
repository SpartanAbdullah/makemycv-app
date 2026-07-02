/**
 * Guards the consolidated role-family inference (lib/data/roleFamily.ts) that
 * drives domain personalization.
 *
 * No test framework in package.json — built-in node:test + node:assert only,
 * mirroring lib/data/roleMatch.test.ts. Run via: npm run test:rolefamily
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  inferRoleFamily,
  ROLE_FAMILIES,
  ROLE_FAMILY_LABELS,
  SELECTABLE_ROLE_FAMILIES,
} from "./roleFamily";

const familyOf = (t: string) => inferRoleFamily(t).family;

describe("inferRoleFamily — preserves the pinned whole-word behavior", () => {
  test('"Process Excellence Manager" is generic (no "pro " leak)', () => {
    assert.equal(familyOf("Process Excellence Manager"), "generic");
  });
  test('"PRO" maps to admin (whole-word "pro ")', () => {
    assert.equal(familyOf("PRO"), "admin");
  });
  test('"Public Relations Officer" maps to admin', () => {
    assert.equal(familyOf("Public Relations Officer"), "admin");
  });
  test('"BD Executive" maps to sales (whole-word "bd ")', () => {
    assert.equal(familyOf("BD Executive"), "sales");
  });
  test('"Sales Manager" maps to sales', () => {
    assert.equal(familyOf("Sales Manager"), "sales");
  });
});

describe("inferRoleFamily — longest-match fixes tech/eng disambiguation", () => {
  test('"Software Engineer" is IT, not Engineering (the fix)', () => {
    const r = inferRoleFamily("Software Engineer");
    assert.equal(r.family, "it");
    assert.equal(r.confidence, "high");
  });
  test('"Senior DevOps Engineer" is IT', () => {
    assert.equal(familyOf("Senior DevOps Engineer"), "it");
  });
  test('"Civil Engineer" stays Engineering', () => {
    assert.equal(familyOf("Civil Engineer"), "engineering");
  });
  test('"Chief Financial Officer" is finance, not admin', () => {
    assert.equal(familyOf("Chief Financial Officer"), "finance");
  });
  test('"Operations Officer" is operations', () => {
    assert.equal(familyOf("Operations Officer"), "operations");
  });
  test('"Account Manager" is sales, not accounting', () => {
    assert.equal(familyOf("Account Manager"), "sales");
  });
});

describe("inferRoleFamily — confidence gating", () => {
  test("a distinctive keyword is high confidence", () => {
    assert.equal(inferRoleFamily("Registered Nurse").confidence, "high");
    assert.equal(inferRoleFamily("Marketing Lead").confidence, "high");
  });
  test("short/ambiguous abbreviations are low confidence (chip should ask)", () => {
    assert.equal(inferRoleFamily("PRO").confidence, "low");
    assert.equal(inferRoleFamily("HR").confidence, "low");
  });
  test("no match → generic + low confidence", () => {
    assert.equal(inferRoleFamily("Philosopher King").family, "generic");
    assert.equal(inferRoleFamily("Philosopher King").confidence, "low");
    assert.equal(inferRoleFamily("").family, "generic");
    assert.equal(inferRoleFamily(undefined).confidence, "low");
  });
});

describe("taxonomy metadata is complete", () => {
  test("every family has a label", () => {
    for (const f of ROLE_FAMILIES) {
      assert.equal(typeof ROLE_FAMILY_LABELS[f], "string");
      assert.ok(ROLE_FAMILY_LABELS[f].length > 0);
    }
  });
  test("selectable families exclude the generic fallback", () => {
    assert.equal(SELECTABLE_ROLE_FAMILIES.includes("generic"), false);
    assert.equal(SELECTABLE_ROLE_FAMILIES.length, ROLE_FAMILIES.length - 1);
  });
});
