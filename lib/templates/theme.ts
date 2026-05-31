import type { CvFontFamily, CvSettings } from "../types/cv";

/**
 * Resolved theme values derived from CvSettings — keeps the per-template
 * plumbing thin and consistent.
 */
export type CvTheme = {
  accent: string;
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
  return {
    accent: settings.accentColor?.trim() || fallbackAccent,
    fontFamily: FONT_FAMILY_MAP[settings.fontFamily ?? "sans"],
    fontScale: settings.fontScale ?? 1,
    photoVisible: settings.photoShape !== "hidden",
  };
}
