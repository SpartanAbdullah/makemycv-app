"use client";

import { openConsentSettings } from "./ConsentBanner";

/**
 * "Cookie settings" — reopens the consent bar so a choice can be changed.
 * Shared, byte-identical, between makemycv-app and makemycv-site. A button
 * styled as a link: it changes state, it does not navigate.
 */
export const CookieSettingsLink = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <button
    type="button"
    onClick={openConsentSettings}
    className={className}
    style={{
      background: "none",
      border: "none",
      padding: 0,
      font: "inherit",
      color: "inherit",
      textDecoration: "underline",
      textUnderlineOffset: 3,
      cursor: "pointer",
      ...style,
    }}
  >
    Cookie settings
  </button>
);
