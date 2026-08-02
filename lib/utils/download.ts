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

import type { CvData } from "../types/cv";
import { exportCvJson } from "./localStorage";

/** Filename-safe fragment: collapse whitespace to _, drop everything else. */
export function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * `CV_First_Last.<ext>`, falling back to `CV_MakeMyCV.<ext>` when the CV has no
 * name yet (which is normal for a backup taken early, and must not produce a
 * file called `CV_..json`).
 */
export function buildCvFilename(data: CvData, extension: string): string {
  const first = sanitizeFilenamePart(data.personal.firstName ?? "");
  const last = sanitizeFilenamePart(data.personal.lastName ?? "");
  const stem =
    first || last ? `CV_${[first, last].filter(Boolean).join("_")}` : "CV_MakeMyCV";
  return `${stem}.${extension}`;
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
