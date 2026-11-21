/**
 * Tests for the skills normaliser that runs on every load
 * (lib/store/cvStore.ts, called from bindCvStorage).
 *
 * It exists to repair old data, and it must not damage current data while
 * doing so. The 2026-11 audit found it did: it rebuilt each skill from a
 * fixed list of fields that predated `category`, so a reload stripped the
 * technical / general grouping the user had set (audit D1).
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { ensureSkillIds } from "./cvStore";
import { splitSkills } from "../utils/skills";

describe("ensureSkillIds", () => {
  test("keeps the technical / general grouping across a load", () => {
    const stored = [
      { id: "a", name: "Power BI", category: "technical" },
      { id: "b", name: "Stakeholder management", category: "general" },
      { id: "c", name: "Excel" },
    ];
    const out = ensureSkillIds(stored);
    assert.deepEqual(out, stored);
    assert.deepEqual(
      splitSkills(out).technical.map((s) => s.name),
      ["Power BI"],
    );
  });

  test("keeps level and category together", () => {
    assert.deepEqual(
      ensureSkillIds([{ id: "a", name: "SQL", level: "advanced", category: "technical" }]),
      [{ id: "a", name: "SQL", level: "advanced", category: "technical" }],
    );
  });

  test("drops a category it does not know instead of storing it", () => {
    assert.deepEqual(ensureSkillIds([{ id: "a", name: "SQL", category: "core" }]), [
      { id: "a", name: "SQL" },
    ]);
  });

  test("still repairs legacy shapes", () => {
    const out = ensureSkillIds(["  Excel  ", "", { name: "Tally" }, { id: "x" }, null, 7]);
    assert.equal(out.length, 2);
    assert.equal(out[0].name, "Excel");
    assert.equal(out[1].name, "Tally");
    assert.ok(out[0].id && out[1].id, "missing ids are minted");
    assert.deepEqual(ensureSkillIds("not a list"), []);
  });
});
