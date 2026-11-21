/**
 * Guards the scanned-PDF OCR fallback's pure half (lib/importers/ocr.ts): the
 * flag, the text clean-up and what a failed OCR turns into. The recogniser is
 * a stub here; real OCR over the scanned fixture, and the proof that a PDF
 * with a text layer never reaches OCR, are in scripts/import-fixtures.test.mjs
 * (`npm run test:import`).
 *
 * node:test + node:assert only, like the rest of lib/.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { ImportParseError } from "./importErrors";
import {
  OCR_FAILED_COPY,
  OCR_MAX_PAGES,
  OCR_OUTCOMES,
  OcrError,
  cleanOcrText,
  ocrImportEnabled,
  runOcrFallback,
  type OcrRecogniser,
  type OcrResult,
} from "./ocr";

const LONG = Array.from(
  { length: 12 },
  (_, i) => `Line ${i} of a scanned CV with real words in it`,
).join("\n");
const ok =
  (text: string, confidence = 90): OcrRecogniser =>
  async () => ({ text, confidence, pages: 1, pagesRead: 1 });
const rejection = async (p: Promise<unknown>): Promise<ImportParseError> => {
  try {
    await p;
  } catch (err) {
    assert.ok(err instanceof ImportParseError, "throws ImportParseError");
    return err;
  }
  throw new Error("expected a rejection");
};

describe("ocrImportEnabled", () => {
  test('off unless NEXT_PUBLIC_OCR_IMPORT is exactly "1"', () => {
    const before = process.env.NEXT_PUBLIC_OCR_IMPORT;
    try {
      delete process.env.NEXT_PUBLIC_OCR_IMPORT;
      assert.equal(ocrImportEnabled(), false);
      for (const v of ["", "0", "true", "yes", " 1"]) {
        process.env.NEXT_PUBLIC_OCR_IMPORT = v;
        assert.equal(ocrImportEnabled(), false, JSON.stringify(v));
      }
      process.env.NEXT_PUBLIC_OCR_IMPORT = "1";
      assert.equal(ocrImportEnabled(), true);
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_OCR_IMPORT;
      else process.env.NEXT_PUBLIC_OCR_IMPORT = before;
    }
  });
});

describe("cleanOcrText", () => {
  test("drops blank lines and collapses spaces", () => {
    assert.equal(
      cleanOcrText("Layla  Haddad\n\n\n  Procurement Specialist \r\n\nSUMMARY"),
      "Layla Haddad\nProcurement Specialist\nSUMMARY",
    );
  });
  test("a bullet read as + « * becomes a bullet", () => {
    assert.equal(
      cleanOcrText("+ Ran 60+ tenders a year\n« Cut lead time\n* Saved 9%"),
      "• Ran 60+ tenders a year\n• Cut lead time\n• Saved 9%",
    );
  });
  test("a + inside a line, or opening a phone number, is left alone", () => {
    assert.equal(cleanOcrText("C++ and 60+ tenders"), "C++ and 60+ tenders");
    assert.equal(cleanOcrText("+971 55 987 6543"), "+971 55 987 6543");
  });
  test('"e " / "o " before a capital is a bullet only when it repeats', () => {
    assert.equal(
      cleanOcrText("e Managed a team\ne Led the tender"),
      "• Managed a team\n• Led the tender",
    );
    assert.equal(
      cleanOcrText("e Managed a team\nSomething else"),
      "e Managed a team\nSomething else",
    );
  });
  test("a row of items split by dashes gets its separator dots back", () => {
    assert.equal(
      cleanOcrText("Tendering - Vendor Management - SAP Ariba"),
      "Tendering · Vendor Management · SAP Ariba",
    );
    assert.equal(
      cleanOcrText("English - Fluent - Arabic - Native"),
      "English · Fluent · Arabic · Native",
    );
  });
  test("a date range keeps its dash", () => {
    assert.equal(
      cleanOcrText("Falcon Facilities Management - Abu Dhabi - Mar 2021 - Present"),
      "Falcon Facilities Management · Abu Dhabi · Mar 2021 - Present",
    );
    assert.equal(
      cleanOcrText("Oasis Build Contracting - Dubai - Jun 2017 - Feb 2021"),
      "Oasis Build Contracting · Dubai · Jun 2017 - Feb 2021",
    );
    assert.equal(cleanOcrText("ACME - 03/2019 - 11/2021 - Dubai"), "ACME · 03/2019 - 11/2021 · Dubai");
  });
  test("a line with a single dash is left as read", () => {
    assert.equal(cleanOcrText("Procurement Officer - Oasis Build"), "Procurement Officer - Oasis Build");
    assert.equal(cleanOcrText("BSc, University of Sharjah (2013 - 2017)"), "BSc, University of Sharjah (2013 - 2017)");
  });
  test("words are never changed (an email read with a space stays as read)", () => {
    const line = "layla haddad@example.com - +971 55 987 6543";
    assert.equal(cleanOcrText(line), line);
  });
});

describe("runOcrFallback", () => {
  const data = new ArrayBuffer(8);

  test("resolves with cleaned text and tells the caller it started", async () => {
    let started = 0;
    const r = await runOcrFallback(data, {
      recognise: ok(`+ first\n\n${LONG}`),
      onStart: () => started++,
    });
    assert.equal(started, 1);
    assert.ok(r.text.startsWith("• first\nLine 0"));
    assert.equal(r.pagesRead, 1);
  });

  test("asks for OCR_MAX_PAGES pages and forwards progress", async () => {
    const seen: number[] = [];
    let asked = 0;
    const recognise: OcrRecogniser = async (_d, ctx) => {
      asked = ctx.maxPages;
      ctx.onProgress?.({ page: 1, pages: 2 });
      ctx.onProgress?.({ page: 2, pages: 2 });
      return { text: LONG, confidence: 80, pages: 2, pagesRead: 2 };
    };
    await runOcrFallback(data, { recognise, onProgress: (p) => seen.push(p.page) });
    assert.equal(asked, OCR_MAX_PAGES);
    assert.deepEqual(seen, [1, 2]);
  });

  test("too little text → no_text_layer / low_text", async () => {
    const err = await rejection(runOcrFallback(data, { recognise: ok("only a few words") }));
    assert.equal(err.kind, "no_text_layer");
    assert.equal(err.ocrOutcome, "low_text");
    assert.equal(err.message, OCR_FAILED_COPY);
  });

  test("low confidence → no_text_layer / low_text, however long the text", async () => {
    const err = await rejection(runOcrFallback(data, { recognise: ok(LONG, 20) }));
    assert.equal(err.kind, "no_text_layer");
    assert.equal(err.ocrOutcome, "low_text");
  });

  for (const outcome of OCR_OUTCOMES) {
    test(`recogniser OcrError(${outcome}) → no_text_layer / ${outcome}`, async () => {
      const err = await rejection(
        runOcrFallback(data, {
          recognise: async () => {
            throw new OcrError(outcome);
          },
        }),
      );
      assert.equal(err.kind, "no_text_layer");
      assert.equal(err.ocrOutcome, outcome);
    });
  }

  test("any other throw → no_text_layer / error, message not carried", async () => {
    const err = await rejection(
      runOcrFallback(data, {
        recognise: async () => {
          throw new Error("Layla Haddad layla@example.com");
        },
      }),
    );
    assert.equal(err.kind, "no_text_layer");
    assert.equal(err.ocrOutcome, "error");
    assert.ok(!/Layla/.test(err.message));
  });

  test("budget runs out → no_text_layer / timeout, and the worker is cancelled", async () => {
    let cancelled = 0;
    const recognise: OcrRecogniser = (_d, ctx) => {
      ctx.onCancel(() => cancelled++);
      return new Promise<OcrResult>(() => {});
    };
    const err = await rejection(runOcrFallback(data, { recognise, timeoutMs: 40 }));
    assert.equal(err.kind, "no_text_layer");
    assert.equal(err.ocrOutcome, "timeout");
    assert.equal(cancelled, 1);
  });
});
