"use client";

import { useEffect, useRef } from "react";
import type { MissingItem } from "../../lib/validation/cvRequirements";
import { Icon } from "./Icon";

/**
 * Export-time confirm — THE ONLY blocking dialog in the guided-feedback
 * system (2026-06). Shown when the user triggers an export (PDF or DOCX)
 * while required content is missing. Lists exactly what's missing (from
 * the shared cvRequirements module — the same list the field badges and
 * stepper read), with two honest exits:
 *
 *   - "Go back and fix" → navigate to the first incomplete section
 *   - "Export anyway"   → proceed normally; never a hard block
 *
 * A11y: role=dialog + aria-modal, labelled by its heading, focus moves
 * into the dialog on open and is trapped (Tab wraps), Escape and backdrop
 * close it, and focus returns to the previously-focused element on close.
 */
export const ExportGateDialog = ({
  open,
  missing,
  onClose,
  onGoFix,
  onExportAnyway,
}: {
  open: boolean;
  missing: MissingItem[];
  onClose: () => void;
  onGoFix: () => void;
  onExportAnyway: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    primaryRef.current?.focus();
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Group items by section, preserving builder-step order.
  const grouped = missing.reduce<Array<{ title: string; items: MissingItem[] }>>(
    (acc, m) => {
      const bucket = acc.find((g) => g.title === m.sectionTitle);
      if (bucket) bucket.items.push(m);
      else acc.push({ title: m.sectionTitle, items: [m] });
      return acc;
    },
    [],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-gate-title"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: "rgba(11,15,12,0.45)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--ff-card)",
          borderRadius: 16,
          border: "1px solid var(--ff-line)",
          padding: 22,
          boxShadow: "0 24px 60px rgba(11,15,12,0.25)",
        }}
      >
        <h2
          id="export-gate-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 17,
            fontWeight: 600,
            color: "var(--ff-ink)",
          }}
        >
          A few things are still missing
        </h2>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--ff-muted)",
          }}
        >
          Your CV will export without these — fill them in for the strongest
          first impression, or export as-is.
        </p>

        <div
          style={{
            marginTop: 14,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingRight: 4,
          }}
        >
          {grouped.map((g) => (
            <div key={g.title}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ff-warn)",
                }}
              >
                {g.title}
              </p>
              <ul style={{ marginTop: 4 }}>
                {g.items.map((m, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "3px 0",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--ff-ink-2)",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--ff-warn)",
                        flexShrink: 0,
                        marginTop: 7,
                      }}
                    />
                    {m.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="cv-btn-secondary"
            style={{ padding: "11px 16px" }}
            onClick={onExportAnyway}
          >
            Export anyway
          </button>
          <button
            ref={primaryRef}
            type="button"
            className="cv-btn-primary"
            style={{ padding: "11px 16px" }}
            onClick={onGoFix}
          >
            <Icon name="edit" size={13} />
            Go back and fix
          </button>
        </div>
      </div>
    </div>
  );
};
