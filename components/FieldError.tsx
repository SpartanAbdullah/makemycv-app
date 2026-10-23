"use client";

export function FieldError({
  message,
  type = "error",
  reserve = false,
}: {
  message: string | null;
  type?: "error" | "warning";
  /**
   * Keep the line's height even when there is no message. Use this wherever
   * the message can appear on BLUR: a helper line that pops in between
   * mousedown and mouseup pushes whatever sits below it (usually the Continue
   * button) out from under the pointer, and the click is lost (audit F01,
   * measured 24px shift on the Summary step). Reserving the slot costs one
   * empty line and makes the layout independent of focus.
   */
  reserve?: boolean;
}) {
  if (!message) {
    if (!reserve) return null;
    return <p aria-hidden style={{ fontSize: 12, marginTop: 6, minHeight: 18 }} />;
  }

  // Mirrors Field's helper line (12px, 6px gap, --ff-red) so inline errors
  // read identically everywhere; --ff-warn keeps warnings above the 4.5:1
  // floor. No emoji glyph \u2014 the message text itself carries the meaning.
  return (
    <p
      style={{
        fontSize: 12,
        marginTop: 6,
        color: type === "warning" ? "var(--ff-warn)" : "var(--ff-red)",
      }}
    >
      {message}
    </p>
  );
}
