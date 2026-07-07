"use client";

import { useState } from "react";

/**
 * Shares the report URL. Two honesty/UX upgrades from the 2026-06 audit:
 * ENG-17 — the user is told the link exposes their report (which contains
 * their parsed CV) to anyone holding it; ENG-18 — native share sheet first
 * (WhatsApp-first UAE audience), clipboard fallback.
 */
export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const HINT =
    "Anyone with this link can view your report until it expires (24h).";

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My ATS report — MakeMyCV", url });
      } catch {
        // Share sheet dismissed — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked — silently fail. User can copy the URL manually.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-live="polite"
      title={HINT}
      aria-label={`Share report. ${HINT}`}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-paper-2"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-severity-good" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-severity-good-text">Copied!</span>
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Share report
        </>
      )}
    </button>
  );
}
