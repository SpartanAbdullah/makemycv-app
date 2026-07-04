/**
 * Guards the "meaningful experience" filter that keeps blank role shells off
 * the rendered CV and exports (lib/utils/experience.ts).
 *
 * No test framework in package.json — built-in node:test + node:assert only,
 * mirroring lib/utils/projects.test.ts. Run via: npm run test:experience
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { isMeaningfulExperience, meaningfulExperience } from "./experience";
import type { CvExperience } from "../types/cv";

const make = (over: Partial<CvExperience>): CvExperience => ({
  id: "x1",
  company: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  bullets: [""],
  ...over,
});

describe("isMeaningfulExperience", () => {
  test("blank seeded shell is not meaningful", () => {
    assert.equal(isMeaningfulExperience(make({})), false);
    assert.equal(
      isMeaningfulExperience(make({ location: "Dubai", startDate: "2020" })),
      false,
    );
  });

  test("a role title alone is meaningful", () => {
    assert.equal(isMeaningfulExperience(make({ role: "Operations Manager" })), true);
  });

  test("a company alone is meaningful", () => {
    assert.equal(isMeaningfulExperience(make({ company: "Emaar" })), true);
  });

  test("a non-empty bullet alone is meaningful", () => {
    assert.equal(isMeaningfulExperience(make({ bullets: ["Cut costs 20%"] })), true);
  });

  test("whitespace-only fields are not meaningful", () => {
    assert.equal(
      isMeaningfulExperience(make({ role: "  ", company: " ", bullets: ["   "] })),
      false,
    );
  });
});

describe("meaningfulExperience", () => {
  test("drops only blank shells, preserves order", () => {
    const real = make({ id: "a", role: "Engineer" });
    const shell = make({ id: "b" });
    const result = meaningfulExperience([real, shell]);
    assert.deepEqual(result.map((r) => r.id), ["a"]);
  });

  test("a single blank shell yields an empty list (no ghost section)", () => {
    assert.equal(meaningfulExperience([make({})]).length, 0);
  });
});
