/**
 * Guards the CV-import failure taxonomy (lib/importers/importErrors.ts):
 * the closed reason set, the extension buckets, the pre-parse gate, the byte
 * sniff and the pdf.js / mammoth exception classification. Pure functions —
 * the adapters themselves are exercised over real documents by
 * scripts/import-fixtures.test.mjs (`npm run test:import`).
 *
 * node:test + node:assert only, like the rest of lib/.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  IMPORT_ERROR_COPY,
  IMPORT_ERROR_REASONS,
  IMPORT_FILE_TYPES,
  ImportParseError,
  MAX_IMPORT_BYTES,
  classifyDocxError,
  classifyPdfError,
  gateImportFile,
  importFileType,
  isImportErrorReason,
  sniffContainer,
  toImportParseError,
  unsupportedTypeMessage,
  withDeadline,
} from "./importErrors";

describe("taxonomy", () => {
  test("every reason has user copy and the set is snake_case only", () => {
    for (const r of IMPORT_ERROR_REASONS) {
      assert.ok(IMPORT_ERROR_COPY[r].length > 20, r);
      assert.match(r, /^[a-z_]+$/, r);
    }
    assert.equal(Object.keys(IMPORT_ERROR_COPY).length, IMPORT_ERROR_REASONS.length);
  });

  test("copy never claims OCR or an upload — the file stays in the browser", () => {
    for (const r of IMPORT_ERROR_REASONS) {
      assert.doesNotMatch(IMPORT_ERROR_COPY[r], /upload(ed|ing)? to|our server|OCR/i, r);
    }
  });

  test("isImportErrorReason rejects the pre-2026-10-31 hyphenated kinds", () => {
    assert.equal(isImportErrorReason("empty-text"), false);
    assert.equal(isImportErrorReason("corrupt-file"), false);
    assert.equal(isImportErrorReason("no_text_layer"), true);
  });

  test("file_type buckets are a closed set including the report hand-off", () => {
    assert.ok((IMPORT_FILE_TYPES as readonly string[]).includes("ats_report"));
    assert.ok((IMPORT_FILE_TYPES as readonly string[]).includes("none"));
  });
});

describe("importFileType", () => {
  test("buckets by extension, case-insensitive, never returns the name", () => {
    assert.equal(importFileType("My CV.PDF"), "pdf");
    assert.equal(importFileType("cv.docx"), "docx");
    assert.equal(importFileType("cv.doc"), "doc");
    assert.equal(importFileType("IMG_2041.HEIC"), "image");
    assert.equal(importFileType("scan.jpeg"), "image");
    assert.equal(importFileType("cv.pages"), "text");
    assert.equal(importFileType("cv.john-smith"), "other");
    assert.equal(importFileType("cv"), "none");
    assert.equal(importFileType("cv.tar.gz"), "other");
  });
});

describe("gateImportFile", () => {
  test("passes a normal pdf and docx", () => {
    assert.equal(gateImportFile({ name: "a.pdf", size: 120_000 }), null);
    assert.equal(gateImportFile({ name: "a.docx", size: 120_000 }), null);
  });
  test("0 bytes → empty_file; type checked first", () => {
    assert.equal(gateImportFile({ name: "a.pdf", size: 0 })?.kind, "empty_file");
    assert.equal(gateImportFile({ name: "a.jpg", size: 0 })?.kind, "unsupported_type");
  });
  test("over the cap → too_large, at the cap passes", () => {
    assert.equal(gateImportFile({ name: "a.pdf", size: MAX_IMPORT_BYTES }), null);
    assert.equal(gateImportFile({ name: "a.pdf", size: MAX_IMPORT_BYTES + 1 })?.kind, "too_large");
  });
  test("legacy .doc gets the Save-As message, images the photo message", () => {
    assert.match(gateImportFile({ name: "cv.doc", size: 10 })?.message ?? "", /Save As/);
    assert.match(gateImportFile({ name: "cv.png", size: 10 })?.message ?? "", /photo or image/);
    assert.equal(unsupportedTypeMessage("other"), IMPORT_ERROR_COPY.unsupported_type);
  });
});

describe("sniffContainer", () => {
  test("zip, ole, pdf (with junk prefix) and unknown", () => {
    assert.equal(sniffContainer(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])), "zip");
    assert.equal(
      sniffContainer(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])),
      "ole",
    );
    const pdf = new TextEncoder().encode("junk\njunk\n%PDF-1.4\n");
    assert.equal(sniffContainer(pdf), "pdf");
    assert.equal(sniffContainer(new TextEncoder().encode("hello world")), "unknown");
    assert.equal(sniffContainer(new Uint8Array(0)), "unknown");
  });
});

describe("classifyPdfError", () => {
  const named = (name: string, message = "") => Object.assign(new Error(message), { name });
  test("pdf.js exception names", () => {
    assert.equal(classifyPdfError(named("PasswordException", "No password given")), "encrypted_pdf");
    assert.equal(classifyPdfError(named("InvalidPDFException", "Invalid PDF structure.")), "corrupt_pdf");
    assert.equal(classifyPdfError(named("FormatError", "Bad FCHECK in flate stream")), "corrupt_pdf");
    assert.equal(classifyPdfError(named("UnknownErrorException", "x")), "corrupt_pdf");
  });
  test("worker load failure by pdf.js wording", () => {
    assert.equal(
      classifyPdfError(
        new Error(
          'Setting up fake worker failed: "Failed to fetch dynamically imported module: https://x/pdf.worker.min.mjs".',
        ),
      ),
      "worker_load_failed",
    );
  });
  test("own errors pass through; anything else is parse_exception", () => {
    assert.equal(classifyPdfError(new ImportParseError("timeout")), "timeout");
    assert.equal(classifyPdfError(new TypeError("Cannot read properties of undefined")), "parse_exception");
    assert.equal(classifyPdfError("string"), "parse_exception");
  });
});

describe("classifyDocxError / toImportParseError", () => {
  test("ole container is a legacy .doc, otherwise corrupt", () => {
    assert.equal(classifyDocxError(new Error("no end of central directory"), "ole"), "unsupported_type");
    assert.equal(classifyDocxError(new Error("no end of central directory"), "unknown"), "corrupt_docx");
    assert.equal(classifyDocxError(new Error("Could not find main document part"), "zip"), "corrupt_docx");
  });
  test("unknown throwables become parse_exception WITHOUT the original message", () => {
    const e = toImportParseError(new Error("Unexpected token in Layla Haddad"));
    assert.equal(e.kind, "parse_exception");
    assert.doesNotMatch(e.message, /Layla/);
    assert.equal(e.message, IMPORT_ERROR_COPY.parse_exception);
  });
});

describe("withDeadline (D10, session 6)", () => {
  test("resolves with the work when it beats the deadline", async () => {
    assert.equal(await withDeadline(Promise.resolve(7), Date.now() + 1000), 7);
  });
  test("rejects with timeout and runs onExpire when the deadline passes first", async () => {
    let expired = 0;
    const never = new Promise<number>(() => {});
    await assert.rejects(
      withDeadline(never, Date.now() + 20, () => { expired++; }),
      (e: unknown) => e instanceof ImportParseError && e.kind === "timeout",
    );
    assert.equal(expired, 1);
  });
  test("a deadline already past rejects at once, even for work that would succeed", async () => {
    let expired = 0;
    const started = Date.now();
    await assert.rejects(
      withDeadline(Promise.resolve(1), Date.now() - 1, () => { expired++; }),
      (e: unknown) => e instanceof ImportParseError && e.kind === "timeout",
    );
    assert.equal(expired, 1);
    assert.ok(Date.now() - started < 50);
  });
  test("the work's own error passes through unchanged", async () => {
    const err = new ImportParseError("corrupt_pdf");
    await assert.rejects(withDeadline(Promise.reject(err), Date.now() + 1000), (e: unknown) => e === err);
  });
});
