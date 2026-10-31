// Import fixture guard (2026-10-31) — `npm run test:import`.
//
// Runs the REAL adapters (compiled by tsconfig.test.json into .test-build/)
// over the synthetic documents in __fixtures__/import/, with pdf.js's legacy
// build and mammoth injected the way the browser wrappers inject the browser
// builds. Asserts, per file, the ImportParseError reason or the sections the
// mapping produced — the same outcomes scripts/import-smoke.mjs checks in a
// browser, minus the picker and the dataLayer.
//
// Companion to scripts/parser-fixtures.test.cjs (text → ParsedDocument);
// this one covers bytes → text → ParsedDocument → CvData sections, which the
// parser guard cannot (pdf.js and mammoth were browser-only until the
// adapters took an injected module).
//
// Regenerate the documents with `node scripts/make-import-fixtures.mjs`.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FIXTURE_DIR, makeLargePdf } from "./make-import-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const build = (p) => require(path.join(root, ".test-build", "importers", p));

const { parsePdfBytes, extractPdfText } = build("pdfAdapter.js");
const { parseDocxBytes, extractDocxText } = build("docxAdapter.js");
const { mapParsedToCv, countSectionsFilled, hasUsableContent } = build("fieldMapper.js");
const { gateImportFile, importFileType, importErrorMessage, IMPORT_ERROR_REASONS, ImportParseError } =
  build("importErrors.js");

