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
  <label className="flex flex-col gap-1 text-sm">
    <span className="text-slate-700 font-medium">{label}</span>
    {children}
    {hint && <span className="text-xs text-slate-400">{hint}</span>}
    {error && <span className="text-xs text-red-500">{error}</span>}
  </label>
);
