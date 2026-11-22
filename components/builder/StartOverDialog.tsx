"use client";

import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useCvStore } from "../../lib/store/cvStore";
import { downloadCvBackup } from "../../lib/utils/download";

/**
 * "Start a new CV" (product audit 2026-11, O7).
 *
 * The CV is saved in the browser with no account, and until now nothing in
 * the product could clear it: on a shared computer — a family laptop, a
 * typing centre, a library — the next person opened the builder onto the
 * previous person's CV, photo and phone number. `reset()` existed in the
 * store with no caller.
 *
 * Clearing is permanent on purpose (no undo: the point is that the old CV is
 * NOT one tap away), so the dialog offers the backup file first and opens
 * with the keyboard on Cancel.
 *
 * Keyboard contract mirrors ExportGateDialog and the JD Match dialogs: focus
 * moves in, Escape cancels, Tab is trapped, focus returns to the opener.
 */
export const StartOverDialog = ({
  onCancel,
  onCleared,
}: {
  onCancel: () => void;
  onCleared: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const reset = useCvStore((s) => s.reset);
  const [backedUp, setBackedUp] = useState(false);

  useBodyScrollLock(true);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>("button");
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onCancel]);

  const handleBackup = () => {
    // Call-time read and the dependency-free backup path: it must work even
    // if the PDF renderer is broken, and it must not open the export dialog
    // on top of this one.
    downloadCvBackup(useCvStore.getState().data);
    setBackedUp(true);
  };

  const handleClear = () => {
    reset();
    onCleared();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "var(--surface-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-over-title"
        aria-describedby="start-over-body"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--ff-card)",
          borderRadius: "var(--radius-2xl)",
          border: "1px solid var(--ff-line)",
          boxShadow: "0 18px 48px rgba(11,15,12,0.22)",
          padding: 24,
          maxWidth: 460,
          width: "100%",
          outline: "none",
        }}
      >
        <h2
          id="start-over-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--ff-ink)",
            margin: 0,
          }}
        >
          Start a new CV?
        </h2>
        <p
          id="start-over-body"
          style={{ fontSize: 13.5, color: "var(--ff-muted)", lineHeight: 1.55, margin: "8px 0 0" }}
        >
          This clears the CV saved in this browser: every section, your photo
          and your design choices. There is no account, so it cannot be brought
          back afterwards unless you keep a backup file.
        </p>

        <div style={{ margin: "16px 0 20px" }}>
          <button type="button" onClick={handleBackup} className="cv-btn-secondary cv-btn--sm">
            {backedUp ? "Download the backup again" : "Download a backup first"}
          </button>
          <p
            role="status"
            style={{
              fontSize: 12,
              color: "var(--severity-good-text)",
              margin: "8px 0 0",
              minHeight: 18,
              lineHeight: 1.5,
            }}
          >
            {backedUp
              ? "Backup downloaded. Restore it any time from “Restore backup” on this page."
              : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="cv-btn-secondary cv-btn--sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="cv-btn-secondary cv-btn--sm"
            style={{
              color: "var(--severity-error-text)",
              borderColor: "var(--severity-error-border)",
            }}
          >
            Clear this CV and start new
          </button>
        </div>
      </div>
    </div>
  );
};
