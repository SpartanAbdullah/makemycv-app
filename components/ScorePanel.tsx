"use client";

import { useMemo } from "react";
import { useCvStore } from "../lib/store/cvStore";
import { calculateScore } from "../lib/scoreEngine";
import type { ScoreCategory } from "../lib/scoreEngine";

function getScoreColor(total: number) {
  if (total >= 85) return { ring: "#22c55e", bar: "bg-green-500", badge: "bg-green-500/15 text-green-400", text: "text-green-400" };
  if (total >= 65) return { ring: "#3b82f6", bar: "bg-blue-500", badge: "bg-blue-500/15 text-blue-400", text: "text-blue-400" };
  if (total >= 40) return { ring: "#f59e0b", bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-400", text: "text-amber-400" };
  return { ring: "#ef4444", bar: "bg-red-500", badge: "bg-red-500/15 text-red-400", text: "text-red-400" };
}

function getCategoryBarColor(score: number, maxScore: number) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.85) return "bg-green-500";
  if (pct >= 0.6) return "bg-blue-500";
  if (pct >= 0.35) return "bg-amber-500";
  return "bg-red-500";
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CategoryCard({ category }: { category: ScoreCategory }) {
  const pct = category.maxScore > 0 ? (category.score / category.maxScore) * 100 : 0;
  const barColor = getCategoryBarColor(category.score, category.maxScore);
  const hasSuggestions = category.score < category.maxScore && category.suggestions.length > 0;

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">{category.name}</span>
        <span className="text-xs font-medium text-slate-400">
          {category.score} / {category.maxScore}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hasSuggestions && (
        <ul className="mt-3 space-y-2">
          {category.suggestions.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-400">
              <span className="shrink-0 text-amber-400">{"⚠️"}</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScorePanel() {
  const data = useCvStore((state) => state.data);
  const result = useMemo(() => calculateScore(data), [data]);
  const color = getScoreColor(result.total);
  const offset = CIRCUMFERENCE * (1 - result.total / 100);

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      {/* Header with circular score */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
            <circle
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-white/5"
            />
            <circle
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke={color.ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{result.total}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>
        <span
          className={`mb-2 inline-block rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider ${color.badge}`}
        >
          {result.grade}
        </span>
        <p className="text-xs text-slate-500">
          Based on ATS compatibility and content strength
        </p>
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Breakdown
        </h3>
        {result.categories.map((cat) => (
          <CategoryCard key={cat.name} category={cat} />
        ))}
      </div>

      {/* Pro Tip */}
      <div className="rounded-xl border-l-4 border-indigo-500 bg-indigo-500/5 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-400">
          Pro Tip
        </p>
        <p className="text-xs leading-relaxed text-slate-400">
          UAE recruiters spend an average of 6 seconds scanning a CV. A score
          above 85 significantly increases your callback rate.
        </p>
      </div>
    </div>
  );
}
