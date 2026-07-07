import type { CheckerIssue } from "@/lib/resumeChecker/types";

const severityConfig = {
  good: {
    borderLeft: "border-l-severity-good",
    tint: "bg-severity-good-bg/40",
    iconBg: "bg-severity-good-bg",
    iconText: "text-severity-good",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  review: {
    borderLeft: "border-l-severity-review",
    tint: "bg-severity-review-bg/50",
    iconBg: "bg-severity-review-bg",
    iconText: "text-severity-review",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3.5h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.2 16a2 2 0 001.73 3z" />
      </svg>
    ),
  },
  error: {
    borderLeft: "border-l-severity-error",
    tint: "bg-severity-error-bg/50",
    iconBg: "bg-severity-error-bg",
    iconText: "text-severity-error",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
      </svg>
    ),
  },
} as const;

export default function IssueCard({ issue }: { issue: CheckerIssue }) {
  const cfg = severityConfig[issue.severity];

  // "Good" severity → compact "what's working" row, no fix needed
  if (issue.severity === "good") {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border border-l-4 border-line ${cfg.borderLeft} ${cfg.tint} px-4 py-3`}
      >
        <div
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.iconBg} ${cfg.iconText}`}
          aria-hidden
        >
          {cfg.icon}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium text-slate-900">{issue.title}</span>
          {issue.description && (
            <span className="ml-2 text-slate-600">{issue.description}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 rounded-lg border border-l-4 border-line ${cfg.borderLeft} ${cfg.tint} p-4`}
    >
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.iconBg} ${cfg.iconText}`}
        aria-hidden
      >
        {cfg.icon}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold text-slate-900">{issue.title}</h4>
        {issue.description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {issue.description}
          </p>
        )}
        {issue.actionable && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-paper px-3 py-2 text-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-ff-accent-dark"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
            </svg>
            <div className="min-w-0">
              <span className="font-semibold text-ff-accent-dark">How to fix: </span>
              <span className="text-slate-700">{issue.actionable}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
