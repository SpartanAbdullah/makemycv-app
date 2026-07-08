"use client";

import { Icon, type IconName } from "../builder/Icon";

/* ─── Mobile segmented view toggle (shared) ─────────────────────────────
 *
 * ONE presentation for the "switch mobile views" control — the floating
 * dark pill fixed at the bottom of the viewport (thumb zone, reachable
 * while scrolling either view). Used by the builder (Edit | Preview) and
 * JD Match (Fix gaps | Your CV); before extraction the two surfaces
 * rendered the same semantic control in two unrelated styles (audit
 * cross-surface follow-up).
 *
 * Touch floor: 12px vertical segment padding keeps each segment ≥44px
 * tall — this is THE primary mobile control (audit UI-5).
 *
 * CRITICAL — visibility lives on `className`, never inline: the builder
 * hides this at the desktop breakpoint via `inline-flex xl:hidden`, and an
 * inline `display` would silently override Tailwind's media-queried rule
 * (inline styles beat non-!important utilities). Callers that gate with
 * JS instead (JD Match's isDesktop check) just use the default class. */
export const SegmentedViewToggle = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "inline-flex",
}: {
  options: ReadonlyArray<{ value: T; label: string; icon: IconName }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
}) => (
  <div
    className={className}
    role="tablist"
    aria-label={ariaLabel}
    style={{
      position: "fixed",
      left: "50%",
      bottom: 20,
      transform: "translateX(-50%)",
      zIndex: 50,
      padding: 4,
      background: "var(--ff-ink)",
      borderRadius: 999,
      boxShadow: "0 14px 30px rgba(11,15,12,0.30)",
      gap: 2,
    }}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            padding: "12px 18px",
            borderRadius: 999,
            border: "none",
            background: active ? "white" : "transparent",
            color: active ? "var(--ff-ink)" : "rgba(255,255,255,0.78)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "background 120ms, color 120ms",
          }}
        >
          <Icon name={opt.icon} size={13} />
          {opt.label}
        </button>
      );
    })}
  </div>
);
