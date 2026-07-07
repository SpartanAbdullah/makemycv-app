import type { TemplateBadge } from "../../lib/templates";

// Tone → pill styling, shared by the picker grid cards and the full-screen
// preview modal so the two never drift. Emphasis hierarchy (filled accent >
// soft green > quiet grey) does the guiding: "Recommended" anchors the eye,
// "ATS-Friendly" reassures, "Design-led" recedes. Each pill is a self-contained
// light/filled chip, so it stays legible on both the white card and the dark
// modal overlay.
const BADGE_TONE_STYLE: Record<
  TemplateBadge["tone"],
  { background: string; color: string; border: string }
> = {
  recommended: {
    background: "var(--ff-accent)",
    color: "#fff",
    border: "1px solid var(--ff-accent)",
  },
  ats: {
    background: "var(--ff-accent-soft)",
    color: "var(--ff-accent)",
    border: "1px solid color-mix(in srgb, var(--ff-accent) 30%, transparent)",
  },
  neutral: {
    background: "var(--ff-paper)",
    color: "var(--ff-muted)",
    border: "1px solid var(--ff-line)",
  },
  new: {
    background: "#E7EEFB",
    color: "#1D4ED8",
    border: "1px solid rgba(29,78,216,0.30)",
  },
};

export const TemplateBadges = ({
  badges,
  direction = "column",
}: {
  badges?: TemplateBadge[];
  direction?: "row" | "column";
}) => {
  if (!badges || badges.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems: "flex-start",
        flexWrap: direction === "row" ? "wrap" : "nowrap",
        gap: direction === "row" ? 8 : 5,
      }}
    >
      {badges.map((b) => (
        <span
          key={b.label}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            padding: "3px 8px",
            borderRadius: 999,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            ...BADGE_TONE_STYLE[b.tone],
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
};

// ── Corner ribbon (grid cards) ────────────────────────────────────────────
// cvtoolspro-style diagonal ribbon across the card's top-right corner. Shows a
// SINGLE badge (highest priority) so the card reads cleanly like the reference.
// The parent card must be `position: relative; overflow: hidden`.
const RIBBON_TONE: Record<TemplateBadge["tone"], { bg: string; fg: string }> = {
  recommended: { bg: "var(--ff-accent)", fg: "#ffffff" },
  ats: { bg: "var(--ff-accent)", fg: "#ffffff" },
  neutral: { bg: "#64748B", fg: "#ffffff" },
  new: { bg: "#2563EB", fg: "#ffffff" },
};

const TONE_PRIORITY: TemplateBadge["tone"][] = [
  "recommended",
  "new",
  "ats",
  "neutral",
];

export const TemplateRibbon = ({ badges }: { badges?: TemplateBadge[] }) => {
  if (!badges || badges.length === 0) return null;
  const top =
    TONE_PRIORITY.map((t) => badges.find((b) => b.tone === t)).find(Boolean) ??
    badges[0];
  const { bg, fg } = RIBBON_TONE[top.tone];
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 104,
        height: 104,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 18,
          right: -34,
          width: 140,
          transform: "rotate(45deg)",
          textAlign: "center",
          background: bg,
          color: fg,
          fontFamily: "var(--font-body)",
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "4px 0",
          boxShadow: "0 1px 4px rgba(15,23,42,0.28)",
        }}
      >
        {top.label}
      </span>
    </div>
  );
};
