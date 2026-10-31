"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfTextInBrowserDetailed } from "@/lib/importers/pdfAdapter";
import { extractDocxTextInBrowser } from "@/lib/importers/docxAdapter";
import AtsTextPreview from "./AtsTextPreview";
import {
  saveExtractionPreview,
  type ExtractionKind,
} from "@/lib/resumeChecker/extractionPreview";

/** The text the browser pulled out of the file — shown as "What the ATS
 *  sees" (B3) and the very same string that is posted for the report. */
type Extracted = { text: string; kind: ExtractionKind; pages?: number; fileName: string };

type Phase =
  | "idle"
  | "extracting"
  | "reading"
  | "checking"
  | "scoring"
  | "long"
  | "error";

const PHASE_COPY: Record<Phase, string> = {
  idle: "",
  extracting: "Reading your file in browser…",
  reading: "Reading your CV…",
  checking: "Checking against ATS rules…",
  scoring: "Scoring…",
  long: "Still working — this CV is taking a moment…",
  error: "",
};

const MAX_BYTES = 5 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);

  const isBusy = phase !== "idle" && phase !== "error";

  // Phase animation timers (visual progress, not tied to server)
  useEffect(() => {
    if (phase !== "reading") return;
    // Measured 2026-10 (audit F18): a one-page CV takes ~35–40 s end to end
    // on Haiku 5.5, so the "taking a moment" phase must not fire at 12 s or
    // every user sees the slow-path copy on every run.
    const t1 = setTimeout(() => setPhase((p) => (p === "reading" ? "checking" : p)), 4000);
    const t2 = setTimeout(() => setPhase((p) => (p === "checking" ? "scoring" : p)), 14000);
    const t3 = setTimeout(() => setPhase((p) => (p === "scoring" ? "long" : p)), 45000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase]);

  const validate = useCallback((file: File): string | null => {
    // PDF or DOCX (WP-2). Extension decides; MIME is only a cross-check
    // because browsers report Word files inconsistently.
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isDocx = name.endsWith(".docx");
    if (!isPdf && !isDocx) {
      return name.endsWith(".doc")
        ? "Old .doc format isn't supported — save it as .docx (or PDF) and try again."
        : "Only PDF and DOCX files are supported.";
    }
    if (
      file.type &&
      file.type !== "application/pdf" &&
      file.type !== DOCX_MIME &&
      file.type !== "application/octet-stream"
    ) {
      return "File doesn't look like a PDF or DOCX. Check the extension.";
    }
    if (file.size === 0) {
      return "This file is empty.";
    }
    if (file.size > MAX_BYTES) {
      return "File is larger than 5MB. Export a lighter PDF and try again.";
    }
    return null;
  }, []);

  const submit = useCallback(
    async (file: File) => {
      const validationErr = validate(file);
      if (validationErr) {
        setError(validationErr);
        setPhase("error");
        return;
      }

      setError(null);
      setFileName(file.name);
      setExtracted(null);
      setPhase("extracting");

      const isDocx = file.name.toLowerCase().endsWith(".docx");
      const kind: ExtractionKind = isDocx ? "docx" : "pdf";
      let rawText: string;
      let pages: number | undefined;
      try {
        if (isDocx) {
          rawText = await extractDocxTextInBrowser(file);
        } else {
          const out = await extractPdfTextInBrowserDetailed(file);
          rawText = out.text;
          pages = out.pages;
        }
      } catch {
        setError(
          isDocx
            ? "We couldn't open this Word file. Save it again as .docx (or export a PDF) and try again."
            : "We couldn't read this PDF. Try re-saving it from the original source.",
        );
        setPhase("error");
        return;
      }

      // Show what came out BEFORE anything is sent — also on the too-short
      // path, where seeing the handful of characters explains the error.
      const preview: Extracted = { text: rawText, kind, pages, fileName: file.name };
      setExtracted(preview);

      if (rawText.trim().length < 200) {
        setError(
          isDocx
            ? "This document has almost no readable text. Check the file and try again."
            : "This PDF looks like a scanned image — no readable text. Export a text-based PDF from Word or Google Docs and try again.",
        );
        setPhase("error");
        return;
      }

      setPhase("reading");

      try {
        const res = await fetch("/api/resume-checker/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, fileName: file.name }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          const msg = payload?.error ?? "We couldn't process this CV.";
          setError(msg);
          setPhase("error");
          return;
        }

        const payload = (await res.json()) as { reportId?: string };
        if (!payload.reportId) {
          setError("Parser returned no report id. Please try again.");
          setPhase("error");
          return;
        }

        // Carry the same text to the report page (this tab only) so the
        // panel can sit next to the findings. Nothing is sent anywhere.
        saveExtractionPreview({ ...preview, reportId: payload.reportId });
        router.push(`/resume-checker/report/${payload.reportId}`);
      } catch {
        setError("Network error. Check your connection and try again.");
        setPhase("error");
      }
    },
    [router, validate],
  );

  const onFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      submit(files[0]);
    },
    [submit],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (isBusy) return;
      onFilesSelected(e.dataTransfer.files);
    },
    [isBusy, onFilesSelected],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      if (isBusy) return;
      setIsDragging(true);
    },
    [isBusy],
  );

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const reset = useCallback(() => {
    setError(null);
    setPhase("idle");
    setFileName(null);
    setExtracted(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div id="resume-checker-dropzone" className="w-full">
      <div className="rounded-2xl bg-paper p-6 shadow-float sm:p-8">
        {/* Keyboard focus: the file input is sr-only, so the visible ring is
            surfaced on the label via :has(input:focus-visible) — scoped to the
            input so the error-state "Try again" button (also a descendant)
            doesn't ring the whole dropzone. Keyboard-only, matching the
            documented globals.css focus convention. */}
        <label
          htmlFor="resume-checker-file"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={[
            "block w-full cursor-pointer rounded-xl border-2 border-dashed px-6 py-14 text-center transition has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--focus-ring,var(--ff-accent))]",
            isDragging
              ? "border-ff-accent bg-ff-accent/5"
              : phase === "error"
                ? "border-severity-error-border bg-severity-error-bg/40"
                : "border-line-strong bg-paper-2 hover:border-ff-accent hover:bg-ff-accent/5",
            isBusy ? "pointer-events-none opacity-95" : "",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            id="resume-checker-file"
            type="file"
            // Explicit name: while a file is being read the label's only
            // text sits inside the role="status" live region, which does not
            // name the input, and axe reports the control as unlabelled in
            // exactly the state the checker smoke inspects (2026-10-31).
            aria-label="Upload your CV (PDF or DOCX)"
            accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => onFilesSelected(e.target.files)}
            disabled={isBusy}
          />

          {!isBusy && phase !== "error" && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-ff-accent-soft text-ff-accent-dark"
                aria-hidden
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-6 w-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              </div>
              <div className="text-lg font-semibold text-slate-900">
                Drop your CV here, or click to upload
              </div>
              <div className="text-sm text-slate-600">
                PDF or DOCX · max 5MB · no sign-up
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Your file is read in this browser — only the extracted text
                is sent to build your report.
              </div>
            </div>
          )}

          {isBusy && (
            <div
              className="flex flex-col items-center gap-3"
              role="status"
              aria-live="polite"
            >
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-line-strong border-t-ff-accent"
                aria-hidden
              />
              <div className="text-base font-medium text-slate-900">
                {PHASE_COPY[phase]}
              </div>
              {fileName && (
                <div className="text-sm text-slate-600">{fileName}</div>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3" role="alert">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-error-bg text-severity-error"
                aria-hidden
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div className="text-base font-semibold text-slate-900">
                Something went wrong
              </div>
              <div className="max-w-md text-sm text-slate-600">{error}</div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  reset();
                }}
                className="mt-2 rounded-full bg-ff-accent px-5 py-2.5 text-sm font-semibold text-white shadow-cta transition hover:-translate-y-0.5 hover:brightness-[1.08] hover:shadow-cta-hover"
              >
                Try again
              </button>
            </div>
          )}
        </label>

        {/* Trust chip row */}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TrustChip
            label="No sign-up"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />
          <TrustChip
            label="Results in under a minute"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            }
          />
          <TrustChip
            label="Deleted in 24h"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4m-6-8V7a6 6 0 1112 0v0m-14 4h16v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9z" />
              </svg>
            }
          />
        </div>

        {/* "What the ATS sees" (B3): the extracted text, visible while the
            report is being built and kept on the error path. Client-only,
            on text already in the browser. */}
        {extracted && (
          <div className="mt-5">
            <AtsTextPreview
              text={extracted.text}
              kind={extracted.kind}
              pages={extracted.pages}
              fileName={extracted.fileName}
              surface="upload"
              defaultOpen={phase === "error"}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TrustChip({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 py-2 text-xs font-medium text-slate-600">
      <span className="text-ff-accent-dark" aria-hidden>
        {icon}
      </span>
      {label}
    </div>
  );
}
