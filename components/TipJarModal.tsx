"use client";

import { useEffect } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { TipJar } from "./TipJar";
import { ModalCloseButton } from "./ui/ModalCloseButton";

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

  // Lock body scroll while open — reference-counted (shared hook) so
  // overlapping lock-holders release in any order.
  useBodyScrollLock(open);

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
        background: "var(--surface-overlay)",
        padding: 16,
        animation: "tipjar-fade-in 180ms ease-out",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
        }}
      >
        {/* Close button — kept in this wrapper (absolute over the TipJar
            card) so it always wins the tap target even with the card's
            lift transform. Visually it sits inside the card bounds using
            the shared ModalCloseButton treatment; the compact card is
            bg-white so the gray-on-white icon reads fine. */}
        <ModalCloseButton
          onClick={handleClose}
          style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
        />

        <TipJar
          variant="compact"
          context={context}
          onDismiss={handleClose}
        />
      </div>

      <style>{`
        @keyframes tipjar-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default TipJarModal;
