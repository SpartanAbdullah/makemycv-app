/* ─── Bullet editor row ───────────────────────────────────────
   Bordered card wrapper for a single bullet editor (marker dot +
   textarea + trailing actions). Extracted from ExperienceStep so the
   Experience and Projects bullet editors share one visual identity. */
export const BulletRow = ({
  showMarker,
  children,
}: {
  showMarker: boolean;
  children: React.ReactNode;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 12px",
      background: "var(--ff-card)",
      border: "1px solid var(--ff-line)",
      borderRadius: 10,
    }}
  >
    {showMarker && (
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "var(--ff-ink)",
          marginTop: 14,
          flexShrink: 0,
        }}
      />
    )}
    <div style={{ flex: 1, display: "flex", gap: 8 }}>{children}</div>
  </div>
);
