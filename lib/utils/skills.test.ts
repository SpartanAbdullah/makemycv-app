/**
 * Guards the technical/general skill split (lib/utils/skills.ts).
 * Built-in node:test + node:assert. Run via: npm run test:skills
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { splitSkills } from "./skills";
import type { CvSkill } from "../types/cv";

const s = (name: string, category?: "technical" | "general"): CvSkill => ({
  id: name,
  name,
  ...(category ? { category } : {}),
});

describe("splitSkills", () => {
  test("routes technical vs general, preserving order", () => {
    const { general, technical } = splitSkills([
      s("Leadership"),
      s("Python", "technical"),
      s("Communication", "general"),
      s("AWS", "technical"),
    ]);
    assert.deepEqual(general.map((x) => x.name), ["Leadership", "Communication"]);
    assert.deepEqual(technical.map((x) => x.name), ["Python", "AWS"]);
  });

  test("no categories → all general (backward compatible)", () => {
    const { general, technical } = splitSkills([s("A"), s("B")]);
    assert.equal(general.length, 2);
    assert.equal(technical.length, 0);
  });

  test("empty list", () => {
    assert.deepEqual(splitSkills([]), { general: [], technical: [] });
  });
});
