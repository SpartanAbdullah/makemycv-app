"use client";

export function FieldError({
  message,
  type = "error",
}: {
  message: string | null;
  type?: "error" | "warning";
}) {
  if (!message) return null;

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
