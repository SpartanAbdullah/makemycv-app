"use client";

import { useState } from "react";
import type {
  ScoreCategory,
  ScoreCategoryId,
  ScoreSeverity,
} from "@/lib/resumeChecker/types";
import IssueCard from "./IssueCard";

const statusTone: Record<
  ScoreSeverity,
  { iconBg: string; iconText: string; sublineText: string; label: string }
> = {
  good: {
    iconBg: "bg-severity-good-bg",
    iconText: "text-severity-good",
    sublineText: "text-severity-good",
    label: "Looking strong",
  },
  review: {
    iconBg: "bg-severity-review-bg",
    iconText: "text-severity-review",
    sublineText: "text-severity-review",
    label: "Needs review",
  },
  error: {
    iconBg: "bg-severity-error-bg",
    iconText: "text-severity-error",
    sublineText: "text-severity-error",
    label: "Needs fixing",
  },
};

function CategoryIcon({ id, className }: { id: ScoreCategoryId; className?: string }) {
  switch (id) {
    case "content":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
        </svg>
      );
    case "sections":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "atsEssentials":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M9 15l2 2 4-4" />
        </svg>
      );
    case "design":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 1010 10c0-1.3-1-2-2-2h-3a2 2 0 01-2-2 2 2 0 00-2-2H9a3 3 0 000-6z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function CategoryCard({
  category,
  defaultOpen = true,
}: {
  category: ScoreCategory;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = statusTone[category.status];
  const issueCount = category.issues.filter((i) => i.severity !== "good").length;

  return (
    <section
      id={`category-${category.id}`}
      className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm-soft"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 bg-paper-2 p-5 text-left transition hover:bg-paper-2/60"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${tone.iconBg} ${tone.iconText}`}
            aria-hidden
          >
            <CategoryIcon id={category.id} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {category.name}
            </h2>
            <div className={`text-xs font-medium ${tone.sublineText}`}>
              {tone.label}
              {issueCount > 0 && (
                <span className="text-slate-500"> · {issueCount} issue{issueCount > 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="font-display text-xl font-bold tabular-nums text-slate-900">
              {category.score}
            </span>
            <span className="text-sm text-slate-400">/100</span>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-line p-5">
          {category.issues.length === 0 ? (
            <p className="text-sm text-slate-500">
              No findings for this category. That&apos;s rare — nicely done.
            </p>
          ) : (
            <div className="space-y-3">
              {category.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}

          {category.faqs.length > 0 && (
            <div className="mt-6 rounded-xl border border-line bg-paper-2 p-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Frequently asked
              </h3>
              <div className="space-y-2">
                {category.faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-lg border border-line bg-paper p-3 open:border-brand-blue/40"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-slate-900 marker:hidden">
                      <span>{faq.q}</span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition group-open:rotate-180"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
