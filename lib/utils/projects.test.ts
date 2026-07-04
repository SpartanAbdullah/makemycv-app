/**
 * Guards the "meaningful project" filter that keeps empty project shells off
 * the rendered CV and exports (lib/utils/projects.ts).
 *
 * No test framework in package.json — built-in node:test + node:assert only,
 * mirroring lib/jdMatch/applyFix.test.ts. Run via: npm run test:projects
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { isMeaningfulProject, meaningfulProjects } from "./projects";
import type { CvProject } from "../types/cv";

const make = (over: Partial<CvProject>): CvProject => ({
  id: "p1",
  name: "",
  link: "",
  bullets: [""],
  ...over,
});

describe("isMeaningfulProject", () => {
  test("blank shell (no name, only empty bullets) is not meaningful", () => {
    assert.equal(isMeaningfulProject(make({})), false);
    assert.equal(isMeaningfulProject(make({ bullets: ["", "   "] })), false);
    assert.equal(isMeaningfulProject(make({ name: "   " })), false);
  });

  test("a name alone makes a project meaningful", () => {
    assert.equal(isMeaningfulProject(make({ name: "Dubai Mall Fit-Out" })), true);
  });

  test("a non-empty bullet alone makes a project meaningful", () => {
    assert.equal(
      isMeaningfulProject(make({ name: "", bullets: ["Built a thing"] })),
      true,
    );
  });

  test("tolerates a missing bullets array", () => {
    assert.equal(
      isMeaningfulProject({ id: "x", name: "", bullets: undefined as unknown as string[] }),
      false,
    );
  });
});

describe("meaningfulProjects", () => {
  test("filters out only the blank shells, preserves order", () => {
    const real = make({ id: "a", name: "Real" });
    const shell = make({ id: "b" });
    const bulletOnly = make({ id: "c", bullets: ["Did X"] });
    const result = meaningfulProjects([real, shell, bulletOnly]);
    assert.deepEqual(
      result.map((p) => p.id),
      ["a", "c"],
    );
  });

  test("a single blank shell yields an empty list (no ghost section)", () => {
    assert.equal(meaningfulProjects([make({})]).length, 0);
  });

  test("empty input yields empty output", () => {
    assert.equal(meaningfulProjects([]).length, 0);
  });
});