const pdfjs = await import(
  pathToFileURL(path.join(root, "node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
const workerSrc = pathToFileURL(
  path.join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;
// mammoth's Node entry takes { buffer }; the browser build the adapter is
// written against takes { arrayBuffer }. Bridge the two here.
const mammothNode = require("mammoth");
const mammoth = {
  extractRawText: ({ arrayBuffer }) =>
    mammothNode.extractRawText({ buffer: Buffer.from(arrayBuffer) }),
};

let passes = 0;
let failures = 0;
const check = (fixture, label, cond, actual) => {
  if (cond) {
    passes++;
    console.log(`PASS  [${fixture}] ${label}`);
  } else {
    failures++;
    console.log(
      `FAIL  [${fixture}] ${label}` +
        (actual !== undefined ? ` — got: ${JSON.stringify(actual)}` : ""),
    );
  }
};

const bytesOf = (name) => {
  const b = fs.readFileSync(path.join(FIXTURE_DIR, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

/** Gate, then adapter, exactly as BuilderShell orders them. Resolves to
 *  { reason } or { parsed, partial, sections }. */
async function runImport(name, data) {
  const gate = gateImportFile({ name, size: data.byteLength });
  if (gate) return { reason: gate.kind, message: gate.message };
  try {
    const type = importFileType(name);
    const parsed =
      type === "docx"
        ? await parseDocxBytes(data, mammoth)
        : await parsePdfBytes(data, { pdfjs, workerSrc });
    const partial = mapParsedToCv(parsed);
    if (!hasUsableContent(partial)) {
      return { reason: "mapping_empty", message: importErrorMessage("mapping_empty"), parsed };
    }
    return { parsed, partial, sections: countSectionsFilled(partial) };
  } catch (err) {
    if (err instanceof ImportParseError) return { reason: err.kind, message: err.message };
    throw err;
  }
}

const expectReason = async (name, reason, data = bytesOf(name)) => {
  const r = await runImport(name, data);
  check(name, `reason ${reason}`, r.reason === reason, r.reason ?? `imported ${r.sections} sections`);
  if (r.reason) {
    check(name, "reason is in the closed set", IMPORT_ERROR_REASONS.includes(r.reason), r.reason);
    check(name, "message is user copy, not an exception", r.message && !/exception|error:/i.test(r.message), r.message);
  }
  return r;
};

const expectImport = async (name, minSections) => {
  const r = await runImport(name, bytesOf(name));
  if (process.env.DUMP) console.log(`
===== ${name} =====
${JSON.stringify(r.partial, null, 1)}`);
  check(name, `imports with ≥${minSections} sections`, !r.reason && r.sections >= minSections, r.reason ?? r.sections);
  return r;
};

/* ── documents that must import ────────────────────────────────────────── */

{
  const r = await expectImport("text-cv.pdf", 5);
  check("text-cv.pdf", "name", r.partial?.personal?.firstName === "Layla", r.partial?.personal?.firstName);
  check("text-cv.pdf", "email", r.partial?.personal?.email === "layla.haddad@example.com", r.partial?.personal?.email);
  // Known parser quality gap (not a failure): a "Company · City · Dates" line
  // under the role title is split into a second entry, so the two roles come
  // back as four. The review screen is where the user merges them. Tracked in
  // docs/import-errors.md ("Not fixed here").
  check("text-cv.pdf", "both roles present", (r.partial?.experience?.length ?? 0) >= 2, r.partial?.experience?.length);
  check("text-cv.pdf", "visa status read", /employment/i.test(r.partial?.personal?.visaStatus ?? ""), r.partial?.personal?.visaStatus);
}
await expectImport("plain-helvetica-cv.pdf", 5);

{
  // The name + contact line live in the Word HEADER. mammoth alone drops them
  // (that was the pre-2026-10-31 behaviour: 5 sections, no name, no email).
  const r = await expectImport("header-contact.docx", 6);
  check("header-contact.docx", "name read from header", r.partial?.personal?.firstName === "Layla", r.partial?.personal?.firstName);
  check("header-contact.docx", "email read from header", r.partial?.personal?.email === "layla.haddad@example.com", r.partial?.personal?.email);
  const text = await extractDocxText(bytesOf("header-contact.docx"), mammoth);
  check("header-contact.docx", "footer boilerplate NOT appended", !/references available/i.test(text));
}
{
  const r = await expectImport("two-column-table.docx", 5);
  check("two-column-table.docx", "email", r.partial?.personal?.email === "layla.haddad@example.com", r.partial?.personal?.email);
  check("two-column-table.docx", "skills", (r.partial?.skills?.length ?? 0) >= 4, r.partial?.skills?.length);
}
{
  const r = await expectImport("rtl-mixed.docx", 5);
  check("rtl-mixed.docx", "Latin name survives the Arabic line", r.partial?.personal?.firstName === "Layla", r.partial?.personal?.firstName);
  // Same split as text-cv.pdf ("City | Dates" line becomes an entry), plus the
  // Arabic role line is read as a role — all reviewable, none a failure.
  check("rtl-mixed.docx", "both roles present", (r.partial?.experience?.length ?? 0) >= 2, r.partial?.experience?.length);
}
{
  // English-centric parser: the Arabic headings are not recognised, but the
  // Latin email still maps Personal. A partial import, not a failure.
  const r = await runImport("arabic-only.pdf", bytesOf("arabic-only.pdf"));
  check("arabic-only.pdf", "partial import (no failure)", !r.reason, r.reason);
  check("arabic-only.pdf", "email found", r.partial?.personal?.email === "layla.haddad@example.com", r.partial?.personal?.email);
}

/* ── documents that must fail with the right reason ────────────────────── */

await expectReason("scanned-cv.pdf", "no_text_layer");
await expectReason("encrypted-cv.pdf", "encrypted_pdf");
await expectReason("legacy-doc-renamed.docx", "unsupported_type");
await expectReason("empty.pdf", "empty_file");
await expectReason("photo-of-cv.jpg", "unsupported_type");
await expectReason("not-a-cv.pdf", "mapping_empty");
{
  const big = makeLargePdf(25 * 1024 * 1024);
  await expectReason("large-25mb.pdf", "too_large", big.buffer.slice(big.byteOffset, big.byteOffset + big.byteLength));
}
// Bytes that are not a PDF at all, under a .pdf name (a renamed .docx).
await expectReason("renamed.pdf", "corrupt_pdf", bytesOf("header-contact.docx"));
// A damaged zip under a .docx name.
{
  const b = Buffer.from(bytesOf("two-column-table.docx"));
  b.fill(0, 64, 2048);
  await expectReason("damaged.docx", "corrupt_docx", b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
// A .docx that is a valid zip with no text (the 0-byte .docx is caught by the gate).
await expectReason("empty.docx", "empty_file", new ArrayBuffer(0));

/* ── timeout wrapper ───────────────────────────────────────────────────── */
{
  const stuck = {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({ promise: new Promise(() => {}), destroy: () => {} }),
  };
  let reason;
  try {
    await extractPdfText(bytesOf("text-cv.pdf"), { pdfjs: stuck, workerSrc: "x", timeoutMs: 50 });
  } catch (err) {
    reason = err.kind;
  }
  check("timeout", "a hung pdf.js task reports timeout", reason === "timeout", reason);
}
{
  // A worker that never loads: pdf.js's own wording for the memoised failure.
  const broken = {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({
      promise: Promise.reject(new Error('Setting up fake worker failed: "Failed to fetch dynamically imported module".')),
      destroy: () => {},
    }),
  };
  let reason;
  try {
    await extractPdfText(bytesOf("text-cv.pdf"), { pdfjs: broken, workerSrc: "x" });
  } catch (err) {
    reason = err.kind;
  }
  check("worker", "worker load failure is classified", reason === "worker_load_failed", reason);
}
{
  // Page cap: only maxPages pages are read, the count still reports all.
  const data = bytesOf("text-cv.pdf");
  const r = await extractPdfText(data, { pdfjs, workerSrc, maxPages: 1 });
  check("page-cap", "page count reported", r.pages === 1, r.pages);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
