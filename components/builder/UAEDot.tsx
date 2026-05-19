/**
 * UAEDot — a tiny stylised UAE locale marker.
 *
 * Used as a quiet "UAE-rooted" signal in the topbar, step badges, and the
 * Today's Tip card. The design brief is explicit: this is NOT a literal UAE
 * flag illustration, just a four-stripe disc with the red bar on the leading
 * edge so the locale reads at a glance without leaning on national iconography.
 */
export const UAEDot = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    aria-label="UAE"
    role="img"
    style={{ flexShrink: 0 }}
  >
    <circle cx="7" cy="7" r="7" fill="#0A1F0E" />
    <rect x="0" y="0" width="14" height="3.5" fill="#0A1F0E" />
    <rect x="0" y="3.5" width="14" height="3.5" fill="#FFFFFF" />
    <rect x="0" y="7" width="14" height="3.5" fill="#0A6B2C" />
    <rect x="0" y="10.5" width="14" height="3.5" fill="#0A1F0E" />
    <rect x="0" y="0" width="4" height="14" fill="#A8201A" />
  </svg>
);
