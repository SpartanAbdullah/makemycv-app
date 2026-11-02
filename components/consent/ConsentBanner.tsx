"use client";

import { useEffect, useState } from "react";
import { CONSENT_COOKIE, GEO_COOKIE, isEuVisitor, readConsent, writeConsent, type ConsentChoice } from "../../lib/consent";
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
 *
 * Painted with the server HTML (2026-11-02). It used to render nothing until
 * hydration, then appear, and Lighthouse took that late paint as the page's
 * Largest Contentful Paint on mobile. Now the server always sends the bar, and
 * PREPAINT (an inline script parsed just before it) hides it for visitors who
 * already chose, and swaps in the EU wording, before the first paint. Both
 * wordings stay in the DOM in every render, so hydration only flips their
 * `display` and never repaints the text as a new, later element.
 */

const OPEN_EVENT = "mmcv:consent-open";
export const openConsentSettings = () => window.dispatchEvent(new Event(OPEN_EVENT));

const SSR_ID = "mmcv-consent-ssr";

// ES5, dependency-free, runs while the HTML is parsed. React 19 tolerates the
// <style> it adds to <head> during hydration.
const PREPAINT = `(function(){try{
  var c=document.cookie,css='';
  if(/(?:^|; )${CONSENT_COOKIE}=(granted|denied)/.test(c))css+='#${SSR_ID}{display:none!important}';
  if(/(?:^|; )${GEO_COOKIE}=eu(?:;|$)/.test(c))css+='#${SSR_ID} .mmcv-row{display:none!important}#${SSR_ID} .mmcv-eu{display:inline!important}';
  if(css){var s=document.createElement('style');s.textContent=css;document.head.appendChild(s);}
}catch(e){}})();`;

export const ConsentBanner = () => {
  // "ssr" on the server and the hydration render, then the real cookie.
  const stored = useClientValue<ConsentChoice | "none" | "ssr">(() => readConsent() ?? "none", "ssr");
  const eu = useClientValue(() => isEuVisitor(), false);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const onOpen = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const hydrated = stored !== "ssr";
  if (hydrated && !reopened && stored !== "none") return null;
  const current: ConsentChoice | null = stored === "granted" || stored === "denied" ? stored : null;

  const choose = (c: ConsentChoice) => {
    writeConsent(c);
    notifyClientValues();
    setReopened(false);
  };

  // Before hydration the server wording is the non-EU one; PREPAINT swaps it
  // for EU visitors. After hydration `eu` decides.
  const show = (forEu: boolean): React.CSSProperties => ({ display: (hydrated ? eu : false) === forEu ? "inline" : "none" });
  const row = { className: "mmcv-row", style: show(false) };
  const euOnly = { className: "mmcv-eu", style: show(true) };

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
    <>
      {!hydrated && <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />}
      <div
        id={hydrated ? undefined : SSR_ID}
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
          <span {...euOnly}>
            Can we use Google Analytics cookies to see which pages help people? Nothing is collected until you say yes.{" "}
          </span>
          <span {...row}>
            We use Google Analytics cookies to see which pages help people. No ads, no cross-site tracking.{" "}
          </span>
          {current && <span style={{ color: "#6B7368" }}>Currently: analytics {current}. </span>}
          <a href="https://www.makemycv.ae/privacy" style={{ color: "#0E7C4A", fontWeight: 600 }}>
            Privacy policy
          </a>
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => choose("granted")} style={{ ...btn, background: "#0E7C4A", color: "#fff", border: "1px solid #0E7C4A" }}>
            <span {...euOnly}>Accept</span>
            <span {...row}>OK</span>
          </button>
          <button type="button" onClick={() => choose("denied")} style={{ ...btn, background: "transparent", color: "#0B0F0C", border: "1px solid rgba(11, 15, 12, 0.2)" }}>
            <span {...euOnly}>Decline</span>
            <span {...row}>Opt out</span>
          </button>
        </div>
      </div>
    </>
  );
};
