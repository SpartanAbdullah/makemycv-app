import Image from "next/image";

/**
 * KofiIcon — inline Ko-fi cup mark.
 *
 * Source asset: `/kofi_brandasset/kofi_symbol.svg` (viewBox 241 × 194,
 * Ko-fi orange + dark). Default size 20px matches button text height.
 * Rendered via next/image so the SVG is optimised in production and
 * served with intrinsic dimensions — no SSR-only hooks involved.
 *
 * Aspect: the source is ~5:4 (241:194). We keep that aspect by scaling
 * width up from the requested size; the visible cup glyph sits inside
 * the asset's own padding, so the bounding box doesn't read as oversized
 * next to button text.
 */
type Props = {
  size?: number;
  className?: string;
};

const NATIVE_W = 241;
const NATIVE_H = 194;

export const KofiIcon = ({ size = 20, className }: Props) => {
  const width = Math.round((size * NATIVE_W) / NATIVE_H);
  return (
    <Image
      src="/kofi_brandasset/kofi_symbol.svg"
      alt=""
      aria-hidden="true"
      width={width}
      height={size}
      priority={false}
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
};

export default KofiIcon;
