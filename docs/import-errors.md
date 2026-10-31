# CV import — failure taxonomy and user copy

_Status: shipped 2026-10-31 on `stagingmmc`. Source of truth for the values is
`lib/importers/importErrors.ts`; this page explains them._

## What the two GA4 events mean

Both are pushed from the client through `track()` (`lib/analytics.ts`) and
carry **no file name and no document text** — only enums and counts.

| Event | Fired when | Params |
|---|---|---|
| `cv_import` | The user **confirms** the review screen (clicks *Import*) and the CV is written to the store. One per confirmed import. A review the user cancels fires nothing. | `file_type` (`pdf` / `docx` / `ats_report`), `merge_mode` (`replace` / `merge`), `sections_filled` (0–7) |
| `cv_import_failed` | A pick that did **not** reach the review screen — the gate, the adapter, the parser or the empty-mapping guard stopped it. Exactly one per failed pick. | `file_type` (extension bucket, see below), `error_reason` (closed set, see below) |

Call sites: `components/builder/BuilderShell.tsx` (`handleImport` →
failure; `handleImportConfirm` → success) and
`components/builder/ImportFromReportBanner.tsx` (the checker-report hand-off,
`file_type: "ats_report"`).

So a pick ends in one of three ways: a `cv_import` (confirmed), a
`cv_import_failed` (stopped), or **nothing** (the review opened and the user
cancelled it). Consequences for reading the numbers:

- **Per-attempt failure rate** = `cv_import_failed / (cv_import + cv_import_failed)`
  is a floor: cancelled reviews are invisible, so the real "pick that did not
  end in an import" share is higher. For Oct 3–30 2026 (296 / 41 events):
  41 / 337 = **12.2 % of recorded picks failed** (lower bound).
- **"8 %"** (19 failed users / 234 importing users) is _not_ "importing users
  who saw a failure": the two user sets are counted independently and can
  overlap (a user who fails once, then succeeds, is in both). The honest
  statement is "19 users saw at least one import failure; 234 users confirmed
  at least one import"; the share of users who tried and saw a failure lies
  between 19 / (234 + 19) = 7.5 % (no overlap) and 19 / 234 = 8.1 % (every
  failing user later succeeded).
- Both events include the `ats_report` path; split by `file_type` before
  attributing anything to the file picker.
- Before 2026-10-31 `error_reason` had only `empty-text`, `corrupt-file` and
  `unknown` (file import) and `report-expired` / `fetch-failed` / `no-cv-data`
  / `network` (report). Everything that was not a scan collapsed into
  `corrupt-file`, and a photo or `.doc` picked on a phone was reported as a
  corrupt **PDF**, because PDF was the fallback branch. Historical rows keep
  the old values; from this release the values below apply.

## `file_type` buckets

Extension of the picked file, lower-cased and bucketed (`importFileType`):
`pdf`, `docx` (also .docm), `doc` (.doc/.dot), `image` (jpg/jpeg/png/heic/
heif/gif/webp/bmp/tif/tiff), `text` (txt/rtf/md/odt/pages/html), `other`,
`none` (no extension), plus `ats_report` for the banner path. Bucketing (rather
than the raw extension) keeps an odd tail such as `cv.john-smith` out of
analytics.

## `error_reason` values and the copy the user sees

