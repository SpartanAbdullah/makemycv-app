/**
 * Guards the technical/general skill split (lib/utils/skills.ts).
 * Built-in node:test + node:assert. Run via: npm run test:skills
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { skillListDirection, skillNames, splitSkills } from "./skills";
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

describe("skillNames", () => {
  test("trims, drops empty names, keeps order", () => {
    assert.deepEqual(skillNames([s(" Excel "), s(""), s("   "), s("SQL")]), ["Excel", "SQL"]);
  });
});

describe("skillListDirection", () => {
  test("a Latin-first list flows left to right", () => {
    assert.equal(skillListDirection(["Excel", "Power BI"]), "ltr");
    assert.equal(skillListDirection(["Excel", "التحرير باللغة العربية"]), "ltr");
  });

  test("an Arabic-first list flows right to left, as the joined line did", () => {
    assert.equal(skillListDirection(["إدارة المشاريع", "Excel"]), "rtl");
  });

  test("letterless or empty lists fall back to left to right", () => {
    assert.equal(skillListDirection(["3D", "C++"]), "ltr");
    assert.equal(skillListDirection(["123"]), "ltr");
    assert.equal(skillListDirection([]), "ltr");
  });
});
