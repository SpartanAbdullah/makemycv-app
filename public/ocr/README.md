# /ocr: self-hosted OCR assets (scanned-PDF import)

Used only by `lib/importers/ocrBrowser.ts`, and only when
`NEXT_PUBLIC_OCR_IMPORT=1`. See `lib/importers/ocr.ts`.

- `lang/4.0.0_fast/eng.traineddata.gz` is committed. It is the English model
  from https://github.com/tesseract-ocr/tessdata_fast (tag 4.1.0, Apache-2.0),
  gzipped with `gzip -9` (4,113,088 bytes raw, 1,962,155 gzipped). It is not
  published on npm, which is why it lives in the repo.
- `tesseract-<version>/` is NOT committed. `scripts/copy-ocr-assets.mjs`
  (run by `postinstall`) copies `worker.min.js` and the three LSTM core builds
  there from `node_modules/tesseract.js` and `node_modules/tesseract.js-core`,
  so they always match the installed library.
