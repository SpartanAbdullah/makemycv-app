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
  fontScale: number;
  photoVisible: boolean;
};

const DEFAULT_ACCENT = "#1e5b54";

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
    fontScale: settings.fontScale ?? 1,
    photoVisible: settings.photoShape !== "hidden",
  };
}
