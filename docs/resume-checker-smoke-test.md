# Resume Checker — Manual Smoke Test

Run these before promoting to production. Nothing here is automated — there is no test runner in the repo yet.

## Prerequisites

- App running on `localhost:3000` (or your preview URL).
- `.env.local` has a real `ANTHROPIC_API_KEY`.
- Either: real `KV_*` vars in `.env.local`, OR accept the dev in-memory store (reports lost on restart).

## 1. Upload a real PDF

1. Open `/resume-checker`.
2. Drag a real CV PDF onto the dropzone, or click to select.
3. **Expect:** three-phase progress animation → redirect to `/resume-checker/report/<id>` within ~15s.
4. **Expect:** the score sidebar shows a 0–100 score, four category rows, and the "Fix in Builder — $5" CTA.
5. **Expect:** category cards are expanded, showing issues + FAQs.

## 2. Reload the report URL

1. Hit refresh on the report page.
2. **Expect:** same content. Server-rendered from KV — no loading state needed.

## 3. Share the link

1. Click "Share report" in the header.
2. **Expect:** the button label changes to "Link copied" for 2s.

## 4. Click "Fix in Builder — $5"

1. Click the CTA in the sidebar.
2. **Expect:** redirected to `/builder?importedFrom=<id>`.
3. **Expect:** one of two flows:
   - If the builder was empty → an "Imported from your ATS report" banner appears; CV data is filled in.
   - If the builder had existing content → a modal asks "Replace your existing CV?" with Replace / Keep buttons.
4. After either choice, the `?importedFrom=...` query param is stripped from the URL.

## 5. Error cases

### Scanned / image-only PDF
**Expect:** 422 response, dropzone shows "We couldn't read this PDF…" with a Try again button.

### Oversized file
Upload a >5MB PDF. **Expect:** 400, dropzone shows "File is too large…".

### Non-PDF
Upload a .docx or .jpg. **Expect:** client-side validation catches it before upload — "Only PDF files are supported."

### Expired report
Navigate to `/resume-checker/report/doesnotexist`. **Expect:** "Report not found or expired" page with a CTA back to upload.

## 6. 24-hour expiry

Trust the `ex: 86400` TTL on KV. Do not test live.

## Cost accounting

Per parse, Claude Haiku 4.5:
- Input: ~2000 tokens (system + example + raw CV text)
- Output: ~1500–2500 tokens (ParsedDocument + _parseSignals)
- At published Haiku 4.5 pricing (~$1/M input, $5/M output): **~$0.01–0.015 per parse**.

Budget 1.5 cents per upload when projecting volume.