| Reason | Detected by | User-facing copy |
|---|---|---|
| `unsupported_type` | Gate: extension not pdf/docx. Also the DOCX adapter when the bytes are an OLE2 compound file (a Word 97-2003 `.doc` renamed to `.docx`). | `.doc`: "This is an older Word .doc file. Open it in Word, choose Save As → Word Document (.docx), and import that file." · image: "This is a photo or image, which has no text that can be read. Export a text-based PDF or Word (.docx) file from the original document and try again." · text formats: "This format isn't supported yet. Export your CV as a PDF or Word (.docx) file and try again." · other: "Only PDF and Word (.docx) files can be imported. Export your CV as one of those and try again." |
| `empty_file` | Gate: `size === 0`. | "This file is empty (0 bytes). Re-export it from the original document and try again." |
| `too_large` | Gate: `size > MAX_IMPORT_BYTES` (15 MB). | "This file is larger than 15 MB. Export a lighter PDF — without a high-resolution photo — and try again." |
| `encrypted_pdf` | pdf.js `PasswordException`. | "This PDF is password-protected, so it cannot be read. Open it, remove the password (Print → Save as PDF also works) and import the new file." |
| `no_text_layer` | PDF opened, text < 200 chars. | "This PDF has no readable text — it looks like a scanned image. Export a text-based PDF from Word or Google Docs and try again." |
| `corrupt_pdf` | pdf.js `InvalidPDFException` / `FormatError` / `UnknownErrorException` etc. — including a .docx renamed to .pdf. | "This PDF could not be opened — it may be damaged, or not really a PDF. Re-export it from the original document and try again." |
| `worker_load_failed` | pdf.js worker (self-hosted, then CDN) could not load; also the `pdfjs-dist` / `mammoth` chunk itself failing to import. | "The PDF reader could not load in this browser (a network or ad blocker often causes this). Reload the page and try again, or import a Word (.docx) version instead." |
| `timeout` | Extraction exceeded `PDF_TIMEOUT_MS` (45 s); the loading task is destroyed. | "Reading this PDF took too long. Try a smaller or simpler export, or import a Word (.docx) version instead." |
| `corrupt_docx` | Bytes are not a zip, or mammoth cannot find the document part. | "This Word file could not be opened — it may be damaged, or not really a .docx. Open it in Word and save it again as .docx." |
| `empty_text` | DOCX opened, text < 200 chars (picture-only document). | "This Word file has almost no readable text. If the CV is a picture inside the document, export a text-based version and try again." |
| `parse_exception` | The text parser or mapper threw; anything unclassified. The original message is never carried (it could quote document text). | "Something went wrong while reading this file. Try again — or fill in your details below." |
| `mapping_empty` | Parsed, but `hasUsableContent()` is false: no email/phone/summary/LinkedIn and no experience, education, skills, languages, certifications or projects. A name alone does not count — the parser lifts the first line of _any_ document as a name. | "The file was read, but no CV sections (name, experience, education, skills) could be found in it. Check that it is a CV written in English. You can also try the free AI Resume Checker, which handles more layouts." |
| `report_expired` | Banner: `/api/resume-checker/import/:id` → 404. | "This report expired. Reports are kept for 24 hours." |
| `report_fetch_failed` | Banner: any other non-2xx. | "Couldn't import the report. Try uploading the CV again." |
| `report_no_cv` | Banner: 2xx without a `cv` payload. | "Report returned no CV data." |
| `report_network` | Banner: fetch threw. | "Network error while importing the report." |

All copy is shown in the builder's existing red error bar (dismissible,
`data-testid="import-error"`); the file is untouched and the user stays on the
step. The ATS-checker hint appears only on `mapping_empty` — the checker needs a
text layer too, so it is not offered for scans.

## Pipeline order (BuilderShell `handleImport`)

1. **Gate** (`gateImportFile`): type → size 0 → size cap. No bytes are read.
2. **Adapter**: `pdfAdapter` / `docxAdapter` (loaded on first use).
   - PDF: worker URL resolved once per page (HEAD probe of
     `/pdf.worker.min.mjs`, CDN copy only when it is unreachable — pdf.js
     disables real workers and memoises a failed fake-worker import after the
     first failure, so a retry _after_ a failure can never work; that is what
     the previous catch-and-retry did). Then `getDocument` under a 45 s
     deadline, first 30 pages read.
   - DOCX: byte sniff (OLE → `.doc`, not zip → corrupt), mammoth for the body,
     then `docxParts.ts` reads `word/header*.xml` (prepended) and the contact
     lines of `word/footer*.xml` (appended). mammoth ignores headers, and Word
     CV templates put the name and contact line there.
