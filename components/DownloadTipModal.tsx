"use client";

import { useEffect, useState } from "react";
import { SUPPORT_URL } from "../lib/config/support";

/**
 * DownloadTipModal — post-download tip jar surface.
 *
 * The Builder Download flow runs PDF generation immediately; on success,
 * the parent schedules this modal to open ~1500ms later — but ONLY if
 * `shouldShowDownloadTip()` returns true (no recent tip + not dismissed
 * this session). This is a tip jar, not a paywall: nothing gates the
 * download.
 *
 * Phase set:
 *   picking ── tip presets + custom amount + emoji escalation.
 *              Primary CTA "Tip $X via PayPal" opens PayPal in a new
 *              tab, writes mmcv_tipped_at, advances to thanks. NO
 *              download is triggered — the download already happened.
 *   thanks  ── 🎉 + personalised thank-you, spread-the-word with copy
 *              link, feedback link.
 *
 * Suppression (two layers, both checked by `shouldShowDownloadTip()`):
 *   1. `localStorage.mmcv_tipped_at` — 90-day window after a successful
 *      tip. Written by this modal on tip click, also by TipJar/
 *      TipJarModal in the ATS flow. Persists across refreshes.
 *   2. Module-level `dismissedThisSession` — set on any close (X, Esc,
 *      backdrop). Survives client navigation between Builder and Review
 *      because module state is per-JS-execution-context; resets on a
 *      true page reload. Mirrors the TipJarModal pattern.
 *
 * On a tip, suppression layer 1 kicks in (mmcv_tipped_at set). On a
 * plain dismiss without tipping, layer 2 kicks in (module flag) — user
 * gets prompted again after a page refresh, never within the session.
 *
 * This is a deliberate revert of the pre-download tip-gate that shipped
 * in 116c4aa. See DECISION_LOG.md 2026-05-31 (second entry) for the why.
 */

const PAYPAL_HANDLE =
  process.env.NEXT_PUBLIC_PAYPAL_ME_HANDLE || "Abdullah2431";
const PRESETS = [3, 5, 10, 25];
const SHARE_URL = "https://makemycv.ae";
const STORAGE_KEY = "mmcv_tipped_at";
const SUPPRESS_DAYS = 90;

// Module-scoped session flag. Survives client navigation (Builder ↔
// Review), resets only on a true page reload. Mirrors TipJarModal.
let dismissedThisSession = false;

function isWithinSuppressionWindow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const stamped = Date.parse(stored);
    if (Number.isNaN(stamped)) return false;
    const ageMs = Date.now() - stamped;
    return ageMs < SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Combined suppression check for callers. Returns false if the user has
 * tipped in the last 90 days OR has dismissed the modal at any point
 * this session. Parents should call this before scheduling the modal to
 * open.
 */
export function shouldShowDownloadTip(): boolean {
  return !dismissedThisSession && !isWithinSuppressionWindow();
}

type Phase = "picking" | "thanks";

type Props = {
  open: boolean;
  onClose: () => void;
  /** First name for personalised thanks copy. Optional. */
  userName?: string;
};

function emojiFor(amount: number): { emoji: string; message: string } {
  if (amount < 1) {
    return { emoji: "\u{1F914}", message: "Pick an amount to keep us going." };
  }
  if (amount <= 2) {
    return { emoji: "\u{1F642}", message: "Thanks — every bit helps." };
  }
  if (amount <= 6) {
    return { emoji: "\u{1F60A}", message: "Really appreciate this." };
  }
  if (amount <= 14) {
    return { emoji: "\u{1F929}", message: "Wow — thank you!" };
  }
  if (amount <= 49) {
    return { emoji: "\u{1F979}", message: "You're incredibly kind." };
  }
  return { emoji: "\u{1F680}", message: "You're a legend. Genuinely." };
}

