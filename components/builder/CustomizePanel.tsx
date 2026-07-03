"use client";

import { useEffect, useState } from "react";
import { useCvStore } from "../../lib/store/cvStore";
import type { CvFontFamily, PhotoShape } from "../../lib/types/cv";

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

// "Font scale" control removed 2026-06: no render path (live template or
// PDF layout) ever read theme.fontScale, so the control silently did
// nothing — worse than not having it. settings.fontScale stays in the
// schema for saved-data compat; re-add the control only once both render
// paths actually consume it.

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
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

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
          Customize
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ff-muted)",
            lineHeight: 1.5,
          }}
        >
          Live preview updates as you tweak. Some options apply only to
          certain templates.
        </div>
      </div>

      <Group label="Accent colour">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {ACCENT_SWATCHES.map((sw) => {
            const active = accentColor.toLowerCase() === sw.hex.toLowerCase();
            return (
              <button
                key={sw.hex}
                type="button"
                title={sw.label}
                aria-label={sw.label}
                onClick={() => setSetting("accentColor", sw.hex)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: sw.hex,
                  border: active
                    ? "2px solid var(--ff-ink)"
                    : "1.5px solid var(--ff-line)",
                  outline: active ? "2px solid white" : "none",
                  outlineOffset: -4,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            );
          })}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginLeft: 4,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--ff-muted)" }}>
              Choose your own colour
            </span>
            <input
              type="color"
              value={accentColor}
              aria-label="Choose your own colour"
              onChange={(e) => setSetting("accentColor", e.target.value)}
              style={{
                width: 36,
                height: 32,
                border: "1px solid var(--ff-line)",
                borderRadius: 6,
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
                width: 84,
                padding: "6px 8px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            />
          </label>
        </div>
      </Group>

      <Group label="Font family">
        <Segmented
          options={FONT_FAMILIES}
          value={settings.fontFamily ?? "sans"}
          onChange={(v) => setSetting("fontFamily", v)}
        />
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
