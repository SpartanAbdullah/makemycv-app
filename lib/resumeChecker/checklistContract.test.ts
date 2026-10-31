/**
 * The payload GET /api/resume-checker/checklist serves to the marketing site
 * (lib/resumeChecker/checklistContract.ts). The site's CI script reads
 * `version`, `count` and each category's `id` + `count`; this suite pins
 * those fields so a refactor here cannot silently break the site's check.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { CHECKLIST, CHECKLIST_SIGNAL_COUNT, CHECKLIST_CATEGORY_COUNT } from "./checklist";
import {
  buildChecklistContract,
  CHECKLIST_CONTRACT_VERSION,
} from "./checklistContract";

describe("checklist contract payload", () => {
  const contract = buildChecklistContract();

  test("version is 1 and the shape the site script reads is present", () => {
    assert.equal(CHECKLIST_CONTRACT_VERSION, 1);
    assert.equal(contract.version, 1);
    assert.equal(typeof contract.count, "number");
    assert.ok(Array.isArray(contract.categories));
    for (const c of contract.categories) {
      assert.equal(typeof c.id, "string");
      assert.equal(typeof c.label, "string");
      assert.equal(typeof c.count, "number");
      assert.ok(Array.isArray(c.items));
      for (const i of c.items) {
        assert.equal(typeof i.id, "string");
        assert.equal(typeof i.label, "string");
        assert.equal(typeof i.parserOnly, "boolean");
        assert.ok(i.signals.length >= 1, `${i.id} has signals`);
      }
    }
  });

  test("count equals the checklist's signal count and the sum of categories", () => {
    assert.equal(contract.count, CHECKLIST_SIGNAL_COUNT);
    assert.equal(
      contract.categories.reduce((s, c) => s + c.count, 0),
      contract.count,
    );
    assert.equal(contract.categories.length, CHECKLIST_CATEGORY_COUNT);
  });

  test("category ids and per-category counts mirror checklist.ts in order", () => {
    assert.deepEqual(
      contract.categories.map((c) => c.id),
      CHECKLIST.map((g) => g.category),
    );
    for (const [idx, g] of CHECKLIST.entries()) {
      const expected = g.items.reduce((s, i) => s + i.ids.length, 0);
      assert.equal(contract.categories[idx].count, expected, g.category);
      assert.equal(contract.categories[idx].items.length, g.items.length, g.category);
    }
  });

  test("item ids are unique across the payload and every signal appears once", () => {
    const ids = contract.categories.flatMap((c) => c.items.map((i) => i.id));
    assert.equal(new Set(ids).size, ids.length, "item ids unique");
    const signals = contract.categories.flatMap((c) => c.items.flatMap((i) => i.signals));
    assert.equal(new Set(signals).size, signals.length, "signals unique");
    assert.equal(signals.length, contract.count);
  });

  test("the payload round-trips through JSON unchanged", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(contract)), contract);
  });
});
