"use client";

import { useEffect, useState } from "react";
import { useCvStore } from "../../lib/store/cvStore";
import type { CvFontFamily, PhotoShape } from "../../lib/types/cv";
import { onColor } from "../../lib/utils/color";
import { Icon } from "./Icon";

// Curated, professional accent palette. Ordered blues → greens → warm → neutral.
// Every colour renders readably because the templates derive contrast-safe text
// from the accent (lib/utils/color.ts) — so even the lighter "Sand" is safe.
const ACCENT_SWATCHES: { label: string; hex: string }[] = [
  { label: "Midnight", hex: "#1E2A4A" },
  { label: "Royal", hex: "#1E40AF" },
  { label: "Slate", hex: "#334155" },
  { label: "Teal", hex: "#0F766E" },
  { label: "Emerald", hex: "#047857" },
  { label: "Forest", hex: "#14532D" },
  { label: "Burgundy", hex: "#7A1F2B" },
  { label: "Plum", hex: "#6B21A8" },
  { label: "Bronze", hex: "#92400E" },
  { label: "Graphite", hex: "#33373D" },
  { label: "Sand", hex: "#C9A96A" },
];

// Font-size / line-height / section-spacing sliders are the next pass — they
// need every template (preview + PDF) to consume the scale before the control
// can go live, so they are intentionally NOT shown here yet (no dead sliders).
// Page Margins is wired (theme.marginScale → content padding).

const FONT_FAMILIES: { label: string; value: CvFontFamily; sample: string }[] = [
  { label: "Sans", value: "sans", sample: "Inter" },
  { label: "Display", value: "display", sample: "Bricolage" },
  { label: "Serif", value: "serif", sample: "Instrument" },
];

const PHOTO_SHAPES: { label: string; value: PhotoShape }[] = [
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
  { label: "Hidden", value: "hidden" },
];

const SLIDER_GREEN = "var(--ff-accent)";
const SLIDER_TRACK = "#2B3648";
const SLIDER_TICK = "#94A3B8";

const Group = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        color: "var(--ff-muted)",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

const Divider = () => (
  <div style={{ borderTop: "1px solid var(--ff-line)" }} />
);

// − / + end buttons for the stepped slider.
const StepButton = ({
  glyph,
  onClick,
  disabled,
  ariaLabel,
}: {
  glyph: string;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}) => (
  <button
    type="button"
    className="ff-hit-target"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: 8,
      border: "1px solid var(--ff-line)",
      background: "var(--ff-paper)",
      color: "var(--ff-ink-2)",
      fontSize: 16,
      lineHeight: 1,
      display: "grid",
      placeItems: "center",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
      padding: 0,
    }}
  >
    {glyph}
  </button>
);

/**
 * Discrete slider (min..max integer steps) styled like the reference: a dark
 * track with tick notches, a green capsule thumb, and −/＋ ends. Values are
 * discrete so there's no drag state — click a position, use the ends, or
 * arrow-key. Rendered at module level so react-compiler is happy.
 */
