import { ReactNode } from "react";

export const Repeater = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {action}
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);
