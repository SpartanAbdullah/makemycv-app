"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfTextInBrowser } from "@/lib/importers/pdfAdapter";

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
  extracting: "Reading PDF in browser…",
  reading: "Reading your CV…",
  checking: "Checking against ATS rules…",
  scoring: "Scoring…",
  long: "Still working — this CV is taking a moment…",
  error: "",
};

const MAX_BYTES = 5 * 1024 * 1024;

export default function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const isBusy = phase !== "idle" && phase !== "error";

  // Phase animation timers (visual progress, not tied to server)
  useEffect(() => {
    if (phase !== "reading") return;
    const t1 = setTimeout(() => setPhase((p) => (p === "reading" ? "checking" : p)), 2500);
    const t2 = setTimeout(() => setPhase((p) => (p === "checking" ? "scoring" : p)), 6000);
    const t3 = setTimeout(() => setPhase((p) => (p === "scoring" ? "long" : p)), 12000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase]);

  const validate = useCallback((file: File): string | null => {
    if (file.type && file.type !== "application/pdf") {
      return "Only PDF files are supported.";
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return "File doesn't look like a PDF. Check the extension.";
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
      setPhase("extracting");

      let rawText: string;
      try {
        rawText = await extractPdfTextInBrowser(file);
      } catch {
        setError(
          "We couldn't read this PDF. Try re-saving it from the original source.",
        );
        setPhase("error");
        return;
      }

      if (rawText.trim().length < 200) {
        setError(
          "This PDF looks like a scanned image — no readable text. Export a text-based PDF from Word or Google Docs and try again.",
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
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div id="resume-checker-dropzone" className="w-full">
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-md-soft sm:p-8">
        {/* Keyboard focus: the file input is sr-only, so the visible ring is
            surfaced on the label via :has(input:focus-visible) — scoped to the
            input so the error-state "Try again" button (also a descendant)
            doesn't ring the whole dropzone. Keyboard-only, matching the
            documented globals.css focus convention; ring color follows the
            surface accent (--focus-ring, brand-blue here). */}
        <label
          htmlFor="resume-checker-file"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={[
            "block w-full cursor-pointer rounded-xl border-2 border-dashed px-6 py-14 text-center transition has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--focus-ring,var(--ff-accent))]",
            isDragging
              ? "border-brand-blue bg-brand-blue/5"
              : phase === "error"
                ? "border-severity-error-border bg-severity-error-bg/40"
                : "border-line-strong bg-paper-2 hover:border-brand-blue hover:bg-brand-blue/5",
            isBusy ? "pointer-events-none opacity-95" : "",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            id="resume-checker-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => onFilesSelected(e.target.files)}
            disabled={isBusy}
          />

          {!isBusy && phase !== "error" && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue"
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
              <div className="text-sm text-slate-500">
                PDF only · max 5MB · no sign-up
              </div>
              <div className="mt-1 text-xs text-slate-400">
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
                className="h-10 w-10 animate-spin rounded-full border-2 border-line-strong border-t-brand-blue"
                aria-hidden
              />
              <div className="text-base font-medium text-slate-900">
                {PHASE_COPY[phase]}
              </div>
              {fileName && (
                <div className="text-sm text-slate-500">{fileName}</div>
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
                className="mt-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-cta-blue transition hover:bg-brand-blue-dark"
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
      </div>
    </div>
  );
}

function TrustChip({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 py-2 text-xs font-medium text-slate-600">
      <span className="text-brand-blue" aria-hidden>
        {icon}
      </span>
      {label}
    </div>
  );
}
