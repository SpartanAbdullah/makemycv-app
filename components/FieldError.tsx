"use client";

export function FieldError({
  message,
  type = "error",
}: {
  message: string | null;
  type?: "error" | "warning";
}) {
  if (!message) return null;

  return (
    <p
      className={`text-xs mt-1 font-medium ${
        type === "warning" ? "text-amber-500" : "text-red-500"
      }`}
    >
      {type === "warning" ? "\u26A0\uFE0F" : "\u26D4"} {message}
    </p>
  );
}
