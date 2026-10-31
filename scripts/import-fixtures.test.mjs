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
  // D1 (2026-10-31): the "Company · City · Dates" line under the title is the
  // tail of that role. Until then the two roles came back as four cards and
  // this check (">= 2") passed anyway — it is exact now.
  const exp = r.partial?.experience ?? [];
  check("text-cv.pdf", "exactly 2 roles (not 4)", exp.length === 2, exp.map((e) => e.role));
  check("text-cv.pdf", "role 1 title/company/location", exp[0]?.role === "Senior Procurement Specialist" && exp[0]?.company === "Falcon Facilities Management" && exp[0]?.location === "Abu Dhabi", exp[0]);
  check("text-cv.pdf", "every role has a start date and bullets", exp.every((e) => e.startDate && e.bullets.length > 0), exp.map((e) => [e.startDate, e.bullets.length]));
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
  // D1: "Role - Company" / "City | dates" — 2 roles, the city is the location
  // and the first (marker-less) bullet is a bullet, not card 2's Company.
  const exp = r.partial?.experience ?? [];
  check("two-column-table.docx", "exactly 2 roles (not 4)", exp.length === 2, exp.map((e) => e.role));
  check("two-column-table.docx", "role 1 company/location", exp[0]?.company === "Falcon Facilities Management" && exp[0]?.location === "Abu Dhabi", exp[0]);
  check("two-column-table.docx", "first bullet stays a bullet", /^Ran 60\+ tenders/.test(exp[0]?.bullets?.[0] ?? ""), exp[0]?.bullets?.[0]);
  check("two-column-table.docx", "every role has a start date", exp.every((e) => e.startDate), exp.map((e) => e.startDate));
}
{
  const r = await expectImport("rtl-mixed.docx", 5);
  check("rtl-mixed.docx", "Latin name survives the Arabic line", r.partial?.personal?.firstName === "Layla", r.partial?.personal?.firstName);
  // The two English roles merge with their "City | Dates" lines (D1); the
  // Arabic role line is still read as a third role — reviewable, not a failure.
  check("rtl-mixed.docx", "both roles present", (r.partial?.experience?.length ?? 0) >= 2, r.partial?.experience?.length);
  const exp = r.partial?.experience ?? [];
  check("rtl-mixed.docx", "English roles not split (cards 1-2 are the dated roles)", exp[0]?.role === "Senior Procurement Specialist" && exp[0]?.startDate === "Mar 2021" && exp[1]?.role === "Procurement Officer" && exp[1]?.startDate === "Jun 2017", exp.map((e) => [e.role, e.startDate]));
}
/* ── session 5 production-matrix fixtures (2026-10-31) ─────────────────────
   Copied from _cowork/session5/import/fixtures/ (synthetic persona "Noor
   Testwell"): s5-long-wrapped.pdf = case 1 (react-pdf, 6 pages, 3 roles × 4
   wrapped bullets, "Title — Company" / "City | dates"), s5-header-table.docx
   = case 4 (contact in the Word header, two-column table, mammoth drops the
   list markers). */
{
  const r = await expectImport("s5-long-wrapped.pdf", 6);
  const exp = r.partial?.experience ?? [];
  check("s5-long-wrapped.pdf", "3 roles, not 6 (D1)", exp.length === 3, exp.map((e) => e.role));
  check("s5-long-wrapped.pdf", "every role dated, located, with bullets (D1)", exp.every((e) => e.startDate && e.location && e.bullets.length >= 4), exp.map((e) => [e.startDate, e.location, e.bullets.length]));
  check("s5-long-wrapped.pdf", "role 1 company", exp[0]?.company === "Falcon Facilities Management", exp[0]?.company);
}
{
  const r = await expectImport("s5-header-table.docx", 6);
  const exp = r.partial?.experience ?? [];
  check("s5-header-table.docx", "3 roles, not 6 (D1)", exp.length === 3, exp.map((e) => e.role));
  check("s5-header-table.docx", "4 bullets per role, first bullet not a Company (D1)", exp.every((e) => e.bullets.length === 4 && !/^(Directed|Ran|Supervised)/.test(e.company ?? "")), exp.map((e) => [e.company, e.bullets.length]));
  check("s5-header-table.docx", "cities are locations", exp.map((e) => e.location).join(",") === "Dubai,Abu Dhabi,Sharjah", exp.map((e) => e.location));
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
