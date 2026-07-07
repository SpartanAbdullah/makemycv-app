"use client";

import { useEffect } from "react";

/* Builder segment boundary (audit 2026-06-12, gap #2).
 * More specific copy than the root boundary: the user was mid-edit, so
 * the reassurance must be concrete — autosave runs on every change
 * (debounced 500ms to localStorage), so at most the last keystroke is
 * lost. reset() re-renders the segment; the Zustand store is untouched
 * by the crash, so the form state comes back exactly as it was. */
export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[builder/error]", error);
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
          The builder hit a snag
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          Your CV is safe. Every change you make is saved in this browser
          automatically — picking up where you left off takes one click.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="cv-btn-primary">
            Continue editing
          </button>
          <a href="/builder" className="cv-btn-secondary">
            Reload the builder
          </a>
        </div>
        <p className="mt-6 text-xs" style={{ color: "var(--text-faint)" }}>
          Happens again? Email{" "}
          <a href="mailto:hello@makemycv.ae" className="underline">
            hello@makemycv.ae
          </a>
          {error.digest ? ` with code ${error.digest}` : ""}.
        </p>
      </div>
    </main>
  );
}
