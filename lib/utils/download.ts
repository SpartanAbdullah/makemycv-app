// Shared browser-download plumbing for every CV export (PDF, DOCX, JSON backup).
//
// (2026-08-02) Before this file there were two independent implementations of
// "turn a Blob into a downloaded file" and two different filename conventions:
//
//   hooks/useDownloadCV.ts  ->  CV_First_Last.pdf   (sanitised, appends+removes
//                               the anchor, wrapped in try/catch)
//   lib/utils/docxExport.ts ->  First-Last-CV.docx  (NOT sanitised, never
//                               appends the anchor to the document)
//
// The docx variant had two real defects: an un-appended anchor does not fire
// reliably in every browser, and an unsanitised filename is a live problem for
// this product specifically — Arabic names, and any name containing a slash or
// colon, produce a broken or rejected download. Adding a third copy for the
// JSON backup would have made it three conventions and three bugs, so the
// plumbing lives here now.

//
// (2026-11) The plumbing moved here in August but the PDF and Word exports
// kept their own copies, so the three conventions survived. They are gone
// now: every export calls triggerBlobDownload() with a name from
// lib/utils/fileName.ts, which also keeps accented and non-Latin names
// (product audit E4) — fileName.test.ts fails if an export sets
// `a.download` itself again.

import type { CvData } from "../types/cv";
import { exportCvJson } from "./localStorage";
import { cvFileName } from "./fileName";

/**
 * `CV_First_Last.<ext>` for every CV export. With no name yet (normal for a
 * backup taken early) the file is `CV.<ext>` — or `CV_backup.json`, so a
 * backup is still recognisable in a Downloads folder.
 */
export function buildCvFilename(data: CvData, extension: string): string {
  return cvFileName(data.personal, extension, extension === "json" ? "CV_backup" : "CV");
}

/**
 * Push a Blob to the user's Downloads folder.
 *
 * The anchor is appended before clicking and removed after — Firefox and some
 * mobile browsers ignore a click on a detached anchor. The object URL is always
 * revoked, including when the click throws.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download the CV as a restorable .json backup.
 *
 * The builder keeps the only copy of a user's CV in this browser's
 * localStorage — there is no account and no server-side record, so clearing
 * site data, switching device or a corrupted store loses the work with no
 * recovery path. This is that recovery path. Synchronous and dependency-free
 * on purpose: it must keep working even if the PDF renderer is broken.
 */
export function downloadCvBackup(data: CvData): void {
  const blob = new Blob([exportCvJson(data)], {
    type: "application/json;charset=utf-8",
  });
  triggerBlobDownload(blob, buildCvFilename(data, "json"));
}
