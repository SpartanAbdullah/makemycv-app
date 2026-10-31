/**
 * Line reconstruction from pdf.js text items (lib/importers/pdfAdapter.ts
 * reconstructLines), session 7 / backlog E11.R2.
 *
 * pdf.js gives each item's text in logical order, but several right-to-left
 * items on one line sit on the page right → left. Our own Arabic-first
 * Classic export (E8.2) prints "role | company" as two runs and the bullet
 * marker to the right of its text, so a plain left-to-right join read
 * "| company role" and "text •". Positions below are taken from the
 * production export (_cowork/session6/prod-arabic/A-classic-pdfjs.json).
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { reconstructLines } from "./pdfAdapter";

const H = 9;
const item = (str: string, x: number, width: number, y = 640) => ({
  str,
  transform: [H, 0, 0, H, x, y],
  width,
  height: H,
});

describe("reconstructLines: right-to-left runs are read from their right end (E11.R2)", () => {
  test("Classic's Arabic-first role | company line", () => {
    const lines = reconstructLines([
      item("| شركة الخليج للخدمات اللوجستية", 24, 122),
      item(" ", 146, 2),
      item("محلل سلسلة التوريد", 148, 73),
      item(" ", 221, 275),
      item("Jan 2023 – Present", 496, 76),
    ]);
    assert.deepEqual(lines, ["محلل سلسلة التوريد | شركة الخليج للخدمات اللوجستية Jan 2023 – Present"]);
  });

  test("a bullet marker to the right of Arabic text leads the line", () => {
    const lines = reconstructLines([item("•", 563, 5, 625), item("قاد فريقاً من 8 محللين", 256, 303, 625)]);
    assert.deepEqual(lines, ["• قاد فريقاً من 8 محللين"]);
  });

  test("Arabic words printed as separate items come back in reading order", () => {
    const lines = reconstructLines([item("حداد", 400, 30), item(" ", 430, 3), item("ليلى", 433, 25)]);
    assert.deepEqual(lines, ["ليلى حداد"]);
  });

  test("the full stop printed at the left end of an Arabic sentence goes to its end", () => {
    const lines = reconstructLines([item(".", 100, 3), item("خفّضت مدة التوريد", 103, 90)]);
    assert.deepEqual(lines, ["خفّضت مدة التوريد."]);
  });

  test("a space before a haraka is dropped (فريقا ً → فريقاً)", () => {
    assert.deepEqual(reconstructLines([item("قاد فريقا ً من", 100, 80)]), ["قاد فريقاً من"]);
  });
});

describe("reconstructLines: everything else keeps its order (guards)", () => {
  test("a left-edge marker before Arabic text stays first (left-to-right layout)", () => {
    const lines = reconstructLines([item("•", 20, 5), item(" ", 25, 4), item("قاد فريقاً", 29, 60)]);
    assert.deepEqual(lines, ["• قاد فريقاً"]);
  });

  test("Latin then Arabic: the separator stays between them", () => {
    const lines = reconstructLines([item("Languages: English", 20, 90), item(" | ", 110, 10), item("العربية", 120, 30)]);
    assert.deepEqual(lines, ["Languages: English | العربية"]);
  });

  test("a Latin line of several items is unchanged", () => {
    const lines = reconstructLines([
      item("Supply Chain Analyst", 24, 90),
      item(" | ", 114, 10),
      item("Gulf Logistics Services LLC", 124, 120),
      item("Jan 2023 – Present", 496, 76),
    ]);
    assert.deepEqual(lines, ["Supply Chain Analyst | Gulf Logistics Services LLC Jan 2023 – Present"]);
  });

  test("a date printed left of Arabic text is not moved (digits are not punctuation)", () => {
    const lines = reconstructLines([item("(2017 - 2013)", 20, 50), item(" ", 70, 3), item("بكالوريوس إدارة", 73, 70)]);
    assert.deepEqual(lines, ["(2017 - 2013) بكالوريوس إدارة"]);
  });

  test("one Arabic item on a line is unchanged", () => {
    assert.deepEqual(reconstructLines([item("Senior محلل Supply Chain", 24, 98)]), ["Senior محلل Supply Chain"]);
  });
});
