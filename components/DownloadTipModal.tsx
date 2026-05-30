"use client";

import { useEffect, useState } from "react";
import { SUPPORT_URL } from "../lib/config/support";

/**
 * DownloadTipModal — pre-download tip gate.
 *
 * Replaces the previous "post-download, dismissible" tip-jar pattern in
 * the Builder flow. Every Download click now opens this modal:
 *
 *   picking     ── user picks a tip amount (or zero)
 *     ├─ "Tip $X & Download" → opens PayPal in a new tab, kicks off the
 *     │   actual PDF download, advances to "thanks" on success.
 *     └─ "Download without supporting 😔" → routes to "reminder".
 *   reminder    ── one more chance to reconsider; honest reminder about
 *                  hosting + AI costs. Two buttons:
 *     ├─ "Take me back" → returns to picking.
 *     └─ "Continue anyway 😢" → runs the download, closes the modal.
 *   downloading ── spinner while triggerDownload() is in flight.
 *   thanks      ── thank-you + spread-the-word + feedback links. Tippers
 *                  only. Closes via X.
 *   error       ── triggerDownload() threw. Retry returns to whichever
 *                  CTA the user came from.
 *
 * The modal does NOT consult mmcv_tipped_at — every download fires the
 * gate. This is a deliberate change from the original spec; see
 * DECISION_LOG.md (the post-2026-05-31 follow-up that flipped the tip
 * jar from "post-success, suppressible" to "pre-download, every time").
 */

const PAYPAL_HANDLE =
  process.env.NEXT_PUBLIC_PAYPAL_ME_HANDLE || "makemycv";
const PRESETS = [3, 5, 10, 25];
const SHARE_URL = "https://makemycv.ae";

type Phase =
  | "picking"
  | "reminder"
  | "downloading"
  | "thanks"
  | "error";

type ErrorOrigin = "tip" | "skip";

type Props = {
  open: boolean;
  onClose: () => void;
  triggerDownload: () => Promise<void>;
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

export const DownloadTipModal = ({
  open,
  onClose,
  triggerDownload,
  userName,
}: Props) => {
  const [phase, setPhase] = useState<Phase>("picking");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [tippedAmount, setTippedAmount] = useState(0);
  const [errorOrigin, setErrorOrigin] = useState<ErrorOrigin>("tip");

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

  // Escape closes (but not during downloading, to avoid leaving an
  // in-flight PDF generator without surfacing its result)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "downloading") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, phase]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const runDownload = async (origin: ErrorOrigin) => {
    setErrorOrigin(origin);
    setPhase("downloading");
    try {
      await triggerDownload();
      return true;
    } catch {
      setPhase("error");
      return false;
    }
  };

  const handleTipAndDownload = async () => {
    if (!canTip) return;
    const url = `https://paypal.me/${PAYPAL_HANDLE}/${amount}USD`;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      localStorage.setItem("mmcv_tipped_at", new Date().toISOString());
    } catch {
      /* localStorage unavailable — silent fail */
    }
    setTippedAmount(amount);
    const ok = await runDownload("tip");
    if (ok) setPhase("thanks");
  };

  const handleSkipTip = () => setPhase("reminder");

  const handleReconsider = () => setPhase("picking");

  const handleContinueAnyway = async () => {
    const ok = await runDownload("skip");
    if (ok) onClose();
  };

  const handleRetry = () => {
    if (errorOrigin === "tip") {
      void runDownload("tip").then((ok) => {
        if (ok) setPhase("thanks");
      });
    } else {
      void runDownload("skip").then((ok) => {
        if (ok) onClose();
      });
    }
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
    if (e.target !== e.currentTarget) return;
    if (phase === "downloading") return;
    onClose();
  };

  const displayName = userName?.trim() || "friend";

  return (
    <div
      data-download-tip-modal
      role="dialog"
      aria-modal="true"
      aria-label="Support MakeMyCV before downloading"
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

        {/* Close button — hidden during downloading */}
        {phase !== "downloading" && (
          <button
            type="button"
            onClick={onClose}
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
        )}

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
              onTipAndDownload={handleTipAndDownload}
              onSkipTip={handleSkipTip}
            />
          )}

          {phase === "reminder" && (
            <ReminderView
              onReconsider={handleReconsider}
              onContinueAnyway={handleContinueAnyway}
            />
          )}

          {phase === "downloading" && <DownloadingView />}

          {phase === "thanks" && (
            <ThanksView
              amount={tippedAmount}
              displayName={displayName}
              shareCopied={shareCopied}
              onCopyShare={handleCopyShare}
              onClose={onClose}
            />
          )}

          {phase === "error" && (
            <ErrorView
              origin={errorOrigin}
              onRetry={handleRetry}
              onClose={onClose}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes dtm-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes dtm-spin {
          to { transform: rotate(360deg); }
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
  onTipAndDownload,
  onSkipTip,
}: {
  amount: number;
  canTip: boolean;
  emoji: string;
  message: string;
  selectedPreset: number | null;
  customAmount: string;
  onSelectPreset: (p: number) => void;
  onCustomChange: (v: string) => void;
  onTipAndDownload: () => void;
  onSkipTip: () => void;
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
        Before you download…
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
        MakeMyCV is free because of people like you. A small tip covers
        hosting and the AI behind the bullets.
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

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onTipAndDownload}
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
          ? `Tip $${amount} · Download CV`
          : "Pick an amount to continue"}
      </button>

      <p
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        Secure via PayPal. No PayPal account needed — credit card works too.
      </p>

      {/* Secondary CTA — guilt-trip styling on purpose */}
      <button
        type="button"
        onClick={onSkipTip}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: "transparent",
          fontSize: 12.5,
          color: "#94a3b8",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        Download without supporting {"\u{1F614}"}
      </button>
    </>
  );
}

