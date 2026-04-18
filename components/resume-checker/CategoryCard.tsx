"use client";

import { useState } from "react";
import type { ScoreCategory, ScoreSeverity } from "@/lib/resumeChecker/types";
import IssueCard from "./IssueCard";

const statusChip: Record<
  ScoreSeverity,
  { bg: string; text: string; label: string }
> = {
  good: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Good" },
  review: { bg: "bg-amber-100", text: "text-amber-800", label: "Needs review" },
  error: { bg: "bg-red-100", text: "text-red-700", label: "Needs fixing" },
};

export default function CategoryCard({
  category,
  defaultOpen = true,
}: {
  category: ScoreCategory;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const chip = statusChip[category.status];
  const issueCount = category.issues.filter((i) => i.severity !== "good").length;

  return (
    <section
      id={`category-${category.id}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {category.name}
            </h2>
            <span
              className={`${chip.bg} ${chip.text} rounded-full px-2.5 py-0.5 text-xs font-medium`}
            >
              {chip.label}
            </span>
            {issueCount > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {issueCount} issue{issueCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl font-semibold tabular-nums text-slate-900">
            {category.score}
            <span className="text-sm font-normal text-slate-400">/100</span>
          </span>
          <span
            aria-hidden
            className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5">
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
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Frequently asked
              </h3>
              <div className="space-y-2">
                {category.faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-lg border border-slate-200 bg-slate-50 p-4 open:bg-white"
                  >
                    <summary className="cursor-pointer list-none text-sm font-medium text-slate-900 marker:hidden">
                      <span className="flex items-start justify-between gap-3">
                        <span>{faq.q}</span>
                        <span
                          aria-hidden
                          className="mt-1 text-slate-400 transition group-open:rotate-180"
                        >
                          ▾
                        </span>
                      </span>
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
