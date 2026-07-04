import type { CvFontFamily, CvSettings } from "../types/cv";
import { onColor, ensureReadableOn, mix, softTint } from "../utils/color";

/**
 * Resolved theme values derived from CvSettings. Beyond the raw accent this now
 * exposes CONTRAST-SAFE derivatives so any accent the user picks renders
 * readably (see lib/utils/color.ts):
 *
 *  - accent        raw accent — use as a fill/band background.
 *  - accentText    accent made readable AS TEXT on a white page (auto-darkened
 *                  if the pick was pale) — use for headings, company names,
 *                  links, dividers on white.
 *  - onAccent      readable ink (white/near-black) for text ON the accent band.
 *  - onAccentMuted muted secondary text on the accent band.
 *  - accentSoft    pale tint of the accent for soft surfaces/chips.
 */
export type CvTheme = {
  accent: string;
  accentText: string;
  onAccent: string;
  onAccentMuted: string;
  accentSoft: string;
  fontFamily: string;
  /** Density multipliers, each from a 1–5 "level" control (level 3 = 1.0 = the
   *  current design, so existing CVs render byte-identically). Multiply the
   *  matching template literals by these:
   *   - fontScale   every font-size
   *   - lineScale   every line-height
   *   - spaceScale  the vertical gap BETWEEN sections
   *   - marginScale content/page margins (single-col page padding, two-col main
   *                 column padding — NOT the sidebar, whose edge-bleed is fixed)
   *  Level 3 maps to exactly 1.0 via lookup arrays (no float drift), so the
   *  neutral default never shifts a saved CV. */
  fontScale: number;
  lineScale: number;
  spaceScale: number;
  marginScale: number;
  photoVisible: boolean;
};

const DEFAULT_ACCENT = "#1e5b54";

// 1–5 level → multiplier. Index 2 (level 3) is EXACTLY 1.0 so the neutral
// default is float-drift-free and renders identical to the pre-slider design.
const FONT_SCALES = [0.9, 0.95, 1, 1.05, 1.1];
const LINE_SCALES = [0.9, 0.95, 1, 1.05, 1.1];
const SPACE_SCALES = [0.7, 0.85, 1, 1.15, 1.3];
const MARGIN_SCALES = [0.7, 0.85, 1, 1.15, 1.3];

const scaleFor = (arr: number[], level: number | undefined): number =>
  arr[Math.min(5, Math.max(1, Math.round(level ?? 3))) - 1];

const FONT_FAMILY_MAP: Record<CvFontFamily, string> = {
  sans: "var(--font-body)",
  display: "var(--font-display)",
  serif: "var(--font-serif)",
};

export function resolveTheme(
  settings: CvSettings,
  fallbackAccent: string = DEFAULT_ACCENT,
): CvTheme {
  const accent = settings.accentColor?.trim() || fallbackAccent;
  const onAccent = onColor(accent);
  // Muted-on-band: blend the readable ink ~35% toward the band colour — a
  // softened secondary that stays legible on both dark and light accents.
  const onAccentMuted = mix(onAccent, accent, 0.35);
  return {
    accent,
    accentText: ensureReadableOn(accent, "#ffffff", 4.5),
    onAccent,
    onAccentMuted,
    accentSoft: softTint(accent, 0.9),
    fontFamily: FONT_FAMILY_MAP[settings.fontFamily ?? "sans"],
    fontScale: scaleFor(FONT_SCALES, settings.fontSize),
    lineScale: scaleFor(LINE_SCALES, settings.lineHeight),
    spaceScale: scaleFor(SPACE_SCALES, settings.sectionSpacing),
    marginScale: scaleFor(MARGIN_SCALES, settings.pageMargins),
    photoVisible: settings.photoShape !== "hidden",
  };
}
