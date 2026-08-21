/* ─── Shared step-card chrome ─────────────────────────────────
   Compact 28px icon button used inside entry cards (move up/down).
   Extracted from ExperienceStep so Education (and future steps) render
   the exact same affordance — .cv-btn-ghost is intentionally width:100%
   for the full-width Add-entry buttons, so raw ghost buttons stretch
   inside flex rows; this stays fixed-size and keeps the 44px
   ff-hit-target touch area. */
export const CardIconBtn = ({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="ff-hit-target"
    style={{
      width: 28,
      height: 28,
      borderRadius: 999,
      background: "var(--ff-paper)",
      border: "1px solid var(--ff-line)",
      display: "grid",
      placeItems: "center",
      color: "var(--ff-muted)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      padding: 0,
    }}
  >
    {children}
  </button>
);
