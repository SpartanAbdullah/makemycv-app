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
      {/* Single in-card sub-header grammar — matches Experience "Achievements". */}
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--ff-ink)" }}>{title}</h3>
      {action}
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);
