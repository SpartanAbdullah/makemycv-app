/**
 * @deprecated — PDF export now uses @react-pdf/renderer via hooks/useDownloadCV.ts
 * This file is kept as a stub to avoid breaking any stale imports.
 */
export async function exportCvToPdf(): Promise<void> {
  throw new Error(
    "exportCvToPdf is deprecated. Use downloadCV() from hooks/useDownloadCV instead.",
  );
}
