/**
 * Colour intelligence for template theming.
 *
 * A user can pick ANY accent colour (preset swatch or the free colour picker).
 * Without guardrails a light pick paints white-on-pale sidebars and vanishing
 * headings — customization making the CV worse. These WCAG-aware helpers derive
 * readable colours from any accent so the output is always legible:
 *
 *  - onColor(bg)          → the readable ink (near-white or near-black) for text
 *                           placed ON `bg` (used for sidebar text on the accent
 *                           band, filled badges, etc.).
 *  - ensureReadableOn(c)  → darkens `c` until it meets a contrast floor on white,
 *                           so accent-coloured TEXT/borders on a white page stay
 *                           readable even when the user picked a pale colour.
 *  - mix / softTint       → blends for muted-on-band text and soft surfaces.
 *
 * Pure functions, no deps — safe in both the HTML templates and react-pdf.
 */

export type RGB = { r: number; g: number; b: number };

const INK = "#1F2937"; // near-black default foreground
const PAPER = "#FFFFFF";

export function hexToRgb(hex: string): RGB | null {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** WCAG relative luminance (sRGB, 0–1). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** The more-readable foreground ink for text placed ON `bg`. */
export function onColor(bg: string, dark: string = INK, light: string = PAPER): string {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

/** Linear blend of `hex` toward `other` by t (0..1 = amount of `other`). */
export function mix(hex: string, other: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  if (!a || !b) return hex;
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/** Multiply RGB toward black by `factor` (0..1). */
function darkenBy(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({ r: rgb.r * factor, g: rgb.g * factor, b: rgb.b * factor });
}

/**
 * Returns `color` if it already meets `minRatio` contrast on `bg` (default
 * white); otherwise progressively darkens it until it does. Guarantees
 * accent-as-text stays readable regardless of what the user picked.
 */
export function ensureReadableOn(
  color: string,
  bg: string = PAPER,
  minRatio = 4.5,
): string {
  if (!hexToRgb(color)) return color;
  if (contrastRatio(color, bg) >= minRatio) return color;
  let out = color;
  for (let i = 0; i < 16; i++) {
    out = darkenBy(out, 0.85);
    if (contrastRatio(out, bg) >= minRatio) return out;
  }
  return out;
}

/** A pale tint of `hex` (mixed toward white) for soft backgrounds/chips. */
export function softTint(hex: string, t = 0.88): string {
  return mix(hex, PAPER, t);
}

/** True when `hex` is light enough that white text on it would be unreadable. */
export function isLight(hex: string): boolean {
  return contrastRatio(hex, PAPER) < 3;
}
