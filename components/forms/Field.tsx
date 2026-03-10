import { ReactNode } from "react";

export const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) => (
  <label className="cv-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span className="cv-label">{label}</span>
    {children}
    {hint && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{hint}</span>}
    {error && <span style={{ fontSize: 12, color: "var(--status-error)" }}>{error}</span>}
  </label>
);
