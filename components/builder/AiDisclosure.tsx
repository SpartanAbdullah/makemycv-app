/**
 * One-line transparency note rendered beside every AI-improve trigger.
 *
 * The builder is fully client-side EXCEPT these buttons: they POST the
 * relevant CV text to /api/ai-improve, which forwards it to our AI provider
 * (Anthropic) and returns suggestions. Nothing is stored server-side (the
 * route keeps only per-IP rate-limit counters), so this copy must stay in
 * sync with that behavior — it is the disclosure that keeps the "your CV
 * never leaves your browser" claim honest.
 */
export const AiDisclosure = ({ align = "right" }: { align?: "left" | "right" }) => (
  <p
    style={{
      marginTop: 6,
      // --ff-muted (not --ff-faint) + 12px: this disclosure is load-bearing
      // copy, so it must clear AA contrast rather than read as decorative.
      fontSize: 12,
      lineHeight: 1.5,
      color: "var(--ff-muted)",
      textAlign: align,
    }}
  >
    Uses AI: this text is sent securely to our AI provider to generate
    suggestions. Not stored by MakeMyCV.
  </p>
);
