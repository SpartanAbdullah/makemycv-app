"use client";

import { useEffect, useState } from "react";
import { isEuVisitor, readConsent, writeConsent, type ConsentChoice } from "../../lib/consent";
import { notifyClientValues, useClientValue } from "./useClientValue";

/**
 * ConsentBanner (2026-10-24) — shared, byte-identical, between
 * makemycv-app and makemycv-site. Inline styles on purpose so it looks the
 * same under both Tailwind configs.
 *
 * Two voices, one component:
 *   EU/UK/CH  — nothing is collected until they choose. Accept / Decline,
 *               equal weight, no dark pattern, no "by continuing you agree".
 *   elsewhere — analytics is on; the bar says so and offers a one-tap opt-out.
 *
 * Reopened from any "Cookie settings" link via the mmcv:consent-open event.
 */

const OPEN_EVENT = "mmcv:consent-open";
export const openConsentSettings = () => window.dispatchEvent(new Event(OPEN_EVENT));

export const ConsentBanner = () => {
  // "ssr" on the server and first paint (nothing shown), then the real cookie.
  const stored = useClientValue<ConsentChoice | "none" | "ssr">(() => readConsent() ?? "none", "ssr");
  const eu = useClientValue(() => isEuVisitor(), false);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const onOpen = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const open = reopened || stored === "none";
  if (!open) return null;
  const current: ConsentChoice | null = stored === "granted" || stored === "denied" ? stored : null;

  const choose = (c: ConsentChoice) => {
    writeConsent(c);
    notifyClientValues();
    setReopened(false);
  };

  const btn: React.CSSProperties = {
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 999,
    padding: "10px 18px",
    cursor: "pointer",
    minHeight: 44,
  };

  return (
    <div
      // A region, not a dialog: it is non-modal, nothing waits on it, and
      // the builder's real dialogs (export gate) must stay the only ones.
      role="region"
      aria-live="polite"
      aria-label="Cookie settings"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        maxWidth: 640,
        margin: "0 auto",
        padding: "14px 16px",
        borderRadius: 16,
        background: "#FFFFFF",
        color: "#0B0F0C",
        boxShadow: "0 12px 40px rgba(11, 15, 12, 0.18)",
        border: "1px solid rgba(11, 15, 12, 0.08)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <p style={{ margin: 0, flex: "1 1 320px" }}>
        {eu
          ? "Can we use Google Analytics cookies to see which pages help people? Nothing is collected until you say yes. "
          : "We use Google Analytics cookies to see which pages help people. No ads, no cross-site tracking. "}
        {current && <span style={{ color: "#6B7368" }}>Currently: analytics {current}. </span>}
        <a href="https://www.makemycv.ae/privacy" style={{ color: "#0E7C4A", fontWeight: 600 }}>
          Privacy policy
        </a>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => choose("granted")} style={{ ...btn, background: "#0E7C4A", color: "#fff", border: "1px solid #0E7C4A" }}>
          {eu ? "Accept" : "OK"}
        </button>
        <button type="button" onClick={() => choose("denied")} style={{ ...btn, background: "transparent", color: "#0B0F0C", border: "1px solid rgba(11, 15, 12, 0.2)" }}>
          {eu ? "Decline" : "Opt out"}
        </button>
      </div>
    </div>
  );
};
