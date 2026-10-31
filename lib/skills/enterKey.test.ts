/**
 * Tests for the Enter-key rule in the Skills search box (lib/skills/enterKey.ts).
 *
 * The bug being fixed (backlog E7, QA D4): Enter added the first suggestion
 * instead of the typed skill. These pin the rule: typed text wins unless a
 * suggestion was highlighted with the arrow keys.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { NO_HIGHLIGHT, moveHighlight, pickableResults, resolveEnter } from "./enterKey";

const r = (name: string, alreadyHave = false) => ({ name, alreadyHave });
const results = [r("Fleet Management"), r("Logistics", true), r("Route Planning")];

describe("resolveEnter", () => {
  test("Enter with nothing highlighted adds the typed text, even when suggestions exist — the reported bug", () => {
    assert.deepEqual(resolveEnter("Fleet management", results, NO_HIGHLIGHT), { kind: "typed", name: "Fleet management" });
  });

  test("typed text is trimmed", () => {
    assert.deepEqual(resolveEnter("  Tally ERP  ", [], NO_HIGHLIGHT), { kind: "typed", name: "Tally ERP" });
  });

  test("blank input does nothing", () => {
    assert.deepEqual(resolveEnter("   ", results, NO_HIGHLIGHT), { kind: "none" });
    assert.deepEqual(resolveEnter("", [], NO_HIGHLIGHT), { kind: "none" });
  });

  test("a highlighted suggestion is used — counted over pickable rows only", () => {
    assert.deepEqual(resolveEnter("fleet", results, 0), { kind: "suggestion", suggestion: r("Fleet Management") });
    // Index 1 skips the "you already have Logistics" note.
    assert.deepEqual(resolveEnter("fleet", results, 1), { kind: "suggestion", suggestion: r("Route Planning") });
  });

  test("a stale highlight past the list falls back to the typed text", () => {
    assert.deepEqual(resolveEnter("fleet", results, 7), { kind: "typed", name: "fleet" });
    assert.deepEqual(resolveEnter("fleet", [], 0), { kind: "typed", name: "fleet" });
  });
});

describe("pickableResults", () => {
  test("drops alreadyHave rows, keeps order", () => {
    assert.deepEqual(pickableResults(results).map((x) => x.name), ["Fleet Management", "Route Planning"]);
  });
});

describe("moveHighlight", () => {
  test("ArrowDown from nothing lands on the first option; ArrowUp from the first returns to nothing", () => {
    assert.equal(moveHighlight(NO_HIGHLIGHT, 1, 2), 0);
    assert.equal(moveHighlight(0, -1, 2), NO_HIGHLIGHT);
    assert.equal(moveHighlight(NO_HIGHLIGHT, -1, 2), NO_HIGHLIGHT);
  });

  test("clamps at the last option instead of wrapping", () => {
    assert.equal(moveHighlight(1, 1, 2), 1);
    assert.equal(moveHighlight(0, 1, 2), 1);
  });

  test("no options means no highlight", () => {
    assert.equal(moveHighlight(0, 1, 0), NO_HIGHLIGHT);
    assert.equal(moveHighlight(NO_HIGHLIGHT, 1, 0), NO_HIGHLIGHT);
  });
});
