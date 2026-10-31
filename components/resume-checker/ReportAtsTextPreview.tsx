"use client";

import { useEffect, useState } from "react";
import AtsTextPreview from "./AtsTextPreview";
import {
  loadExtractionPreview,
  type StoredExtractionPreview,
} from "@/lib/resumeChecker/extractionPreview";

/**
 * Report-page mount of "What the ATS sees". The text never reaches the
 * server-rendered report (the route only returns the parsed CV + score); it
 * is carried over from the upload page in this tab's sessionStorage and shown
 * only when the stored record belongs to THIS report id. A shared link opened
 * elsewhere renders nothing — the recipient never uploaded the file.
 */
export default function ReportAtsTextPreview({ reportId }: { reportId: string }) {
  const [entry, setEntry] = useState<StoredExtractionPreview | null>(null);

  useEffect(() => {
    // Hydration-safe: sessionStorage is read after mount, so the server HTML
    // (no panel) and the first client render agree.
    setEntry(loadExtractionPreview(reportId));
  }, [reportId]);

  if (!entry) return null;

  return (
    <AtsTextPreview
      text={entry.text}
      kind={entry.kind}
      fileName={entry.fileName}
      pages={entry.pages}
      surface="report"
    />
  );
}
