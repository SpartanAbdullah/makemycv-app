/**
 * Guards the "meaningful education" filter that keeps blank entry shells off
 * the rendered CV and exports (lib/utils/education.ts).
 *
 * No test framework in package.json — built-in node:test + node:assert only,
 * mirroring lib/utils/projects.test.ts. Run via: npm run test:education
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { isMeaningfulEducation, meaningfulEducation } from "./education";
import type { CvEducation } from "../types/cv";

const make = (over: Partial<CvEducation>): CvEducation => ({
  id: "e1",
  school: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  notes: "",
  ...over,
});

describe("isMeaningfulEducation", () => {
  test("blank seeded shell is not meaningful", () => {
    assert.equal(isMeaningfulEducation(make({})), false);
    assert.equal(isMeaningfulEducation(make({ startDate: "2016", notes: "" })), false);
  });

  test("a school alone is meaningful", () => {
    assert.equal(isMeaningfulEducation(make({ school: "AUS" })), true);
  });

  test("a degree alone is meaningful", () => {
    assert.equal(isMeaningfulEducation(make({ degree: "BSc" })), true);
  });

  test("a field of study alone is meaningful", () => {
    assert.equal(isMeaningfulEducation(make({ field: "Computer Science" })), true);
  });

  test("whitespace-only fields are not meaningful", () => {
    assert.equal(
      isMeaningfulEducation(make({ school: " ", degree: "  ", field: "   " })),
      false,
    );
  });
});

describe("meaningfulEducation", () => {
  test("drops only blank shells, preserves order", () => {
    const real = make({ id: "a", degree: "MBA" });
    const shell = make({ id: "b" });
    const result = meaningfulEducation([real, shell]);
    assert.deepEqual(result.map((e) => e.id), ["a"]);
  });

  test("a single blank shell yields an empty list (no ghost section)", () => {
    assert.equal(meaningfulEducation([make({})]).length, 0);
  });
});
