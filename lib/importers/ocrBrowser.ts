// Browser half of the scanned-PDF OCR fallback (see ocr.ts for the why).
//
// Loaded only when a picked PDF has no text layer AND the build has
// NEXT_PUBLIC_OCR_IMPORT=1 (pdfAdapter.browserOcrFallback), so neither this
// chunk nor tesseract.js is part of a normal builder visit or a normal import.
//
// What a browser downloads for the first OCR import (Vercel serves brotli):
//   tesseract.js (this chunk)          about 10 KB
//   /ocr/tesseract-7.0.0/worker.min.js    30 KB   (111 KB raw)
//   …/tesseract-core-*-lstm.wasm.js    1.27 MB   (3.9 MB raw; one of three builds)
//   /ocr/lang/4.0.0_fast/eng.traineddata.gz  1.96 MB (already gzipped)
//   total                              about 3.3 MB
// The language data is then kept in IndexedDB by tesseract.js and the scripts
// in the HTTP cache (immutable, see next.config.ts), so a second scan on the
// same device downloads nothing.
//
// Everything is same-origin: no CSP change. The worker is a 'self' script
// (worker-src 'self'), the core is importScripts from 'self', the wasm is
// compiled under the existing 'unsafe-eval', the language data is a 'self'
// fetch.

import {
  OCR_ASSET_BASE,
  OCR_LANG_PATH,
  OcrError,
  type OcrRecogniser,
  type OcrResult,
} from "./ocr";

/** Long edge of the canvas a page is rendered to. About 200 dpi for A4: enough
 *  for 9-10 pt text, and 3.9 megapixels stays inside a phone's canvas budget. */
const TARGET_LONG_EDGE = 2340;

type RenderablePage = {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
};
type RenderablePdfjs = {
  getDocument(src: { data: ArrayBuffer }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<RenderablePage> }>;
    destroy(): Promise<void> | void;
  };
};

/**
 * Render the first `maxPages` pages of a PDF with pdf.js and read them with
 * tesseract.js. Throws OcrError("load_failed") when the worker, core or
 * language data cannot be loaded and OcrError("error") for anything else.
 * pdf.js is passed in already configured (worker URL set by the adapter).
 */
export async function recognisePdfPages(
  pdfjs: RenderablePdfjs,
  data: ArrayBuffer,
  ctx: Parameters<OcrRecogniser>[1],
): Promise<OcrResult> {
  let cancelled = false;
  let worker: { terminate(): Promise<unknown> } | null = null;
  // pdf.js detaches the buffer it is given: hand it a copy.
  const task = pdfjs.getDocument({ data: data.slice(0) });
  const cleanUp = () => {
    void Promise.resolve(worker?.terminate()).catch(() => {});
    void Promise.resolve(task.destroy()).catch(() => {});
  };
  ctx.onCancel(() => {
    cancelled = true;
    cleanUp();
  });

  try {
    let ocr: import("tesseract.js").Worker;
    try {
      const tesseract = await import("tesseract.js");
      // OEM 1 = LSTM only: the smaller core and the smaller language data.
      ocr = await tesseract.createWorker("eng", 1, {
        workerPath: `${OCR_ASSET_BASE}/worker.min.js`,
        corePath: OCR_ASSET_BASE,
        langPath: OCR_LANG_PATH,
        // A same-origin worker needs no blob wrapper.
        workerBlobURL: false,
        gzip: true,
      });
    } catch {
      throw new OcrError("load_failed");
    }
    worker = ocr;
    if (cancelled) throw new OcrError("timeout");

    const pdf = await task.promise;
    const pagesRead = Math.min(pdf.numPages, ctx.maxPages);
    const texts: string[] = [];
    let confidence = 0;
    for (let n = 1; n <= pagesRead; n++) {
      if (cancelled) throw new OcrError("timeout");
      ctx.onProgress?.({ page: n, pages: pagesRead });
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = TARGET_LONG_EDGE / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) throw new OcrError("error");
      await page.render({ canvasContext, viewport }).promise;
      const { data: read } = await ocr.recognize(canvas);
      // Give the pixels back before the next page (phones).
      canvas.width = 0;
      canvas.height = 0;
      texts.push(read.text);
      confidence += read.confidence;
    }
    return {
      text: texts.join("\n\n"),
      confidence: pagesRead > 0 ? confidence / pagesRead : 0,
      pages: pdf.numPages,
      pagesRead,
    };
  } catch (err) {
    if (err instanceof OcrError) throw err;
    throw new OcrError(cancelled ? "timeout" : "error");
  } finally {
    cleanUp();
  }
}
