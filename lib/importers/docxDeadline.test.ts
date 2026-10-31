/**
 * Word import read deadline (session 7). Until then a DOCX import had no
 * deadline at all, while a PDF gave up with `timeout` at 45 s (D10). The
 * browser half (a stalled adapter / mammoth chunk) is in
 * scripts/import-smoke.mjs; this pins the adapter half with a mammoth that
 * never answers.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDocxBytes, type MammothModule } from "./docxAdapter";
import {
  DOCX_TIMEOUT_COPY,
  DOCX_TIMEOUT_MS,
  IMPORT_ERROR_COPY,
  ImportParseError,
  PDF_TIMEOUT_MS,
} from "./importErrors";

const fixture = join(__dirname, "..", "..", "__fixtures__", "import", "header-contact.docx");
const bytes = () => {
  const b = readFileSync(fixture);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const stalled: MammothModule = { extractRawText: () => new Promise(() => {}) };

describe("DOCX read deadline (session 7)", () => {
  test("same budget as a PDF", () => {
    assert.equal(DOCX_TIMEOUT_MS, PDF_TIMEOUT_MS);
  });

  test("a read that never finishes rejects with `timeout` at the deadline, in Word wording", async () => {
    const started = Date.now();
    await assert.rejects(
      parseDocxBytes(bytes(), stalled, { deadlineAt: started + 80 }),
      (err: unknown) => {
        assert.ok(err instanceof ImportParseError);
        assert.equal(err.kind, "timeout");
        assert.equal(err.message, DOCX_TIMEOUT_COPY);
        return true;
      },
    );
    const took = Date.now() - started;
    assert.ok(took >= 70 && took < 2000, `rejected after ${took} ms`);
  });

  test("the Word copy does not send a Word user to a Word file", () => {
    assert.match(IMPORT_ERROR_COPY.timeout, /PDF/);
    assert.doesNotMatch(DOCX_TIMEOUT_COPY, /\.docx\) version/);
    assert.match(DOCX_TIMEOUT_COPY, /Word file/);
  });

  test("without a deadline the Node path still reads the file", async () => {
    const mammoth: MammothModule = {
      extractRawText: async () => ({
        value: "Jane Doe\njane@example.com\nExperience\nOperations Manager | Acme LLC | Jan 2020 - Present\n" + "Ran things well. ".repeat(20),
      }),
    };
    // (The fixture's own Word header supplies the contact line.)
    const doc = await parseDocxBytes(bytes(), mammoth);
    assert.equal(doc.experience?.[0]?.role, "Operations Manager");
  });
});
