/**
 * Tests for the AI placeholder contract (lib/ai/placeholders.ts).
 *
 * The bug being prevented: AI-suggested bullets shipped invented metrics
 * ("cut discrepancies by 22%", "AED 4.5M budget") straight into a CV. The
 * prompts now emit {{number}} where a figure belongs, and the UI must be able
 * to find every such token so it can refuse to insert unresolved text.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  NUMBER_PLACEHOLDER,
  countPlaceholders,
  hasPlaceholder,
  normalizePlaceholders,
  splitPlaceholders,
} from "./placeholders";

describe("hasPlaceholder", () => {
  test("detects the canonical token", () => {
    assert.equal(hasPlaceholder("Cut costs by {{number}}%"), true);
  });
  test("detects the bracket variants models emit", () => {
    assert.equal(hasPlaceholder("Reduced churn by [X]%"), true);
    assert.equal(hasPlaceholder("Managed [x] staff"), true);
    assert.equal(hasPlaceholder("Grew revenue {{ metric }}"), true);
  });
  test("ignores ordinary text and real numbers", () => {
    assert.equal(hasPlaceholder("Reduced churn by 15%"), false);
    assert.equal(hasPlaceholder("Managed a team of 12 across 3 sites"), false);
    assert.equal(hasPlaceholder("Used [brackets] for context"), false);
  });
  test("is safe to call repeatedly (global regex state is reset)", () => {
    const t = "Saved {{number}} hours";
    assert.equal(hasPlaceholder(t), true);
    assert.equal(hasPlaceholder(t), true);
    assert.equal(hasPlaceholder("no token"), false);
    assert.equal(hasPlaceholder(t), true);
  });
});

describe("countPlaceholders / splitPlaceholders", () => {
  test("counts every occurrence", () => {
    assert.equal(countPlaceholders("{{number}} and [X] and {{number}}"), 3);
    assert.equal(countPlaceholders("none"), 0);
  });
  test("splits into plain and placeholder runs in order", () => {
    const parts = splitPlaceholders("Cut lead time by {{number}}% across [X] sites.");
    assert.deepEqual(parts, [
      { text: "Cut lead time by ", placeholder: false },
      { text: "{{number}}", placeholder: true },
      { text: "% across ", placeholder: false },
      { text: "[X]", placeholder: true },
      { text: " sites.", placeholder: false },
    ]);
  });
  test("round-trips: joining the parts gives the original text", () => {
    const t = "{{number}} years leading [x] people";
    assert.equal(splitPlaceholders(t).map((p) => p.text).join(""), t);
  });
});

describe("normalizePlaceholders", () => {
  test("rewrites every variant to the canonical token", () => {
    assert.equal(
      normalizePlaceholders("[X]% and {{ metric }} and [x]"),
      `${NUMBER_PLACEHOLDER}% and ${NUMBER_PLACEHOLDER} and ${NUMBER_PLACEHOLDER}`,
    );
  });
});