3. **Parser** → **mapper** → `hasUsableContent` guard → `MappingReview`.
4. Confirm → `importCvVersion` → `cv_import`.

The CSP now carries `worker-src 'self' blob:` (`next.config.ts`); without it
the browser used `script-src`, which has no `blob:`, and pdf.js's blob wrapper
for a cross-origin worker was refused.

## Fixtures and checks

- `__fixtures__/import/` — synthetic documents (invented person), regenerated
  with `npm run fixtures:import` (`scripts/make-import-fixtures.mjs`; Chrome
  prints the text PDFs, the rest are hand-written).
- `npm run test:import` — runs the real adapters in Node (pdf.js legacy build,
  mammoth) over every fixture plus a 25 MB PDF built in a temp dir, and the
  timeout / worker-failure classification with stubbed pdf.js modules.
- `npm run test:unit` — `importErrors.test.ts`, `docxParts.test.ts`.
- `npm run smoke:import` — the same files through the real picker in Chrome
  against a running server, asserting the error bar and the dataLayer push,
  plus the two worker network scenarios (local 404 → CDN; offline →
  `worker_load_failed`).

| Fixture | Before 2026-10-31 | After |
|---|---|---|
| text-cv.pdf (Chrome print) | import, 6 sections | same |
| plain-helvetica-cv.pdf | import | same |
| header-contact.docx (name/contact in header) | import, **no name, no email** (5 sections) | import with name + email (6 sections) |
| two-column-table.docx | import | same |
| rtl-mixed.docx (EN + Arabic/Urdu lines) | import | same |
| arabic-only.pdf | review, 1 section (email) | same — honest partial import, see below |
| scanned-cv.pdf | `empty-text`, scan message | `no_text_layer` |
| encrypted-cv.pdf (RC4-40, user password) | `corrupt-file`, "may be corrupted or password-protected" | `encrypted_pdf`, password message |
| legacy-doc-renamed.docx (OLE2) | `corrupt-file` [docx] | `unsupported_type`, Save-As message |
| empty.pdf (0 bytes) | `corrupt-file` [pdf] | `empty_file` |
| photo-of-cv.jpg | `corrupt-file` **[pdf]** | `unsupported_type` [image] |
| not-a-cv.pdf (prose) | review opened with nothing to import | `mapping_empty` |
| 25 MB PDF | parsed and imported (no gate) | `too_large` |
| local worker 404 | CDN retry could not work (see above) | CDN copy used, import succeeds |
| worker + CDN unreachable | `unknown` | `worker_load_failed` |

## Not fixed here

- **Non-Latin CVs** (Arabic, Urdu): `textParser.ts` recognises English
  headings only. An Arabic PDF with a Latin email line imports as "1 section";
  one without any Latin contact line reports `mapping_empty`. pdf.js also
  returns Chrome-printed Arabic as isolated presentation-form glyphs. An
  Arabic parser is a feature, not a fix.
- **Role segmentation**: a `Company · City · Dates` or `City | Dates` line under
  a role title is split into a second experience entry (text-cv.pdf: 2 roles →
  4 entries; rtl-mixed.docx: 2 → 5). Reviewable in MappingReview; not a failure
  event. Parser work with the `test:parser` guard.
- **Scans need OCR**; none is offered, and the copy does not promise one.
- **DOCX produced by Google Docs / LibreOffice / Canva** could not be generated
  here; mammoth is known to read Google Docs and LibreOffice output, and the
  header pass applies to any producer. Canva's DOCX export (text boxes) is
  unverified.
- The checker's dropzone (`components/resume-checker/UploadDropzone.tsx`) shares
  the extraction functions but keeps its own generic messages; it never
  inspects `ImportParseError.kind`.
