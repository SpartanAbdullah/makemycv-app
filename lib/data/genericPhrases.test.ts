/**
 * Guards the weak-phrase detector (lib/data/genericPhrases.ts).
 * Built-in node:test + node:assert. Run via: npm run test:genericphrases
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { findWeakPhrases, hasWeakPhrase } from "./genericPhrases";

describe("hasWeakPhrase / findWeakPhrases", () => {
  test("flags classic filler", () => {
    assert.equal(hasWeakPhrase("Responsible for managing the team"), true);
    assert.equal(hasWeakPhrase("A hardworking team player"), true);
    assert.equal(hasWeakPhrase("Proven track record in sales"), true);
    assert.deepEqual(
      findWeakPhrases("Responsible for the team; a real team player"),
      ["responsible for", "team player"],
    );
  });

  test("is case-insensitive", () => {
    assert.equal(hasWeakPhrase("RESPONSIBLE FOR operations"), true);
  });

  test("does not false-positive on strong, quantified wording", () => {
    assert.equal(
      hasWeakPhrase("Grew UAE revenue 32% by rebuilding the HubSpot pipeline"),
      false,
    );
    assert.equal(hasWeakPhrase("Led a team of 14 across 3 sites"), false);
  });

  test("empty / undefined text is clean", () => {
    assert.equal(hasWeakPhrase(""), false);
    assert.equal(hasWeakPhrase(undefined), false);
    assert.deepEqual(findWeakPhrases(""), []);
  });

  test("does not leak on substrings (word-boundary aware)", () => {
    // "reteam" / "teamwork" must not trigger "team player" etc.
    assert.equal(hasWeakPhrase("Delivered teamwork workshops"), false);
  });
});
