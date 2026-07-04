/**
 * Guards the colour-intelligence helpers (lib/utils/color.ts).
 * Built-in node:test + node:assert. Run via: npm run test:color
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  hexToRgb,
  rgbToHex,
  contrastRatio,
  onColor,
  ensureReadableOn,
  mix,
  isLight,
} from "./color";

describe("hex parsing", () => {
  test("parses 6- and 3-digit hex, round-trips", () => {
    assert.deepEqual(hexToRgb("#1E2A4A"), { r: 30, g: 42, b: 74 });
    assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
    assert.equal(rgbToHex({ r: 30, g: 42, b: 74 }), "#1e2a4a");
  });
  test("rejects garbage", () => {
    assert.equal(hexToRgb("nope"), null);
    assert.equal(hexToRgb("#12"), null);
  });
});

describe("contrastRatio", () => {
  test("black/white is ~21, identical is 1", () => {
    assert.ok(contrastRatio("#000000", "#ffffff") > 20);
    assert.equal(Math.round(contrastRatio("#333333", "#333333")), 1);
  });
});

describe("onColor — readable ink on a background", () => {
  test("white text on dark navy, dark text on pale yellow", () => {
    assert.equal(onColor("#1E2A4A"), "#FFFFFF");
    assert.equal(onColor("#F5E27A"), "#1F2937");
    assert.equal(onColor("#ECE3D2"), "#1F2937"); // Sandstone beige → dark text
  });
  test("whatever it returns actually meets AA (>=4.5) on the bg", () => {
    for (const bg of ["#1E2A4A", "#F5E27A", "#ECE3D2", "#7A1F2B", "#FFD400"]) {
      assert.ok(contrastRatio(bg, onColor(bg)) >= 4.5, `onColor failed for ${bg}`);
    }
  });
});

describe("ensureReadableOn — accent as text on white", () => {
  test("leaves an already-dark accent unchanged", () => {
    assert.equal(ensureReadableOn("#1E2A4A"), "#1E2A4A");
  });
  test("darkens a pale accent until it is readable on white", () => {
    const pale = "#F5E27A"; // pale yellow — invisible as heading text on white
    assert.ok(contrastRatio(pale, "#ffffff") < 4.5);
    const fixed = ensureReadableOn(pale);
    assert.ok(contrastRatio(fixed, "#ffffff") >= 4.5, "should reach AA on white");
  });
});

describe("mix + isLight", () => {
  test("mix midpoint is halfway", () => {
    assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  });
  test("isLight flags pale colours", () => {
    assert.equal(isLight("#F5E27A"), true);
    assert.equal(isLight("#1E2A4A"), false);
  });
});
