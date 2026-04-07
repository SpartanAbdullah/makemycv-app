"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCvStore } from "../lib/store/cvStore";
import { calculateScore } from "../lib/scoreEngine";

function getDotColor(grade: string) {
  if (grade === "Excellent") return "bg-green-500";
  if (grade === "Good") return "bg-blue-500";
  if (grade === "Fair") return "bg-amber-500";
  return "bg-red-500";
}

export default function ScoreWidget() {
  const router = useRouter();
  const data = useCvStore((state) => state.data);
  const result = useMemo(() => calculateScore(data), [data]);
  const dotColor = getDotColor(result.grade);
  const isPerfect = result.total === 100;

  return (
    <button
      type="button"
      onClick={() => router.push("/builder?step=score")}
      className="group fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg transition-shadow hover:shadow-xl max-w-[180px] cursor-pointer"
      aria-label={`CV Score: ${result.total} out of 100 — ${result.grade}`}
    >
      {/* CSS-only tooltip */}
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 hidden whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white group-hover:block">
        Click to see what to fix {"\u2192"}
      </span>

      {/* Colored dot or checkmark */}
      {isPerfect ? (
        <span className="shrink-0 text-xs font-bold text-green-600">
          {"\u2713"}
        </span>
      ) : (
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full animate-pulse ${dotColor}`}
        />
      )}

      {/* Score number */}
      <span className="text-sm font-black text-gray-900">
        {result.total}/100
      </span>

      {/* Grade label */}
      <span className="text-xs font-medium text-gray-500 truncate">
        {result.grade}
      </span>
    </button>
  );
}
