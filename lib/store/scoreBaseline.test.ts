/**
 * Tests for the stored-score-baseline guard (lib/store/cvStore.ts).
 *
 * The TopBar delta pill subtracts an import-time baseline held in localStorage
 * from a freshly computed total. Those two numbers are only comparable when
 * both came from the same scoring rubric — so when the rubric changes, an
 * untouched CV appears to move. The 2026-08-24 accuracy pass did exactly that
 * (removed the duplicate phone/summary signals, added the UAE essentials), and
 * without this guard every returning user with a pre-deploy import would have
 * been shown a red "Down 4 points since you imported this CV" for a document
 * they had not edited.
 *
 * parseStoredBaseline is pure precisely so this rule can be tested without a
 * browser; bindCvStorage only wires it up.
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { parseStoredBaseline, writeStorage } from "./cvStore";
import { SCORING_RUBRIC_VERSION } from "../scoreEngine";

describe("writeStorage (2026-10-31: side records must not throw on quota)", () => {
  // Node has no window; stand one in with a localStorage whose setItem fails
  // the way Chrome's does at 5 MB per origin or in a private window.
  const g = globalThis as unknown as { window?: unknown };
  const withWindow = (setItem: (k: string, v: string) => void, fn: () => void) => {
    const prev = g.window;
    g.window = { localStorage: { setItem } };
    try {
      fn();
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  };

  test("returns false instead of throwing when the write is refused", () => {
    const quota = () => {
      const e = new Error("exceeded the quota");
      e.name = "QuotaExceededError";
      throw e;
    };
    withWindow(quota, () => {
      let result = true;
      assert.doesNotThrow(() => {
        result = writeStorage("makemycv:parseSignals", "{}");
      });
      assert.equal(result, false);
    });
  });

  test("returns true and stores the value when the write lands", () => {
    const seen: Record<string, string> = {};
    withWindow((k, v) => { seen[k] = v; }, () => {
      assert.equal(writeStorage("makemycv:scoreBaseline", "x"), true);
      assert.equal(seen["makemycv:scoreBaseline"], "x");
    });
  });

  test("is a no-op outside the browser", () => {
    assert.equal(typeof (globalThis as { window?: unknown }).window, "undefined");
    assert.equal(writeStorage("makemycv:isPro", "true"), false);
  });
});

const valid = () =>
  JSON.stringify({
    total: 77,
    grade: "good",
    capturedAt: 1_756_000_000_000,
    rubric: SCORING_RUBRIC_VERSION,
  });

describe("parseStoredBaseline", () => {
  test("accepts a baseline from the current rubric", () => {
    const b = parseStoredBaseline(valid());
    assert.ok(b);
    assert.equal(b.total, 77);
    assert.equal(b.grade, "good");
    assert.equal(b.capturedAt, 1_756_000_000_000);
    assert.equal(b.rubric, SCORING_RUBRIC_VERSION);
  });

  test("rejects a baseline from an older rubric", () => {
    const stale = JSON.stringify({
      total: 100,
      grade: "excellent",
      capturedAt: 1,
      rubric: SCORING_RUBRIC_VERSION - 1,
    });
    assert.equal(parseStoredBaseline(stale), null);
  });

  test("rejects a baseline from a NEWER rubric too", () => {
    // A second tab on a newer deploy, or a rollback. Either way the number is
    // not comparable to what this build computes.
    const future = JSON.stringify({
      total: 100,
      grade: "excellent",
      capturedAt: 1,
      rubric: SCORING_RUBRIC_VERSION + 1,
    });
    assert.equal(parseStoredBaseline(future), null);
  });

  test("rejects a pre-versioning baseline (no rubric field)", () => {
    // The exact shape every user had in localStorage before this guard: it
    // parsed fine and was accepted on the sole check `typeof total === number`.
    const legacy = JSON.stringify({
      total: 100,
      grade: "excellent",
      capturedAt: 1_755_000_000_000,
    });
    assert.equal(parseStoredBaseline(legacy), null);
  });

  test("rejects malformed and empty input without throwing", () => {
    for (const raw of [
      null,
      "",
      "not json",
      "{",
      "null",
      "[]",
      '"a string"',
      "42",
      JSON.stringify({ grade: "good", rubric: SCORING_RUBRIC_VERSION }),
      JSON.stringify({ total: "77", rubric: SCORING_RUBRIC_VERSION }),
      JSON.stringify({ total: NaN, rubric: SCORING_RUBRIC_VERSION }),
      JSON.stringify({ total: 77, rubric: String(SCORING_RUBRIC_VERSION) }),
    ]) {
      assert.equal(
        parseStoredBaseline(raw as string | null),
        null,
        `should reject: ${String(raw)}`,
      );
    }
  });

  test("a missing capturedAt does not sink an otherwise valid baseline", () => {
    // capturedAt only labels the pill; the comparison itself is total-to-total.
    const b = parseStoredBaseline(
      JSON.stringify({ total: 60, grade: "needs-work", rubric: SCORING_RUBRIC_VERSION }),
    );
    assert.ok(b);
    assert.equal(b.total, 60);
    assert.equal(b.capturedAt, 0);
  });
});
