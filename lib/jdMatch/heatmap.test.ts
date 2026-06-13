/**
 * Sanity checks for the JD Heatmap segmenter (lib/jdMatch/heatmap.ts).
 * Built-in node:test only (no framework). Run: npm run test:heatmap
 *
 * Invariants the heatmap must never break:
 *  1. segments always reconstruct the original jobText exactly (no text lost/dup),
 *  2. matched vs missing status is carried per occurrence,
 *  3. whole-word boundaries (Java !== JavaScript),
 *  4. overlapping terms resolve to the longest match,
 *  5. terms not present in the text are not "located".
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { buildHeatmap } from "./heatmap";
import type { JdCategory, JdTerm } from "./types";

const term = (t: string, matched: boolean, category: JdCategory = "hardSkills"): JdTerm => ({
  term: t,
  category,
  matched,
});

const join = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("buildHeatmap", () => {
  test("reconstructs the text exactly and tags matched/missing spans", () => {
    const jd = "We need Odoo and SAP experience.";
    const { segments, located } = buildHeatmap(jd, [term("Odoo", true), term("SAP", false)]);
    assert.equal(join(segments), jd, "no text lost or duplicated");
    const odoo = segments.find((s) => s.term === "Odoo");
    const sap = segments.find((s) => s.term === "SAP");
    assert.equal(odoo?.status, "matched");
    assert.equal(sap?.status, "missing");
    assert.ok(located.has("Odoo") && located.has("SAP"));
  });

  test("respects whole-word boundaries (Java does not match JavaScript)", () => {
    const jd = "Strong JavaScript skills required.";
    const { segments, located } = buildHeatmap(jd, [term("Java", false)]);
    assert.equal(join(segments), jd);
    assert.equal(located.has("Java"), false, "Java must not be located inside JavaScript");
    assert.ok(!segments.some((s) => s.status), "nothing highlighted");
  });

  test("overlapping terms resolve to the longest match", () => {
    const jd = "Handle Microsoft 365 administration daily.";
    const { segments } = buildHeatmap(jd, [
      term("Microsoft 365", false),
      term("Microsoft 365 administration", true),
    ]);
    assert.equal(join(segments), jd);
    const hi = segments.filter((s) => s.status);
    assert.equal(hi.length, 1, "only one span, not two overlapping");
    assert.equal(hi[0].term, "Microsoft 365 administration");
    assert.equal(hi[0].status, "matched");
  });

  test("a term swallowed by a longer overlapping one is NOT located (so it can fall back to a chip)", () => {
    // "Microsoft 365" (a missing gap) is nested inside "Microsoft 365 administration".
    // Its span is dropped — it MUST NOT be reported located, or the panel would
    // filter it out of the chips too and it would vanish from the whole UI.
    const { located } = buildHeatmap("Handle Microsoft 365 administration daily.", [
      term("Microsoft 365", false),
      term("Microsoft 365 administration", true),
    ]);
    assert.equal(located.has("Microsoft 365 administration"), true, "the rendered span is located");
    assert.equal(located.has("Microsoft 365"), false, "the swallowed term is NOT located");
  });

  test("crossing overlap: the losing (missing) term stays unlocated for the chip fallback", () => {
    const { located } = buildHeatmap("alpha beta gamma", [
      term("alpha beta", true),
      term("beta gamma", false),
    ]);
    assert.equal(located.has("alpha beta"), true);
    assert.equal(located.has("beta gamma"), false, "crossed-out gap must remain fixable as a chip");
  });

  test("a term not in the text is neither located nor segmented", () => {
    const jd = "We need Odoo experience.";
    const { segments, located } = buildHeatmap(jd, [term("PMP", false)]);
    assert.equal(join(segments), jd);
    assert.equal(located.has("PMP"), false);
    assert.ok(!segments.some((s) => s.status));
  });

  test("highlights every occurrence of a term", () => {
    const jd = "SQL here, SQL there, SQL everywhere.";
    const { segments } = buildHeatmap(jd, [term("SQL", true)]);
    assert.equal(join(segments), jd);
    assert.equal(segments.filter((s) => s.term === "SQL").length, 3);
  });

  test("case-insensitive but text preserves original casing", () => {
    const jd = "We use odoo and ODOO and Odoo.";
    const { segments } = buildHeatmap(jd, [term("Odoo", true)]);
    const hi = segments.filter((s) => s.status);
    assert.equal(hi.length, 3);
    assert.deepEqual(hi.map((s) => s.text), ["odoo", "ODOO", "Odoo"]);
  });

  test("empty terms list returns the whole text as one plain segment", () => {
    const jd = "Nothing to highlight.";
    const { segments, located } = buildHeatmap(jd, []);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].status, undefined);
    assert.equal(located.size, 0);
  });
});
