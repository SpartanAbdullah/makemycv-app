"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  analyseExtraction,
  type ExtractionKind,
} from "@/lib/resumeChecker/extractionPreview";

/**
 * "What the ATS sees" (FEATURE_BACKLOG B3, 2026-10-31).
 *
 * Shows the plain text the browser extracted from the uploaded file — the
 * exact string the checker sends for scoring — in reading order, monospace,
 * with counts and notes about content that looks lost. Rendering is 100 %
 * client-side on text already in the browser; nothing new leaves the device.
 *
 * Used twice: under the dropzone while the server builds the report, and on
 * the report page (via ReportAtsTextPreview) next to the findings.
 */
type Props = {
  text: string;
  kind: ExtractionKind;
  fileName?: string;
  pages?: number;
  /** Where the panel sits — the analytics param stays an enum. */
  surface: "upload" | "report";
  defaultOpen?: boolean;
};

const nf = new Intl.NumberFormat("en-AE");

export default function AtsTextPreview({
  text,
  kind,
  fileName,
  pages,
  surface,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const stats = useMemo(() => analyseExtraction({ text, kind, pages }), [text, kind, pages]);
  const trackedRef = useRef(false);

  // One `checker_preview_viewed` per mount, fired when the text is actually
  // visible (opened by default or by the user). `surface` is an existing
  // Data Layer Variable in the GTM container; no CV content is sent.
  useEffect(() => {
    if (!open || trackedRef.current) return;
    trackedRef.current = true;
    track("checker_preview_viewed", { surface });
  }, [open, surface]);

  const errors = stats.notes.filter((n) => n.severity === "error");
  const summary = [
    `${nf.format(stats.chars)} characters`,
    `${nf.format(stats.words)} words`,
    `${nf.format(stats.lines)} lines`,
    pages ? `${pages} ${pages === 1 ? "page" : "pages"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-labelledby="ats-text-preview-title"
      data-testid="ats-text-preview"
      className="rounded-xl border border-line bg-paper-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2
            id="ats-text-preview-title"
            className="font-display text-sm font-semibold text-slate-900"
          >
            What the ATS sees
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {summary}
            {fileName ? (
              <>
                {" "}
                · <span className="break-all">{fileName}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="ats-text-preview-body"
          className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-4 text-sm font-medium text-slate-700 transition hover:bg-paper-2"
        >
          {open ? "Hide text" : "Show text"}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {stats.notes.length > 0 && (
        <ul className="space-y-1.5 border-t border-line px-4 py-3" aria-label="Possible lost content">
          {stats.notes.map((n) => (
            <li
              key={n.id}
              className={`flex gap-2 text-xs leading-relaxed ${
                n.severity === "error" ? "text-severity-error-text" : "text-severity-review-text"
              }`}
            >
              <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div id="ats-text-preview-body" hidden={!open} className="border-t border-line">
        <p className="px-4 pt-3 text-xs text-slate-600">
          Plain text in the order a parser reads it. Columns, tables and
          images are already gone at this stage — this is all the software
          has to work with.
          {errors.length === 0 && stats.words > 0
            ? " Nothing here suggests lost content."
            : ""}
        </p>
        <pre
          className="font-mono m-0 max-h-[26rem] overflow-auto whitespace-pre-wrap break-words px-4 pb-4 pt-3 text-[12px] leading-relaxed text-slate-800"
          tabIndex={0}
        >
          {text.length > 0 ? text : "(nothing extracted)"}
        </pre>
      </div>
    </section>
  );
}
