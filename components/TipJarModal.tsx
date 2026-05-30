"use client";

import { useEffect } from "react";
import { TipJar } from "./TipJar";

/**
 * TipJarModal — non-blocking, dismissible wrapper around <TipJar />.
 *
 * Rules (see DECISION_LOG.md 2026-05-31 and the implementation spec):
 *   - Only shows when the caller flips `open` to true AFTER a deliberate
 *     user success moment. NEVER popped open at app load.
 *   - Suppressed for 90 days if `localStorage.mmcv_tipped_at` is set
 *     (either by tipping or by a prior dismissal).
 *   - Suppressed for the rest of the session once shown OR dismissed —
 *     tracked at module scope so it crosses route boundaries (Builder ↔
 *     ATS report). React state alone would re-trigger when a new wrapper
 *     mounts on a different page.
 *   - Dismiss via X, Escape, or backdrop click. Caller's `onClose` is
 *     called in all three cases.
 *
 * The TipJar itself writes `mmcv_tipped_at` on a successful tip; this
 * wrapper writes the same key on dismissal so a refresh + retry doesn't
 * surface the modal again the same day.
 */

const STORAGE_KEY = "mmcv_tipped_at";
const SUPPRESS_DAYS = 90;

// Module-scoped session flag. Survives route changes (no remount), gets
// reset when the tab is closed. NOT a React state — that would be local
// to a single TipJarModal instance.
let shownOrDismissedThisSession = false;

function isSuppressed(): boolean {
  if (shownOrDismissedThisSession) return true;
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const stamped = Date.parse(stored);
    if (Number.isNaN(stamped)) return false;
    const ageMs = Date.now() - stamped;
    const cutoffMs = SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
    return ageMs < cutoffMs;
  } catch {
    return false;
  }
}

function markSeen(): void {
  shownOrDismissedThisSession = true;
  if (typeof window === "undefined") return;
  try {
    // Setting mmcv_tipped_at on dismissal too means a same-session refresh
    // won't re-prompt. The tipping flow (handleTipClick inside TipJar) also
    // sets this — same key, same effect.
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  context?: "post-download" | "post-ats-check";
};

export const TipJarModal = ({ open, onClose, context }: Props) => {
  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markSeen();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Mark the session as having shown the modal the first time it opens.
  // We don't want a second `open=true` later in the same session to slip
  // past the isSuppressed() check before this effect runs.
  useEffect(() => {
    if (open && !isSuppressed()) {
      shownOrDismissedThisSession = true;
    }
  }, [open]);

  if (!open) return null;
  if (isSuppressed() && !shownOrDismissedThisSession) return null;

  const handleClose = () => {
    markSeen();
    onClose();
  };

  return (
    <div
      data-tipjar-modal
      role="dialog"
      aria-modal="true"
      aria-label="Support MakeMyCV"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(11,15,12,0.55)",
        padding: 16,
        animation: "tipjar-fade-in 180ms ease-out",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 460,
        }}
      >
        {/* Close button — absolute over the TipJar card so it always wins
            the tap target even with the card's lift transform. */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            zIndex: 2,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--ff-ink, #0B0F0C)",
            color: "white",
            border: "none",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <TipJar
          variant="compact"
          context={context}
          onDismiss={handleClose}
        />
      </div>

      <style>{`
        @keyframes tipjar-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TipJarModal;
