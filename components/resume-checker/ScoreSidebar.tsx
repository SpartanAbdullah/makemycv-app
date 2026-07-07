"use client";

import { useState } from "react";
import type {
  ScoreCategory,
  ScoreReport,
  ScoreSeverity,
} from "@/lib/resumeChecker/types";
import FixInBuilderButton from "./FixInBuilderButton";
import ScoreRing from "./ScoreRing";

const dotColor: Record<ScoreSeverity, string> = {
  good: "bg-severity-good",
  review: "bg-severity-review",
  error: "bg-severity-error",
};

// Text uses the darker -text ramps (4.5:1 on tinted backgrounds); dots keep
// the brighter solid hues (graphics only need 3:1).
const severityTextColor: Record<ScoreSeverity, string> = {
  good: "text-severity-good-text",
  review: "text-severity-review-text",
  error: "text-severity-error-text",
};

export default function ScoreSidebar({
  score,
  reportId,
}: {
  score: ScoreReport;
  reportId: string;
}) {
  const { error: errCount, review: revCount, good: goodCount } = score.issueCounts;

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm-soft">
        <div className="flex flex-col items-center">
          <ScoreRing score={score.total} grade={score.grade} />
        </div>

        {/* Issue count chips */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <IssueChip count={errCount} tone="error" label={errCount === 1 ? "error" : "errors"} />
          <IssueChip count={revCount} tone="review" label="to review" />
          <IssueChip count={goodCount} tone="good" label="strong" />
        </div>

        {/* Category rows */}
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Breakdown
          </div>
          <div className="space-y-0.5">
            {score.categories.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </div>
        </div>

        {/* Fix-in-Builder CTA */}
        <div className="mt-6 border-t border-line pt-5">
          <FixInBuilderButton reportId={reportId} />
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            Report and builder are both free. No sign-up.
          </p>
        </div>
      </div>
    </aside>
  );
}

function IssueChip({
  count,
  tone,
  label,
}: {
  count: number;
  tone: ScoreSeverity;
  label: string;
}) {
  const active = count > 0;
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  const toneClass = active
    ? tone === "error"
      ? "bg-severity-error-bg text-severity-error-text"
      : tone === "review"
        ? "bg-severity-review-bg text-severity-review-text"
        : "bg-severity-good-bg text-severity-good-text"
    : "bg-paper-2 text-slate-400";
  const dotClass = active ? dotColor[tone] : "bg-slate-300";

  return (
    <span className={`${base} ${toneClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      {count} {label}
    </span>
  );
}

function CategoryRow({ cat }: { cat: ScoreCategory }) {
  const [open, setOpen] = useState(false);
  const bad = cat.issues.filter((i) => i.severity !== "good");
  const hasDetails = bad.length > 0;

  return (
    <div className="rounded-lg">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (typeof document !== "undefined") {
            const el = document.getElementById(`category-${cat.id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-paper-2"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColor[cat.status]}`}
            aria-hidden
          />
          <span className="truncate text-sm font-medium text-slate-800">
            {cat.name}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold tabular-nums ${severityTextColor[cat.status]}`}
          >
            {cat.score}%
          </span>
          {hasDetails && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          )}
        </span>
      </button>
      {open && hasDetails && (
        <ul className="mb-2 ml-6 space-y-1 border-l border-line pl-3 text-xs text-slate-600">
          {bad.map((i) => (
            <li key={i.id} className="leading-relaxed">
              {i.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
