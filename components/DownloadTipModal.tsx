"use client";

import { useEffect, useState } from "react";
import { SUPPORT_URL } from "../lib/config/support";
import { KofiIcon } from "./KofiIcon";

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
 *   picking ── Ko-fi primary CTA + PayPal secondary link + "Maybe
 *              later" dismiss. No amount picker (Ko-fi handles amount
 *              on its own page). On either tip click: open the external
 *              tab, write `mmcv_tipped_at`, advance to `thanks`.
 *   thanks  ── 🎉 + personalised thank-you, spread-the-word with copy
 *              link, feedback link.
 *
 * Suppression (two layers, both checked by `shouldShowDownloadTip()`):
 *   1. `localStorage.mmcv_tipped_at` — 90-day window after a successful
 *      tip click. Written here, also by TipJar in the ATS flow.
 *      Persists across refreshes.
 *   2. Module-level `dismissedThisSession` — set on any close (X, Esc,
 *      backdrop, "Maybe later", post-tip Close). Survives client
 *      navigation between Builder and Review (same JS execution
 *      context), resets on a true page reload. Mirrors TipJarModal.
 *
 * See DECISION_LOG.md 2026-05-31 for the full path that landed us here.
 */

const KOFI_USERNAME =
  process.env.NEXT_PUBLIC_KOFI_USERNAME || "makemycv_ae";
const PAYPAL_HANDLE =
  process.env.NEXT_PUBLIC_PAYPAL_ME_HANDLE || "Abdullah2431";

const KOFI_URL = `https://ko-fi.com/${KOFI_USERNAME}`;
const PAYPAL_URL = `https://paypal.me/${PAYPAL_HANDLE}`;
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
 * tipped in the last 90 days OR dismissed the modal at any point this
 * session. Parents should call this before scheduling the modal open.
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

export const DownloadTipModal = ({ open, onClose, userName }: Props) => {
  const [phase, setPhase] = useState<Phase>("picking");
  const [shareCopied, setShareCopied] = useState(false);

  // Reset to picking each time the modal opens
  useEffect(() => {
    if (!open) return;
    setPhase("picking");
    setShareCopied(false);
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
  // but a stale open=true should never leak through over a recent tip.
  if (isWithinSuppressionWindow()) return null;

  const handleClose = () => {
    dismissedThisSession = true;
    onClose();
  };

  const markTippedAndAdvance = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* localStorage unavailable — silent fail */
    }
    setPhase("thanks");
  };

  const handleKofi = () => markTippedAndAdvance(KOFI_URL);
  const handlePaypal = () => markTippedAndAdvance(PAYPAL_URL);

  // Native share sheet first (WhatsApp is the default share channel for the
  // UAE audience — audit ENG-18), clipboard as the desktop fallback.
  const handleCopyShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "MakeMyCV — free UAE CV builder",
          url: SHARE_URL,
        });
      } catch {
        /* share sheet dismissed */
      }
      return;
    }
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
              "linear-gradient(90deg, var(--ff-accent) 0%, var(--ff-accent-dark) 50%, var(--ff-accent) 100%)",
          }}
        />

        {/* Close button — always available; this is a non-blocking tip
            jar, never a gate. */}
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
              onKofi={handleKofi}
              onPaypal={handlePaypal}
              onMaybeLater={handleClose}
            />
          )}

          {phase === "thanks" && (
            <ThanksView
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
  onKofi,
  onPaypal,
  onMaybeLater,
}: {
  onKofi: () => void;
  onPaypal: () => void;
  onMaybeLater: () => void;
}) {
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>{"\u{1F64F}"}</div>
        <h2
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#0f172a",
            margin: "14px 0 0",
          }}
        >
          Did MakeMyCV help you?
        </h2>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#475569",
            lineHeight: 1.55,
          }}
        >
          A small tip keeps it free for the next person.
        </p>
      </div>

      {/* Primary CTA — Ko-fi */}
      <button
        type="button"
        onClick={onKofi}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--ff-accent)] px-6 py-4 text-base font-bold text-white transition-colors hover:bg-[var(--ff-accent-dark)] active:bg-[var(--ff-accent-dark)]"
      >
        <KofiIcon size={22} />
        <span>Tip via Ko-fi</span>
      </button>

      {/* Secondary — PayPal */}
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onPaypal}
          className="inline-flex items-center gap-1 text-sm text-slate-600 transition-colors hover:text-slate-900 hover:underline"
        >
          Or tip via PayPal <span aria-hidden="true">{"→"}</span>
        </button>
      </div>

      {/* Reassurance microcopy — identical to TipJar */}
      <p className="mt-5 text-sm leading-relaxed text-slate-500">
        Built by Abdullah, a solo developer in Dubai. Ko-fi accepts cards
        without a PayPal account; tips go directly to him.
      </p>

      {/* Dismiss — small, low-contrast, does NOT write the 90-day flag.
          The module-level session flag still gets set (in handleClose)
          so the user isn't re-prompted within the same session. */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onMaybeLater}
          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
        >
          Maybe later
        </button>
      </div>
    </>
  );
}

/* ─── Thanks (post-tip) ────────────────────────────────────── */

function ThanksView({
  displayName,
  shareCopied,
  onCopyShare,
  onClose,
}: {
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
          Your tip helps keep MakeMyCV free for everyone in the UAE looking for
          work.
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
          {shareCopied ? "Link copied ✓" : "Share with a friend"}
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
