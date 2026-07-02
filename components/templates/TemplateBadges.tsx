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
    background: "#E7F4EE",
    color: "#0E7C4A",
    border: "1px solid rgba(14,124,74,0.30)",
  },
  neutral: {
    background: "var(--ff-paper)",
    color: "var(--ff-muted)",
    border: "1px solid var(--ff-line)",
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
