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

/**
 * The Arabic face (session 4, 2026-10-31): Vazirmatn 33.003, SIL OFL 1.1,
 * static 400 / 700 instances of google/fonts `ofl/vazirmatn/Vazirmatn[wght].ttf`
 * (licence text beside the files). Chosen over Noto Sans / Naskh Arabic,
 * IBM Plex Sans Arabic and Amiri because it is the sans face whose glyphs
 * map 1:1 to presentation-form code points under fontkit — the property
 * react-pdf's textkit needs (see lib/pdf/arabicText.ts) — with full Arabic,
 * Persian and Urdu coverage and a Latin that sits next to Inter. It is only
 * loaded by react-pdf when a <Text> actually uses it, so Latin-only CVs
 * embed nothing extra. Mirrored for the preview by the `Vazirmatn CV`
 * @font-face in app/globals.css (unicode-range limited to Arabic).
 */
export const PDF_ARABIC_FAMILY = "Vazirmatn";

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
  return registerFrom(`${window.location.origin}/fonts/pdf`);
}

/**
 * Node-side twin for scripts (scripts/pdf-smoke.tsx): the same three faces
 * from a local directory of TTFs, so a script render embeds the real metrics
 * instead of Helvetica. Never called from browser code.
 */
export function registerPdfFontsFromDir(dir: string): boolean {
  if (registered) return true;
  return registerFrom(dir.replace(/[\\/]+$/, ""));
}

function registerFrom(base: string): boolean {
  try {
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
    Font.register({
      family: PDF_ARABIC_FAMILY,
      fonts: [
        { src: `${base}/vazirmatn-400.ttf`, fontWeight: 400 },
        { src: `${base}/vazirmatn-700.ttf`, fontWeight: 700 },
        // Arabic has no italic; an italic run (the serif setting's summary)
        // that contains Arabic resolves to the upright cut instead of throwing.
        { src: `${base}/vazirmatn-400.ttf`, fontWeight: 400, fontStyle: "italic" },
        { src: `${base}/vazirmatn-700.ttf`, fontWeight: 700, fontStyle: "italic" },
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

/**
 * The family an Arabic-bearing <Text> must use, or null when the custom
 * faces are not registered (Helvetica cannot encode Arabic at all — the
 * wrapper in components/pdf/ArabicText.tsx then leaves the text alone).
 */
export const pdfArabicFamily = (): string | null =>
  registered ? PDF_ARABIC_FAMILY : null;

/* ── Glyph-cache warm-up ──────────────────────────────────────────────────
 * fontkit caches one Glyph object per glyph id with the code points the FIRST
 * creation passed. pdfkit's subsetter resolves composite components with
 * `font.getGlyph(id)` — no code points — so after a document that embeds ض
 * (a composite over the ص glyph) the ص glyph is cached with [] for the rest
 * of the process, and textkit's string→glyph index map (which counts each
 * glyph's code points) drifts on every later line that uses ص: glyphs vanish
 * or the layout throws "Cannot read properties of undefined (reading 'id')".
 * The same state carries across two downloads in one browser session. Laying
 * out every code point the face maps, once, right after it loads, creates
 * every cmap glyph with its code points before any subset can. Arabic is the
 * script where composites over letter glyphs are the norm; the Latin faces
 * get the same pass for the same reason (é over e).
 * (session 4, 2026-10-31 — `_cowork/pdf-fidelity-s4-scratch/` probes.) */

const codePointRange = (from: number, to: number): string => {
  let s = "";
  for (let c = from; c <= to; c += 1) s += String.fromCodePoint(c);
  return s;
};
const WARM_LATIN =
  codePointRange(0x0020, 0x007e) + codePointRange(0x00a0, 0x024f) + codePointRange(0x2010, 0x2027) + "€™•";
const WARM_ARABIC =
  WARM_LATIN +
  codePointRange(0x0600, 0x06ff) +
  codePointRange(0x0750, 0x077f) +
  codePointRange(0x08a0, 0x08ff) +
  codePointRange(0xfb50, 0xfdff) +
  codePointRange(0xfe70, 0xfeff);

type FontkitLike = {
  hasGlyphForCodePoint?: (cp: number) => boolean;
  layout?: (s: string, f?: unknown, sc?: unknown, l?: unknown, d?: string) => unknown;
};

async function warmFace(fontFamily: string, fontWeight: number, text: string): Promise<void> {
  const descriptor = { fontFamily, fontWeight, fontStyle: "normal" as const };
  await Font.load(descriptor);
  const data = (Font.getFont(descriptor) as { data?: FontkitLike } | undefined)?.data;
  if (!data?.layout || !data.hasGlyphForCodePoint) return;
  const covered = Array.from(text)
    .filter((ch) => data.hasGlyphForCodePoint!(ch.codePointAt(0) as number))
    .join("");
  data.layout(covered, undefined, undefined, undefined, "ltr");
}

let warmedLatin = false;
let warmedArabic = false;

/**
 * Load the faces a render will use and pre-create their glyphs (see above).
 * Idempotent; `arabic` adds the Arabic face, which is only fetched when a CV
 * actually contains Arabic. Never throws — a failed warm-up is the status
 * quo, not a blocked download.
 */
export async function warmPdfFonts(arabic: boolean): Promise<void> {
  if (!registered) return;
  try {
    if (!warmedLatin) {
      for (const family of Object.values(PDF_FAMILY)) {
        await warmFace(family, 400, WARM_LATIN);
        await warmFace(family, 700, WARM_LATIN);
      }
      warmedLatin = true;
    }
    if (arabic && !warmedArabic) {
      await warmFace(PDF_ARABIC_FAMILY, 400, WARM_ARABIC);
      await warmFace(PDF_ARABIC_FAMILY, 700, WARM_ARABIC);
      warmedArabic = true;
    }
  } catch {
    // leave the flags unset so the next call tries again
  }
}