const StepSlider = ({
  value,
  min,
  max,
  onChange,
  leftLabel,
  rightLabel,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  ariaLabel: string;
}) => {
  const steps = max - min;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const pct = ((clamp(value) - min) / steps) * 100;
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--ff-muted)",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StepButton
          glyph="−"
          ariaLabel="Decrease"
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={clamp(value)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const rel = Math.min(
              1,
              Math.max(0, (e.clientX - rect.left) / rect.width),
            );
            onChange(clamp(Math.round(rel * steps) + min));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(clamp(value - 1));
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(clamp(value + 1));
            }
          }}
          style={{
            position: "relative",
            flex: 1,
            height: 36,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 4,
              marginTop: -2,
              borderRadius: 2,
              background: SLIDER_TRACK,
            }}
          />
          {Array.from({ length: steps + 1 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i / steps) * 100}%`,
                top: "50%",
                width: 2,
                height: 10,
                marginTop: -5,
                marginLeft: -1,
                borderRadius: 1,
                background: SLIDER_TICK,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              left: `${pct}%`,
              top: "50%",
              width: 12,
              height: 22,
              marginTop: -11,
              marginLeft: -6,
              borderRadius: 6,
              background: SLIDER_GREEN,
              border: "2px solid #fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          />
        </div>
        <StepButton
          glyph="+"
          ariaLabel="Increase"
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <span style={labelStyle}>{leftLabel}</span>
        <span style={labelStyle}>{rightLabel}</span>
      </div>
    </div>
  );
};

const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; sample?: string }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <div
    style={{
      display: "inline-flex",
      background: "var(--ff-paper)",
      border: "1px solid var(--ff-line)",
      borderRadius: 10,
      padding: 3,
      gap: 2,
    }}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: active ? 600 : 500,
            padding: "5px 12px",
            borderRadius: 7,
            border: "none",
            background: active ? "var(--ff-ink)" : "transparent",
            color: active ? "white" : "var(--ff-ink-2)",
            cursor: "pointer",
            transition: "background 120ms",
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

export const CustomizePanel = () => {
  const data = useCvStore((s) => s.data);
  const updateSection = useCvStore((s) => s.updateSection);
  const settings = data.settings;

  const setSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K],
  ) => {
    updateSection("settings", { ...settings, [key]: value });
  };

  const accentColor = settings.accentColor ?? "#1e5b54";
  const isCustomColor = !ACCENT_SWATCHES.some(
    (sw) => sw.hex.toLowerCase() === accentColor.toLowerCase(),
  );
  const pageMargins = settings.pageMargins ?? 3;
  const fontSize = settings.fontSize ?? 3;
  const lineHeight = settings.lineHeight ?? 3;
  const sectionSpacing = settings.sectionSpacing ?? 3;

  // Custom-colour drawer, revealed by the "Use custom colour" link. Opens by
  // default when the saved accent isn't one of the presets so it stays visible.
  const [showCustom, setShowCustom] = useState(isCustomColor);

  // Typeable hex field — local draft so the user can type freely; committed
  // on blur/Enter. Invalid input quietly reverts to the current accent.
  const [hexDraft, setHexDraft] = useState(accentColor);
  useEffect(() => {
    setHexDraft(accentColor);
  }, [accentColor]);

  const commitHexDraft = () => {
    const match = hexDraft.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (match) {
      const normalized = `#${match[1].toLowerCase()}`;
      setHexDraft(normalized);
      setSetting("accentColor", normalized);
    } else {
      setHexDraft(accentColor);
    }
  };

  return (
    <div
      style={{
        background: "var(--ff-card)",
        border: "1px solid var(--ff-line)",
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--ff-ink)",
            marginBottom: 2,
          }}
        >
          Design &amp; Font
        </div>
        <div style={{ fontSize: 12, color: "var(--ff-muted)", lineHeight: 1.5 }}>
          Live preview updates as you tweak.
        </div>
      </div>

      <Group label={`Page margins: ${pageMargins}`}>
        <StepSlider
          value={pageMargins}
          min={1}
          max={5}
          onChange={(v) => setSetting("pageMargins", v)}
          leftLabel="narrow"
          rightLabel="wide"
          ariaLabel="Page margins"
        />
      </Group>

      <Group label={`Font size: ${fontSize}`}>
        <StepSlider
          value={fontSize}
          min={1}
          max={5}
          onChange={(v) => setSetting("fontSize", v)}
          leftLabel="smaller"
          rightLabel="larger"
          ariaLabel="Font size"
        />
      </Group>

      <Group label={`Line height: ${lineHeight}`}>
        <StepSlider
          value={lineHeight}
          min={1}
          max={5}
          onChange={(v) => setSetting("lineHeight", v)}
          leftLabel="tight"
          rightLabel="loose"
          ariaLabel="Line height"
        />
      </Group>

      <Group label={`Section spacing: ${sectionSpacing}`}>
        <StepSlider
          value={sectionSpacing}
          min={1}
          max={5}
          onChange={(v) => setSetting("sectionSpacing", v)}
          leftLabel="compact"
          rightLabel="airy"
          ariaLabel="Section spacing"
        />
      </Group>

      <Divider />

      <Group label="Colours">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          {ACCENT_SWATCHES.map((sw) => {
            const active =
              accentColor.toLowerCase() === sw.hex.toLowerCase();
            return (
              <button
                key={sw.hex}
                type="button"
                title={sw.label}
                aria-label={sw.label}
                aria-pressed={active}
                onClick={() => setSetting("accentColor", sw.hex)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  padding: 3,
                  background: "var(--ff-ink)",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <span
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: sw.hex,
                    display: "grid",
                    placeItems: "center",
                    color: onColor(sw.hex),
                  }}
                >
                  {active && <Icon name="check" size={16} />}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            marginTop: 14,
            color: "var(--ff-accent)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showCustom ? "Hide custom colour" : "Use custom colour"}
        </button>

        {showCustom && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
            }}
          >
            <input
              type="color"
              value={accentColor}
              aria-label="Choose your own colour"
              onChange={(e) => setSetting("accentColor", e.target.value)}
              style={{
                width: 40,
                height: 34,
                border: "1px solid var(--ff-line)",
                borderRadius: 10,
                background: "transparent",
                cursor: "pointer",
                padding: 0,
              }}
            />
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHexDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitHexDraft();
                }
              }}
              aria-label="Accent colour hex code"
              spellCheck={false}
              maxLength={7}
              className="cv-input"
              style={{
                width: 96,
                height: 34,
                padding: "7px 8px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                borderRadius: 10,
              }}
            />
          </div>
        )}
      </Group>

      <Divider />

      <Group label="Font style">
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            maxWidth: 240,
          }}
        >
          <select
            value={settings.fontFamily ?? "sans"}
            onChange={(e) =>
              setSetting("fontFamily", e.target.value as CvFontFamily)
            }
            aria-label="Font style"
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              width: "100%",
              border: "1px solid var(--ff-line)",
              borderRadius: 10,
              background: "var(--ff-paper)",
              padding: "9px 34px 9px 12px",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ff-ink)",
              cursor: "pointer",
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.sample}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 12,
              pointerEvents: "none",
              color: "var(--ff-muted)",
              display: "inline-flex",
            }}
          >
            <Icon name="chevron-down" size={14} />
          </span>
        </div>
      </Group>

      <Group label="Photo">
        <Segmented
          options={PHOTO_SHAPES}
          value={settings.photoShape ?? "round"}
          onChange={(v) => setSetting("photoShape", v)}
        />
      </Group>
    </div>
  );
};
