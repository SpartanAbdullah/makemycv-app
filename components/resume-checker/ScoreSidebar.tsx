"use client";

import { useState } from "react";
import type {
  ScoreCategory,
  ScoreReport,
  ScoreSeverity,
} from "@/lib/resumeChecker/types";
import FixInBuilderButton from "./FixInBuilderButton";

function totalStatus(total: number): ScoreSeverity {
  if (total >= 85) return "good";
  if (total >= 60) return "review";
  return "error";
}

const statusRing: Record<ScoreSeverity, string> = {
  good: "ring-emerald-400 text-emerald-700",
  review: "ring-amber-400 text-amber-700",
  error: "ring-red-400 text-red-700",
};

const dotColor: Record<ScoreSeverity, string> = {
  good: "bg-emerald-500",
  review: "bg-amber-500",
  error: "bg-red-500",
};

const severityLabel: Record<ScoreSeverity, string> = {
  good: "Good",
  review: "Review",
  error: "Fix",
};

export default function ScoreSidebar({
  score,
  reportId,
}: {
  score: ScoreReport;
  reportId: string;
}) {
  const issueCount = score.issueCounts.error + score.issueCounts.review;
  const overall = totalStatus(score.total);
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
          Your score
        </div>
        <div
          className={`mb-2 inline-flex items-baseline font-display text-5xl font-bold tabular-nums ring-2 ring-offset-4 rounded-xl px-3 py-1 ${statusRing[overall]}`}
        >
          {score.total}
          <span className="ml-1 text-2xl font-semibold text-slate-400">
            /100
          </span>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {issueCount === 0
            ? "No issues found."
            : `${issueCount} issue${issueCount > 1 ? "s" : ""} to address.`}
        </div>

        <div className="mt-6 space-y-1">
          {score.categories.map((cat) => (
            <CategoryRow key={cat.id} cat={cat} />
          ))}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <FixInBuilderButton reportId={reportId} />
          <p className="mt-3 text-center text-xs text-slate-500">
            All issues above are free to view. The $5 covers the polished CV
            rebuild + PDF export.
          </p>
        </div>
      </div>
    </aside>
  );
}

function CategoryRow({ cat }: { cat: ScoreCategory }) {
  const [open, setOpen] = useState(false);
  const bad = cat.issues.filter((i) => i.severity !== "good");

  return (
    <div className="rounded-lg border border-transparent hover:border-slate-100">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          // jump to the main card too
          if (typeof document !== "undefined") {
            const el = document.getElementById(`category-${cat.id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
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
          <span className="ml-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {severityLabel[cat.status]}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {cat.score}%
          </span>
          <span
            aria-hidden
            className={`text-xs text-slate-400 transition ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </span>
      </button>
      {open && bad.length > 0 && (
        <ul className="mb-2 ml-6 space-y-1 border-l border-slate-200 pl-3 text-xs text-slate-600">
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
