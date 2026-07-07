"use client";

import { useEffect } from "react";

/* Root segment error boundary (audit 2026-06-12, gap #2).
 * Catches render/data crashes anywhere under app/ that a more specific
 * boundary (builder, resume-checker, preview island) didn't handle.
 *
 * UX rules for a no-account product:
 * 1. Lead with reassurance — CV data lives in localStorage and survives
 *    a crash; users' worst fear here is "I lost my CV".
 * 2. One primary action (Try again = reset()), one safe exit (builder).
 * 3. Show the digest so support emails are actionable.
 * Root layout still renders around this file, so globals.css tokens and
 * next/font variables are available. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel picks console.error up in browser logs; swap for Sentry later.
    console.error("[app/error]", error);
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
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          Don&apos;t worry — your CV is safe. Everything you typed is saved
          in this browser automatically, and nothing was lost.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="cv-btn-primary">
            Try again
          </button>
          <a href="/builder" className="cv-btn-secondary">
            Back to the builder
          </a>
        </div>
        <p className="mt-6 text-xs" style={{ color: "var(--text-faint)" }}>
          Still stuck? Email{" "}
          <a href="mailto:hello@makemycv.ae" className="underline">
            hello@makemycv.ae
          </a>
          {error.digest ? ` and mention code ${error.digest}` : ""}.
        </p>
      </div>
    </main>
  );
}
