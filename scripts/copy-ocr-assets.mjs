// Self-host the tesseract.js worker and wasm core (2026-11-21, scanned-PDF
// import). Runs on `postinstall`, so Vercel and every checkout get the files
// that match the installed library; they are git-ignored (11.8 MB raw).
//
// Privacy is the reason: tesseract.js fetches these from jsDelivr by default,
// and the CV import promises that nothing about the file leaves this origin.
//
// The worker picks ONE of the three core builds at run time (relaxed SIMD,
// SIMD, plain), so all three must be present. The "-lstm" builds are the
// small ones; the legacy-engine builds are not copied because the import
// uses OEM 1 only (lib/importers/ocrBrowser.ts).
//
// The English language data is committed at public/ocr/lang/ (it is not on
// npm in its "fast" form); see public/ocr/README.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => path.join(root, "node_modules", p);

const installed = JSON.parse(fs.readFileSync(nm("tesseract.js/package.json"), "utf8")).version;
const declared = /TESSERACT_VERSION = "([^"]+)"/.exec(
  fs.readFileSync(path.join(root, "lib/importers/ocr.ts"), "utf8"),
)?.[1];
if (installed !== declared) {
  console.error(
    `[copy-ocr-assets] tesseract.js ${installed} is installed but lib/importers/ocr.ts says ${declared}. ` +
      "Update TESSERACT_VERSION there (the asset folder is named after it).",
  );
  process.exit(1);
}

const outDir = path.join(root, "public", "ocr", `tesseract-${installed}`);
// Drop folders left by an older version so they are not deployed.
for (const entry of fs.readdirSync(path.join(root, "public", "ocr"))) {
  if (entry.startsWith("tesseract-") && entry !== `tesseract-${installed}`) {
    fs.rmSync(path.join(root, "public", "ocr", entry), { recursive: true, force: true });
  }
}
fs.mkdirSync(outDir, { recursive: true });

const FILES = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
];
let bytes = 0;
for (const [from, to] of FILES) {
  fs.copyFileSync(nm(from), path.join(outDir, to));
  bytes += fs.statSync(path.join(outDir, to)).size;
}
console.log(
  `[copy-ocr-assets] ${FILES.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → public/ocr/tesseract-${installed}/`,
);
