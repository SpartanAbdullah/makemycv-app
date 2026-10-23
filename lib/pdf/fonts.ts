/**
 * PDF font registration (2026-10-24, audit F09 / WP-8).
 *
 * Until now every PDF was set in Helvetica while the on-screen preview used
 * Inter / Bricolage Grotesque / Instrument Serif — so "what you see is what
 * you download" was not true: metrics, widths and line breaks differed.
 *
 * @react-pdf's font engine (fontkit) reads TTF/OTF/WOFF, not WOFF2, and does
 * not instance variable fonts, so `public/fonts/pdf/*.ttf` holds static
 * 400/700 instances generated from the SAME variable woff2 files the app
 * already self-hosts (`app/fonts/`). Regenerate with
 * `_cowork/.../make-pdf-fonts.py` (fontTools instancer) if a face changes.
 *
 * Registration is browser-only and lazy: `registerPdfFonts()` runs once,
 * right before the first export, with absolute URLs on the current origin.
 * In Node (scripts/pdf-smoke.tsx) nothing is registered and the layouts fall
 * back to Helvetica, which is also what happens if registration ever throws —
 * a missing font must never block a download.
 */

import { Font } from "@react-pdf/renderer";
import type { CvFontFamily } from "../types/cv";

/** react-pdf family names. These are what `fontFamily:` in CVDocument uses. */
export const PDF_FAMILY: Record<CvFontFamily, string> = {
  sans: "Inter",
  display: "Bricolage Grotesque",
  serif: "Instrument Serif",
};

/** Helvetica pair used until fonts are registered (and in Node). */
const FALLBACK = { regular: "Helvetica", bold: "Helvetica-Bold" } as const;

let registered = false;

/**
 * Register the three CV faces with react-pdf. Idempotent, browser-only.
 * Returns true when the custom faces are available for this render.
 */
export function registerPdfFonts(): boolean {
  if (registered) return true;
  if (typeof window === "undefined") return false;
  try {
    const base = `${window.location.origin}/fonts/pdf`;
    Font.register({
      family: PDF_FAMILY.sans,
      fonts: [
        { src: `${base}/inter-400.ttf`, fontWeight: 400 },
        { src: `${base}/inter-700.ttf`, fontWeight: 700 },
      ],
    });
    Font.register({
      family: PDF_FAMILY.display,
      fonts: [
        { src: `${base}/bricolage-400.ttf`, fontWeight: 400 },
        { src: `${base}/bricolage-700.ttf`, fontWeight: 700 },
      ],
    });
    Font.register({
      family: PDF_FAMILY.serif,
      fonts: [
        { src: `${base}/instrument-serif-400.ttf`, fontWeight: 400 },
        { src: `${base}/instrument-serif-400-italic.ttf`, fontWeight: 400, fontStyle: "italic" },
        // Instrument Serif has no bold cut; react-pdf synthesises nothing, so
        // bold text in the serif setting falls back to the same face.
        { src: `${base}/instrument-serif-400.ttf`, fontWeight: 700 },
      ],
    });
    registered = true;
    return true;
  } catch {
    return false;
  }
}

export type PdfFontPair = { regular: string; bold: string };

/**
 * The family names a layout should use for body and bold text, given the
 * user's font setting and whether registration succeeded.
 */
export function pdfFontPair(
  family: CvFontFamily | undefined,
  useCustom: boolean,
): PdfFontPair {
  if (!useCustom) return FALLBACK;
  const name = PDF_FAMILY[family ?? "sans"];
  // react-pdf picks the weight via fontWeight on the style; one family name
  // serves both. The `bold` entry exists so call sites can stay symmetrical
  // with the Helvetica pair.
  return { regular: name, bold: name };
}

/** True once registerPdfFonts() has succeeded in this session. */
export const pdfFontsReady = () => registered;
