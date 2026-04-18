"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "idle" | "reading" | "checking" | "scoring" | "long" | "error";

const PHASE_COPY: Record<Phase, string> = {
  idle: "",
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
      setPhase("reading");

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/resume-checker/parse", {
          method: "POST",
          body: formData,
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
    <div className="w-full">
      <label
        htmlFor="resume-checker-file"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "block w-full cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
          isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50",
          isBusy ? "pointer-events-none opacity-90" : "",
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
              className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
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
          </div>
        )}

        {isBusy && (
          <div
            className="flex flex-col items-center gap-3"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
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
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"
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
              className="mt-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        )}
      </label>
    </div>
  );
}
