/**
 * Tests for the /api/ai-improve input limits (lib/ai/improveInput.ts).
 *
 * The invariant being guarded: however large the request, the text that can
 * reach the prompt stays bounded, and a normal CV passes through untouched.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { IMPROVE_LIMITS, clipImproveInput } from "./improveInput";

const big = "x".repeat(50_000);

function totalChars(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce((n: number, v) => n + totalChars(v), 0);
  if (value && typeof value === "object") return totalChars(Object.values(value));
  return 0;
}

describe("clipImproveInput", () => {
  test("leaves a normal CV unchanged", () => {
    const input = {
      jobTitle: "Senior Accountant",
      company: "ACME Trading LLC",
      existingBullets: ["Prepared monthly VAT returns", "Closed the books on time"],
      headline: "Senior Accountant, IFRS and VAT",
      experienceRoles: [
        {
          title: "Senior Accountant",
          company: "ACME Trading LLC",
          bullets: ["Prepared monthly VAT returns", "Closed the books on time"],
        },
      ],
      existingSkills: ["IFRS", "VAT", "Excel"],
      existingSummary: "Accountant with UAE experience.",
    };
    assert.deepEqual(clipImproveInput(input), input);
  });

  test("clips every text field to its limit", () => {
    const out = clipImproveInput({
      jobTitle: big,
      company: big,
      headline: big,
      existingSummary: big,
      existingBullets: [big],
      existingSkills: [big],
    });
    assert.equal(out.jobTitle.length, IMPROVE_LIMITS.shortField);
    assert.equal(out.company.length, IMPROVE_LIMITS.shortField);
    assert.equal(out.headline.length, IMPROVE_LIMITS.shortField);
    assert.equal(out.existingSummary.length, IMPROVE_LIMITS.summary);
    assert.equal(out.existingBullets[0].length, IMPROVE_LIMITS.bullet);
    assert.equal(out.existingSkills[0].length, IMPROVE_LIMITS.skill);
  });

  test("caps list lengths", () => {
    const out = clipImproveInput({
      existingBullets: Array(500).fill("a bullet"),
      existingSkills: Array(500).fill("a skill"),
      experienceRoles: Array(500).fill({ title: "T", company: "C", bullets: [] }),
    });
    assert.equal(out.existingBullets.length, IMPROVE_LIMITS.bulletsPerRole);
    assert.equal(out.existingSkills.length, IMPROVE_LIMITS.skills);
    assert.equal(out.experienceRoles.length, IMPROVE_LIMITS.roles);
  });

  test("role bullets share one budget, and later roles keep their titles", () => {
    const role = { title: "Role", company: "Co", bullets: Array(20).fill("y".repeat(600)) };
    const out = clipImproveInput({ experienceRoles: Array(15).fill(role) });
    const bulletChars = out.experienceRoles.reduce((n, r) => n + totalChars(r.bullets), 0);
    assert.equal(bulletChars, IMPROVE_LIMITS.roleBulletsTotal);
    assert.equal(out.experienceRoles[14].title, "Role");
    assert.deepEqual(out.experienceRoles[14].bullets, []);
  });

  test("the worst case for any request stays bounded", () => {
    const out = clipImproveInput({
      jobTitle: big,
      company: big,
      headline: big,
      existingSummary: big,
      existingBullets: Array(500).fill(big),
      existingSkills: Array(500).fill(big),
      experienceRoles: Array(500).fill({ title: big, company: big, bullets: Array(500).fill(big) }),
    });
    const L = IMPROVE_LIMITS;
    const bound =
      L.shortField * 3 +
      L.summary +
      L.bulletsPerRole * L.bullet +
      L.skills * L.skill +
      L.roles * L.shortField * 2 +
      L.roleBulletsTotal;
    assert.equal(totalChars(out), bound);
    // Every field at once. Each prompt reads only some of them.
    assert.ok(bound < 40_000, `got ${bound} characters`);
  });

  test("drops values of the wrong type instead of throwing", () => {
    const out = clipImproveInput({
      jobTitle: 42,
      company: null,
      headline: {},
      existingSummary: [],
      existingBullets: "not a list",
      existingSkills: [1, null, "Excel", ""],
      experienceRoles: [null, "x", { title: 5, company: null, bullets: "nope" }, { bullets: [7, "Led audits"] }],
    });
    assert.equal(out.jobTitle, "");
    assert.equal(out.company, "");
    assert.equal(out.headline, "");
    assert.equal(out.existingSummary, "");
    assert.deepEqual(out.existingBullets, []);
    assert.deepEqual(out.existingSkills, ["Excel"]);
    assert.deepEqual(out.experienceRoles, [
      { title: "", company: "", bullets: [] },
      { title: "", company: "", bullets: ["Led audits"] },
    ]);
  });

  test("ignores fields the prompts do not read", () => {
    const out = clipImproveInput({ jobTitle: "Accountant", personal: { passport: "A123" } });
    assert.ok(!("personal" in out));
  });
});
