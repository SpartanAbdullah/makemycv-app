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
 * Brand mark / wordmark for makemycv.ae. Renders the SVG handoff from the
 * May 2026 design pack at `public/logos/`. By default wraps in a Link to "/".
 * Pass `href={null}` for a standalone (non-clickable) logo.
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

  const img = (
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
