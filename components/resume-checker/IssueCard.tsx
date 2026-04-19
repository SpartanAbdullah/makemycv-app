import type { CheckerIssue } from "@/lib/resumeChecker/types";

const severityConfig = {
  good: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-50",
    tagBg: "bg-emerald-100",
    tagText: "text-emerald-700",
    label: "Working",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  review: {
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    tagBg: "bg-amber-100",
    tagText: "text-amber-800",
    label: "Review",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3.5h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.2 16a2 2 0 001.73 3z" />
      </svg>
    ),
  },
  error: {
    border: "border-l-red-500",
    bg: "bg-red-50",
    tagBg: "bg-red-100",
    tagText: "text-red-700",
    label: "Fix",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
} as const;

export default function IssueCard({ issue }: { issue: CheckerIssue }) {
  const cfg = severityConfig[issue.severity];
  return (
    <div
      className={`flex gap-3 rounded-lg border border-slate-200 border-l-4 ${cfg.border} ${cfg.bg} p-4`}
    >
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.tagBg} ${cfg.tagText}`}
        aria-hidden
      >
        {cfg.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{issue.title}</h4>
          <span
            className={`rounded-full ${cfg.tagBg} ${cfg.tagText} px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide`}
          >
            {cfg.label}
          </span>
        </div>
        {issue.description && (
          <p className="mt-1 text-sm text-slate-700">{issue.description}</p>
        )}
        {issue.actionable && (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">How to fix: </span>
            {issue.actionable}
          </p>
        )}
      </div>
    </div>
  );
}
