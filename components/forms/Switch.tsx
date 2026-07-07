/* ─── Toggle switch ───────────────────────────────────────────
   One controlled switch for every on/off toggle in the builder
   (Education "Degree Attested?", PhotoUpload "Show photo on CV") —
   replaces two hand-rolled variants with different geometry. The 40×24
   track is deliberate: the ff-hit-target -8px inset brings the
   effective touch height to 40px, the mobile floor (a 21px track would
   only reach 37px). Native <button role="switch"> gives Space/Enter
   activation for free — no manual onKeyDown needed. */
export const Switch = ({
  checked,
  onChange,
  ariaLabel,
  ariaLabelledby,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  ariaLabelledby?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    onClick={() => onChange(!checked)}
    className="ff-hit-target"
    style={{
      position: "relative",
      width: 40,
      height: 24,
      borderRadius: 999,
      background: checked ? "var(--ff-accent)" : "var(--ff-line-strong)",
      border: "none",
      cursor: "pointer",
      padding: 0,
      transition: "background 150ms",
      flexShrink: 0,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 4,
        left: checked ? 20 : 4,
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "white",
        boxShadow: "var(--shadow-xs)",
        transition: "left 150ms",
      }}
    />
  </button>
);
