"use client";

import { useEffect } from "react";

/* Resume-checker segment boundary (audit 2026-06-12, gap #2).
 * Covers /resume-checker and the /report/[reportId] subtree. Reports
 * live in KV for 24h, so a crash on the report page is recoverable by
 * revisiting the same URL — say so explicitly. */
export default function ResumeCheckerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[resume-checker/error]", error);
  }, [error]);

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--surface-page)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: "var(--surface-card)",
          borderColor: "var(--border-soft)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <span
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: "var(--ff-warn-soft)", color: "var(--ff-warn)" }}
        >
          !
        </span>
        <h1
          className="mt-4 text-xl font-semibold"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          The checker hit a snag
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          If you already generated a report, it stays available at the same
          link for 24 hours — try again or re-open it. Nothing was charged,
          nothing was lost.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--brand-primary)" }}
          >
            Try again
          </button>
          <a
            href="/resume-checker"
            className="rounded-full border px-5 py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--border-medium)", color: "var(--text-body)" }}
          >
            Upload again
          </a>
        </div>
        <p className="mt-6 text-xs" style={{ color: "var(--text-faint)" }}>
          Need help? Email{" "}
          <a href="mailto:hello@makemycv.ae" className="underline">
            hello@makemycv.ae
          </a>
          {error.digest ? ` with code ${error.digest}` : ""}.
        </p>
      </div>
    </main>
  );
}
