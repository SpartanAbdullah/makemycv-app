"use client";

import { useEffect } from "react";

/**
 * Pro unlock price (USD). One-time payment, never a subscription, not
 * per-download. Update this single constant when the final figure is set.
 * Keep formatting (`$X`) consistent with the surrounding copy.
 */
export const PRO_PRICE_USD = 5;

type Props = {
  open: boolean;
  onClose: () => void;
};

export const UpgradeModal = ({ open, onClose }: Props) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          width: "100%",
          maxWidth: 420,
          padding: "32px 28px",
          margin: "0 16px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94A3B8",
            padding: 4,
          }}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg, #4F46E5, #6366F1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>

        {/* Heading */}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Unlock MakeMyCV Pro
        </h2>
        <p style={{ fontSize: 14, color: "#64748B", marginTop: 6, marginBottom: 20 }}>
          Get your professional CV without limits
        </p>

        {/* Benefits */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <BenefitRow text="Clean PDF downloads — no watermark" />
          <BenefitRow text="All 6 professional templates" />
          <BenefitRow text="ATS-optimised formats included" />
          <BenefitRow text="Unlimited edits and re-downloads" />
        </div>

        {/* Pricing — one-time unlock, never per-download, never recurring. */}
        <div style={{
          textAlign: "center",
          padding: "16px 0",
          borderTop: "1px solid #E2E8F0",
          borderBottom: "1px solid #E2E8F0",
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", margin: 0 }}>
            ${PRO_PRICE_USD}{" "}
            <span style={{ fontSize: 14, fontWeight: 500, color: "#64748B" }}>
              one-time
            </span>
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            Pay once, unlock Pro forever. No subscription, no per-download fees.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          disabled
          style={{
            width: "100%",
            padding: "14px 24px",
            background: "#4F46E5",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
          }}
        >
          Unlock Pro — Coming Soon
        </button>

        {/* Secondary link */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: "#64748B",
            marginTop: 8,
          }}
        >
          Continue with Free Plan
        </button>
      </div>
    </div>
  );
};

const BenefitRow = ({ text }: { text: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#EEF2FF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M2.5 7L5.5 10L11.5 4" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <span style={{ fontSize: 14, color: "#334155" }}>{text}</span>
  </div>
);
