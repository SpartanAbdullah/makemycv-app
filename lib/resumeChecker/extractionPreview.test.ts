/**
 * Tests for the "what the ATS sees" analysis (lib/resumeChecker/extractionPreview.ts).
 *
 * Pins: counts are plain character/word/line counts of the extracted string;
 * each lost-content note fires only on its own evidence and the copy speaks
 * about the text, never the person.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { analyseExtraction, countWords } from "./extractionPreview";

const GOOD_CV = `AISHA KHAN
Dubai, UAE · +971 50 123 4567 · aisha.khan@example.com

EXPERIENCE
Operations Manager — Al Futtaim Logistics, Dubai (2021 – Present)
- Led a 25-person operations team across 3 distribution centres.
- Reduced last-mile delivery cost by 18% through route optimisation.

EDUCATION
BBA Operations Management, American University of Sharjah, 2017
`;

const ids = (text: string, extra: Partial<Parameters<typeof analyseExtraction>[0]> = {}) =>
  analyseExtraction({ text, kind: "pdf", ...extra }).notes.map((n) => n.id);

describe("countWords", () => {
  test("whitespace-separated tokens, empty string is zero", () => {
    assert.equal(countWords(""), 0);
    assert.equal(countWords("   \n  "), 0);
    assert.equal(countWords("one  two\nthree"), 3);
  });
});

describe("analyseExtraction", () => {
  test("a clean one-page CV has counts and no notes", () => {
    const s = analyseExtraction({ text: GOOD_CV, kind: "pdf", pages: 1 });
    assert.equal(s.chars, GOOD_CV.length);
    assert.equal(s.words, countWords(GOOD_CV));
    assert.equal(s.lines, 8); // non-empty lines only
    assert.equal(s.pages, 1);
    assert.deepEqual(s.notes, []);
  });

  test("empty extraction is a single error note and stops there", () => {
    const s = analyseExtraction({ text: "  \n ", kind: "pdf", pages: 3 });
    assert.equal(s.words, 0);
    assert.deepEqual(
      s.notes.map((n) => [n.id, n.severity]),
      [["empty", "error"]],
    );
  });

  test("few words for a multi-page PDF is flagged; the same text on one page is not", () => {
    assert.ok(ids(GOOD_CV, { pages: 3 }).includes("sparse-pages"));
    assert.ok(!ids(GOOD_CV, { pages: 1 }).includes("sparse-pages"));
    // DOCX has no page count, so it can never fire there.
    assert.ok(!ids(GOOD_CV, { kind: "docx" }).includes("sparse-pages"));
  });

  test("replacement and private-use glyphs are counted", () => {
    const s = analyseExtraction({ text: `${GOOD_CV}\n Skill �`, kind: "pdf", pages: 1 });
    const note = s.notes.find((n) => n.id === "unmapped-glyphs");
    assert.ok(note);
    assert.match(note.text, /^2 characters/);
  });

  test("letter-spaced headings are flagged, normal capitals are not", () => {
    assert.ok(ids(`${GOOD_CV}\nE X P E R I E N C E`).includes("spaced-letters"));
    assert.ok(!ids(GOOD_CV).includes("spaced-letters"));
    assert.ok(!ids(`${GOOD_CV}\nA B C`).includes("spaced-letters"));
  });

  test("missing email / phone speak about the text and name the DOCX header cause", () => {
    const noContact = GOOD_CV.replace(/\+971 50 123 4567/, "").replace(/aisha\.khan@example\.com/, "");
    const pdf = analyseExtraction({ text: noContact, kind: "pdf", pages: 1 });
    const docx = analyseExtraction({ text: noContact, kind: "docx" });
    assert.deepEqual(pdf.notes.map((n) => n.id), ["no-email", "no-phone"]);
    assert.deepEqual(docx.notes.map((n) => n.id), ["no-email", "no-phone"]);
    assert.match(docx.notes[0].text, /headers and footers/);
    for (const n of [...pdf.notes, ...docx.notes]) {
      assert.match(n.text, /^The text has no/);
      assert.doesNotMatch(n.text, /\byou\b/i);
    }
  });
});
