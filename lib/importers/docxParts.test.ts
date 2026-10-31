/**
 * Guards the dependency-free .docx header/footer reader
 * (lib/importers/docxParts.ts): WordprocessingML paragraph extraction, the
 * footer contact filter, and the zip walk over the committed header fixture
 * (__fixtures__/import/header-contact.docx, built by
 * scripts/make-import-fixtures.mjs). The end-to-end import of that fixture
 * is covered by scripts/import-fixtures.test.mjs.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  contactLinesOnly,
  paragraphsFromWordXml,
  readDocxHeaderFooter,
} from "./docxParts";

describe("paragraphsFromWordXml", () => {
  test("joins runs, maps tabs/breaks, unescapes entities, drops empty paragraphs", () => {
    const xml =
      `<w:hdr><w:p><w:r><w:t xml:space="preserve">Layla </w:t></w:r><w:r><w:t>Haddad</w:t></w:r></w:p>` +
      `<w:p/><w:p><w:r><w:t>a@b.com</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>+971 &amp; 55</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>line1</w:t><w:br/><w:t>line2</w:t></w:r></w:p></w:hdr>`;
    assert.deepEqual(paragraphsFromWordXml(xml), [
      "Layla Haddad",
      "a@b.com +971 & 55",
      "line1\nline2",
    ]);
  });
});

describe("contactLinesOnly", () => {
  test("keeps emails, phones and URLs; drops page numbers and boilerplate", () => {
    assert.deepEqual(
      contactLinesOnly([
        "Page 1 of 2",
        "References available on request",
        "layla@example.com",
        "+971 55 987 6543",
        "linkedin.com/in/x",
      ]),
      ["layla@example.com", "+971 55 987 6543", "linkedin.com/in/x"],
    );
  });
});

describe("readDocxHeaderFooter", () => {
  // .test-build/importers/ → repo root is two levels up.
  const fixture = join(__dirname, "..", "..", "__fixtures__", "import", "header-contact.docx");

  test("reads the header name/contact and the footer from a real .docx", async () => {
    const b = readFileSync(fixture);
    const parts = await readDocxHeaderFooter(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    );
    assert.ok(parts.headers.some((l) => l.includes("Layla Haddad")), JSON.stringify(parts.headers));
    assert.ok(parts.headers.some((l) => l.includes("layla.haddad@example.com")));
    assert.ok(parts.footers.some((l) => /references available/i.test(l)));
  });

  test("throws on a non-zip so the adapter can fall back to body only", async () => {
    await assert.rejects(readDocxHeaderFooter(new Uint8Array(100).buffer));
  });
});