/* ─── Reminder (after user picks "skip") ───────────────────── */

function ReminderView({
  onReconsider,
  onContinueAnyway,
}: {
  onReconsider: () => void;
  onContinueAnyway: () => void;
}) {
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>{"\u{1F494}"}</div>
        <h2
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#0f172a",
            margin: "12px 0 0",
          }}
        >
          Wait — are you sure?
        </h2>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 12,
          background: "#FEF3F2",
          border: "1px solid #FECDCA",
        }}
      >
        <p
          style={{
            fontSize: 13.5,
            color: "#7A271A",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          MakeMyCV is built and run by one person. Every download we generate
          costs real money in hosting and AI tokens. Even $1 — the price of a
          cup of karak — keeps this tool free for the next person who needs it.
        </p>
      </div>

      <button
        type="button"
        onClick={onReconsider}
        className="btn-primary"
        style={{
          marginTop: 18,
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          fontSize: 15,
          fontWeight: 700,
          color: "white",
          cursor: "pointer",
        }}
      >
        Take me back — I&apos;ll help
      </button>

      <button
        type="button"
        onClick={onContinueAnyway}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: "transparent",
          fontSize: 12.5,
          color: "#94a3b8",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        I really can&apos;t right now {"\u{1F622}"}
      </button>
    </>
  );
}

/* ─── Downloading ──────────────────────────────────────────── */

function DownloadingView() {
  return (
    <div style={{ padding: "32px 0 16px", textAlign: "center" }}>
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          margin: "0 auto",
          borderRadius: "50%",
          border: "4px solid #e2e8f0",
          borderTopColor: "#2563eb",
          animation: "dtm-spin 0.9s linear infinite",
        }}
      />
      <p
        className="font-display"
        style={{
          marginTop: 18,
          fontSize: 16,
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        Preparing your PDF…
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: 12.5,
          color: "#64748b",
        }}
      >
        Hang tight — this usually takes a couple of seconds.
      </p>
    </div>
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
          Thank you, {displayName}!
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
          looking for work. Your PDF is on its way to your downloads folder.
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

/* ─── Error ────────────────────────────────────────────────── */

function ErrorView({
  origin,
  onRetry,
  onClose,
}: {
  origin: ErrorOrigin;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>{"⚠️"}</div>
      <h2
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#0f172a",
          margin: "12px 0 0",
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          marginTop: 8,
          fontSize: 13.5,
          color: "#64748b",
          lineHeight: 1.55,
        }}
      >
        We couldn&apos;t generate your PDF.{" "}
        {origin === "tip"
          ? "Your tip went through — but please try the download again."
          : "Please try again."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-primary"
        style={{
          marginTop: 18,
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          border: "none",
          fontSize: 14,
          fontWeight: 700,
          color: "white",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: "transparent",
          fontSize: 12.5,
          color: "#94a3b8",
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  );
}

export default DownloadTipModal;
