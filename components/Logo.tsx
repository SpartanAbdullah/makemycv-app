import Image from "next/image";
import Link from "next/link";

type Variant = "horizontal" | "stacked" | "white" | "mark";

/** Native SVG aspect ratios (from viewBox). The horizontal variants grew
 *  380→399 when the wordmark was outlined in true Poppins SemiBold (2026-07)
 *  — the real face is wider than the Segoe/Arial fallback it replaced. */
const ASPECT: Record<Variant, { w: number; h: number; src: string }> = {
  horizontal: { w: 399, h: 100, src: "/logos/logo-horizontal.svg" },
  stacked:    { w: 240, h: 190, src: "/logos/logo-stacked.svg" },
  white:      { w: 399, h: 100, src: "/logos/logo-white.svg" },
  mark:       { w: 64,  h: 64,  src: "/logos/logo-mark.svg" },
};

/**
 * Brand mark / wordmark for makemycv.ae. By default wraps in a Link to "/".
 * Pass `href={null}` for a standalone (non-clickable) logo.
 *
 * The `horizontal` variant is a live lockup (2026-08 reskin, mirroring the
 * marketing site's Navbar): the SVG mark tile wrapped in the 3D-glass
 * treatment (`.logo-mark-3d` in globals.css) plus a live-text wordmark in
 * the display face. The old logo-horizontal.svg carried a Poppins-outlined
 * wordmark that clashed with Outfit; live text stays pixel-sharp and
 * on-face. `white`/`stacked`/`mark` still render the SVG handoff files from
 * the May 2026 design pack at `public/logos/`.
 */
export function Logo({
  variant = "horizontal",
  height = 36,
  href = "/",
  className,
}: {
  variant?: Variant;
  /** Rendered height in px. Width scales from the SVG aspect ratio. */
  height?: number;
  /** Anchor target; pass `null` to render without a Link wrapper. */
  href?: string | null;
  className?: string;
}) {
  const { w, h, src } = ASPECT[variant];
  const renderedWidth = Math.round((w / h) * height);

  const img =
    variant === "horizontal" ? (
      // Live lockup: glass mark tile + wordmark. Sized off `height` so every
      // caller (top bar at 32, report header, JD panel) scales as before.
      <span
        className={className}
        style={{ display: "inline-flex", alignItems: "center", gap: Math.round(height * 0.28) }}
      >
        <span className="logo-mark-3d" style={{ flexShrink: 0 }}>
          <Image
            src={ASPECT.mark.src}
            alt="makemycv.ae"
            width={height}
            height={height}
            // SVG; let the browser render directly without optimisation overhead.
            unoptimized
            priority
            style={{ display: "block", width: height, height }}
          />
        </span>
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            // ~20px next to the top bar's 32px tile — the site pairs a 36-40px
            // tile with 19-21px text; keep the same tile:text ratio here.
            fontSize: Math.round(height * 0.62),
            letterSpacing: "-0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "var(--brand-navy)" }}>makemycv</span>
          <span style={{ color: "var(--brand-gold)" }}>.ae</span>
        </span>
      </span>
    ) : (
      <Image
        src={src}
        alt="makemycv.ae"
        width={renderedWidth}
        height={height}
        // SVG; let the browser render directly without optimisation overhead.
        unoptimized
        priority
        style={{ display: "block", width: "auto", height }}
        className={className}
      />
    );

  if (href === null) return img;

  return (
    <Link
      href={href}
      aria-label="makemycv.ae home"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      {img}
    </Link>
  );
}
