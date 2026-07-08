"use client";

import { useEffect } from "react";
import { useUiStore, type Toast } from "../../lib/store/uiStore";

/**
 * Tiny in-house toast surface (guided-feedback work, 2026-06) — deliberately
 * a few dozen lines instead of a dependency. Mounted once in BuilderShell.
 *
 * - aria-live="polite": screen readers announce new toasts without
 *   interrupting what the user is doing.
 * - Never blocking: pointer events pass through the container; each card is
 *   individually dismissible and auto-dismisses after its duration.
 * - Sits above the mobile Edit|Preview pill (bottom offset below xl).
 */
export const Toaster = () => {
  const toasts = useUiStore((s) => s.toasts);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="ff-toaster"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        width: "min(420px, calc(100vw - 32px))",
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
      <style>{`
        .ff-toaster { bottom: 96px; }
        @media (min-width: 1280px) {
          .ff-toaster { bottom: 24px; }
        }
        @keyframes ff-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const ToastCard = ({ toast }: { toast: Toast }) => {
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    const t = window.setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.duration, dismissToast]);

  const isSuccess = toast.tone === "success";

  return (
    <div
      role="status"
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        background: isSuccess ? "var(--ff-accent-soft)" : "var(--ff-warn-soft)",
        border: `1px solid ${isSuccess ? "rgba(14,124,74,0.30)" : "#F7E2A3"}`,
        boxShadow: "0 10px 30px rgba(11,15,12,0.12)",
        animation: "ff-toast-in 160ms ease-out",
      }}
    >
      <p
        style={{
          flex: 1,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1.5,
          color: isSuccess ? "var(--ff-accent-dark)" : "var(--ff-warn)",
          fontWeight: 500,
        }}
      >
        {toast.text}
      </p>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          // ff-hit-target's invisible inset extends the tap zone to meet the
          // 44px touch-target rule without changing the layout box.
          className="ff-hit-target"
          onClick={() => {
            toast.onAction?.();
            dismissToast(toast.id);
          }}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isSuccess ? "var(--ff-accent-dark)" : "var(--ff-warn)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            // Generous hit area per the 44px touch-target rule.
            padding: "10px 8px",
            margin: "-8px 0",
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        // Same ff-hit-target extension as the action button above.
        className="ff-hit-target"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: 14,
          lineHeight: 1,
          // Generous hit area per the 44px touch-target rule.
          padding: "10px 12px",
          margin: "-8px -10px -8px 0",
        }}
      >
        ×
      </button>
    </div>
  );
};
