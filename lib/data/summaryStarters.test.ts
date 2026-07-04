/**
 * Guards the domain summary-starter bank (lib/data/summaryStarters.ts).
 * Built-in node:test + node:assert. Run via: npm run test:summarystarters
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { summaryStartersFor, ALL_SUMMARY_STARTERS } from "./summaryStarters";
import { findWeakPhrases } from "./genericPhrases";

describe("summaryStartersFor", () => {
  test("returns domain-tailored starters when a domain is set", () => {
    const sales = summaryStartersFor("sales");
    assert.ok(sales.length > 0);
    assert.ok(sales.some((s) => s.toLowerCase().includes("sales")));
    const healthcare = summaryStartersFor("healthcare");
    assert.ok(healthcare.some((s) => s.includes("DHA")));
  });

  test("falls back to generic for no domain / generic", () => {
    const generic = summaryStartersFor(undefined);
    assert.ok(generic.length > 0);
    assert.deepEqual(summaryStartersFor("generic"), generic);
  });

  test("respects the limit", () => {
    assert.equal(summaryStartersFor("it", 1).length, 1);
  });
});

describe("starter quality", () => {
  test("NO starter contains a weak/filler phrase (models good copy)", () => {
    for (const starter of ALL_SUMMARY_STARTERS) {
      const weak = findWeakPhrases(starter);
      assert.deepEqual(
        weak,
        [],
        `Starter contains weak phrase(s) ${JSON.stringify(weak)}: "${starter}"`,
      );
    }
  });

  test("every starter leaves at least one blank to fill (no fabricated metrics)", () => {
    for (const starter of ALL_SUMMARY_STARTERS) {
      assert.ok(
        starter.includes("__") || starter.includes("["),
        `Starter should leave a blank: "${starter}"`,
      );
    }
  });
});
