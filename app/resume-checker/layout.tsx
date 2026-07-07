import type { CSSProperties, ReactNode } from "react";

// The checker surface is brand-blue; the keyboard focus ring follows the
// surface accent via --focus-ring (globals.css falls back to the builder's
// emerald --ff-accent wherever it is unset). Set here on the segment layout
// so the landing page, report pages, error boundary, and any future checker
// routes all inherit it (UI-4 follow-up).
export default function ResumeCheckerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div style={{ "--focus-ring": "var(--brand-blue)" } as CSSProperties}>
      {children}
    </div>
  );
}
