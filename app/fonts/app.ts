import localFont from "next/font/local";

/**
 * App-wide faces, all self-hosted (2026-08 premium reskin — matches the
 * marketing site's `app/fonts/site.ts`):
 *
 *   Outfit           — the single UI face (body + display) since the reskin
 *   Inter            — CV template face "sans"     (via --cv-font-body)
 *   Bricolage Grot.  — CV template face "display"  (via --cv-font-display)
 *   Instrument Serif — CV template face "serif"    (via --cv-font-serif)
 *   JetBrains Mono   — numeric readouts / counters only (labels retired)
 *
 * The three CV faces are loaded ONLY for the user's on-screen CV preview —
 * the UI never renders them. They are decoupled from the UI tokens via the
 * `--cv-font-*` variables in globals.css so restyling the UI can never
 * silently restyle a user's CV. Do not "simplify" the two layers back
 * together.
 *
 * ── Why self-hosted instead of next/font/google ────────────────────────────
 * `next/font/google` downloads from fonts.gstatic.com AT BUILD TIME and bakes
 * the resolved URLs into the build cache. Google rotates those hashed URLs,
 * so a cached build can request a file that no longer exists. Exactly that
 * broke a site deploy on 2026-08-11 (see ../../..-site/app/fonts/site.ts for
 * the full write-up). Self-hosting makes the build hermetic: no network
 * fetch, so that whole class of failure is off the deploy path.
 *
 * ── Variable vs static ─────────────────────────────────────────────────────
 * Outfit/Inter/Bricolage/JetBrains ship as VARIABLE fonts — one latin-subset
 * woff2 covers the whole weight range. Instrument Serif only exists at 400,
 * so it ships as two static files (normal + italic).
 *
 * `adjustFontFallback: "Arial"` reproduces the metric-adjusted fallback face
 * that next/font/google generated automatically, which is what holds CLS
 * down while the real face loads. The serif and mono faces opt out — Arial's
 * metrics are wrong for them — and use explicit stacks instead.
 *
 * To refresh a file: pull the latin-subset woff2 from the Google Fonts CSS2
 * API with a browser User-Agent (a non-browser UA returns ttf, not woff2).
 */

export const outfit = localFont({
  src: "./outfit-variable.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-outfit",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const inter = localFont({
  src: "./inter-variable.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const bricolage = localFont({
  src: "./bricolage-grotesque-variable.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-bricolage",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const instrumentSerif = localFont({
  src: [
    { path: "./instrument-serif.woff2", weight: "400", style: "normal" },
    { path: "./instrument-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const jetbrainsMono = localFont({
  src: "./jetbrains-mono-variable.woff2",
  weight: "500 600",
  style: "normal",
  variable: "--font-jetbrains",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
