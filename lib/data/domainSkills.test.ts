/**
 * Guards the domain hard-skill / cert bank (lib/data/domainSkills.ts).
 * Built-in node:test + node:assert. Run via: npm run test:domainskills
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { domainHardSkills } from "./domainSkills";

describe("domainHardSkills", () => {
  test("returns the domain's hard skills / certs", () => {
    const finance = domainHardSkills("finance");
    assert.ok(finance.includes("IFRS"));
    assert.ok(finance.includes("UAE VAT / FTA"));
    const healthcare = domainHardSkills("healthcare");
    assert.ok(healthcare.some((s) => s.includes("DHA")));
  });

  test("no domain / generic yields nothing (chip stays hidden)", () => {
    assert.deepEqual(domainHardSkills(undefined), []);
    assert.deepEqual(domainHardSkills("generic"), []);
  });

  test("excludes already-added skills (case-insensitive)", () => {
    const picks = domainHardSkills("it", ["python", "AWS"]);
    assert.equal(picks.includes("Python"), false);
    assert.equal(picks.includes("AWS"), false);
    assert.ok(picks.includes("Docker"));
  });

  test("respects the limit", () => {
    assert.equal(domainHardSkills("it", [], 3).length, 3);
  });

  test("every real family has a non-empty bank", () => {
    const families = [
      "sales", "marketing", "finance", "accounting", "operations", "logistics",
      "hr", "admin", "engineering", "it", "hospitality", "retail", "realestate",
      "healthcare", "education", "customerservice",
    ] as const;
    for (const f of families) {
      assert.ok(domainHardSkills(f).length > 0, `${f} should have skills`);
    }
  });
});