export const DownloadTipModal = ({ open, onClose, userName }: Props) => {
  const [phase, setPhase] = useState<Phase>("picking");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [tippedAmount, setTippedAmount] = useState(0);

  const amount =
    selectedPreset ??
    (customAmount ? Math.max(0, Math.floor(Number(customAmount))) : 0);
  const { emoji, message } = emojiFor(amount);
  const canTip = amount >= 1;

  // Reset to picking each time the modal opens
  useEffect(() => {
    if (!open) return;
    setPhase("picking");
    setSelectedPreset(5);
    setCustomAmount("");
    setShareCopied(false);
    setTippedAmount(0);
  }, [open]);

  // Escape closes — inline the dismiss logic so the effect closure
  // doesn't have to capture a handleClose ref.
  useEffect(() => {
    if (!open) return;
    if (isWithinSuppressionWindow()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissedThisSession = true;
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while visible
  useEffect(() => {
    if (!open) return;
    if (isWithinSuppressionWindow()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  // Defense-in-depth: parents already filter via shouldShowDownloadTip(),
  // but a stale open=true from a 90-day-old localStorage stamp would
  // otherwise leak through. Render nothing if suppressed.
  if (isWithinSuppressionWindow()) return null;

  const handleClose = () => {
    dismissedThisSession = true;
    onClose();
  };

  const handleTip = () => {
    if (!canTip) return;
    const url = `https://paypal.me/${PAYPAL_HANDLE}/${amount}USD`;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* localStorage unavailable — silent fail */
    }
    setTippedAmount(amount);
    setPhase("thanks");
  };

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      /* clipboard blocked — silent fail */
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const displayName = userName?.trim() || "";

  return (
    <div
      data-download-tip-modal
      role="dialog"
      aria-modal="true"
      aria-label="Support MakeMyCV"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(11,15,12,0.62)",
        padding: 16,
        animation: "dtm-fade-in 180ms ease-out",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: "white",
          borderRadius: 20,
          boxShadow:
            "0 28px 80px -16px rgba(37,99,235,0.30), 0 12px 32px rgba(15,23,42,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Accent bar */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              "linear-gradient(90deg, #2563eb 0%, #4f46e5 50%, #2563eb 100%)",
          }}
        />

        {/* Close button — always available; the modal is a non-blocking
            tip jar, never a gate. */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div style={{ padding: "32px 28px 28px" }}>
          {phase === "picking" && (
            <PickingView
              amount={amount}
              canTip={canTip}
              emoji={emoji}
              message={message}
              selectedPreset={selectedPreset}
              customAmount={customAmount}
              onSelectPreset={(p) => {
                setSelectedPreset(p);
                setCustomAmount("");
              }}
              onCustomChange={(v) => {
                setCustomAmount(v);
                setSelectedPreset(null);
              }}
              onTip={handleTip}
            />
          )}

          {phase === "thanks" && (
            <ThanksView
              amount={tippedAmount}
              displayName={displayName}
              shareCopied={shareCopied}
              onCopyShare={handleCopyShare}
              onClose={handleClose}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes dtm-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

/* ─── Picking ──────────────────────────────────────────────── */

function PickingView({
  amount,
  canTip,
  emoji,
  message,
  selectedPreset,
  customAmount,
  onSelectPreset,
  onCustomChange,
  onTip,
}: {
  amount: number;
  canTip: boolean;
  emoji: string;
  message: string;
  selectedPreset: number | null;
  customAmount: string;
  onSelectPreset: (p: number) => void;
  onCustomChange: (v: string) => void;
  onTip: () => void;
}) {
  return (
    <>
      <h2
        className="font-display"
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
          margin: 0,
          marginTop: 4,
        }}
      >
        Did this help?
      </h2>
      <p
        style={{
          fontSize: 13.5,
          color: "#64748b",
          marginTop: 6,
          marginBottom: 0,
          lineHeight: 1.55,
        }}
      >
        MakeMyCV is free because of people like you. A tip covers hosting
        and the AI behind the bullets — completely optional.
      </p>

      {/* Presets */}
      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {PRESETS.map((p) => {
          const active = selectedPreset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelectPreset(p)}
              aria-pressed={active}
              className={
                active
                  ? "btn-primary"
                  : "transition-colors hover:border-blue-300 hover:text-[#2563eb]"
              }
              style={{
                padding: "10px 0",
                borderRadius: 10,
                border: active ? "none" : "1px solid #e2e8f0",
                background: active ? undefined : "white",
                color: active ? "white" : "#334155",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ${p}
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div style={{ marginTop: 12 }}>
        <label
          htmlFor="dtm-custom-amount"
          style={{
            display: "block",
            fontSize: 11,
            color: "#64748b",
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          Or enter your own amount
        </label>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#64748b",
              pointerEvents: "none",
            }}
          >
            $
          </span>
          <input
            id="dtm-custom-amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="0"
            style={{
              width: "100%",
              padding: "10px 12px 10px 26px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 14,
              color: "#0f172a",
              outline: "none",
              background: "white",
            }}
          />
        </div>
      </div>

      {/* Emoji + message */}
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>{emoji}</div>
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 500,
            color: "#334155",
          }}
        >
          {message}
        </p>
      </div>

      {/* Primary CTA — decoupled from download (the download already
          ran in the parent). */}
      <button
        type="button"
        onClick={onTip}
        disabled={!canTip}
        className={canTip ? "btn-primary" : undefined}
        style={{
          marginTop: 18,
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          fontSize: 15,
          fontWeight: 700,
          color: "white",
          background: canTip ? undefined : "#cbd5e1",
          cursor: canTip ? "pointer" : "not-allowed",
        }}
      >
        {canTip
          ? `Tip $${amount} via PayPal`
          : "Pick an amount to continue"}
      </button>

      {/* Reassurance — the Abdullah2431 trust bridge. Tells the user
          exactly who/what they'll see on the PayPal page so the handle
          doesn't read as a phishing link. */}
      <p
        style={{
          marginTop: 12,
          fontSize: 11.5,
          color: "#64748b",
          textAlign: "center",
          lineHeight: 1.55,
        }}
      >
        You&apos;ll be sent to PayPal. The handle is{" "}
        <code
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            background: "#f1f5f9",
            padding: "1px 5px",
            borderRadius: 4,
            fontSize: 11,
            color: "#334155",
          }}
        >
          Abdullah2431
        </code>{" "}
        — that&apos;s me, the developer behind MakeMyCV. The page will show
        &ldquo;Abdullah &mdash; MakeMyCV&rdquo; to confirm.
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        No PayPal account needed &mdash; credit card works too.
      </p>
    </>
  );
}

/* ─── Thanks (post-tip) ────────────────────────────────────── */

function ThanksView({
  amount,
  displayName,
  shareCopied,
  onCopyShare,
  onClose,
}: {
  amount: number;
  displayName: string;
  shareCopied: boolean;
  onCopyShare: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>{"\u{1F389}"}</div>
        <h2
          className="font-display"
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#0f172a",
            margin: "14px 0 0",
          }}
        >
          {displayName ? `Thank you, ${displayName}!` : "Thank you!"}
        </h2>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#475569",
            lineHeight: 1.55,
          }}
        >
          Your ${amount} tip helps keep MakeMyCV free for everyone in the UAE
          looking for work.
        </p>
      </div>

      {/* Spread the word */}
      <div
        style={{
          marginTop: 22,
          padding: 16,
          borderRadius: 12,
          background: "#EFF6FF",
          border: "1px solid #DBEAFE",
        }}
      >
        <p
          className="font-display"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1e3a8a",
            margin: 0,
          }}
        >
          Help us reach more job-seekers
        </p>
        <p
          style={{
            marginTop: 4,
            fontSize: 12.5,
            color: "#1e40af",
            lineHeight: 1.55,
          }}
        >
          Share MakeMyCV with someone who needs it. Word-of-mouth is the only
          marketing we do.
        </p>
        <button
          type="button"
          onClick={onCopyShare}
          style={{
            marginTop: 10,
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: "white",
            color: "#1d4ed8",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {shareCopied ? "Link copied ✓" : "Copy share link"}
        </button>
      </div>

      {/* Feedback */}
      <p
        style={{
          marginTop: 18,
          fontSize: 12.5,
          color: "#64748b",
          textAlign: "center",
        }}
      >
        Got feedback?{" "}
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          We&apos;d love to hear it
        </a>
        .
      </p>

      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "white",
          color: "#334155",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </>
  );
}

export default DownloadTipModal;
