"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCvStore } from "../lib/store/cvStore";
import { computeScore } from "../lib/scoreEngine";
import type { ScoreGrade } from "../lib/resumeChecker/types";

const GRADE_LABEL: Record<ScoreGrade, string> = {
  excellent: "Excellent",
  good: "Good",
  "needs-work": "Needs Work",
  poor: "Poor",
};

function getDotColor(grade: ScoreGrade) {
  if (grade === "excellent") return "bg-green-500";
  if (grade === "good") return "bg-blue-500";
  if (grade === "needs-work") return "bg-amber-500";
  return "bg-red-500";
}

export default function ScoreWidget() {
  const router = useRouter();
  const data = useCvStore((state) => state.data);
  const parseSignals = useCvStore((state) => state.parseSignals);
  const result = useMemo(
    () =>
      computeScore(data, {
        mode: "builder",
        parseSignals: parseSignals ?? undefined,
      }),
    [data, parseSignals],
  );
  const dotColor = getDotColor(result.grade);
  const isPerfect = result.total === 100;
  const gradeLabel = GRADE_LABEL[result.grade];

  // Pinned bottom-right, above the "Preview CV" floating button (which sits at
  // { bottom: 20px, right: 20px, z:50 } on <xl breakpoints). We stack ~12px
  // above it, matching its right edge, at the same z-index. On xl+ the
  // Preview CV button is hidden and the pill sits alone in the same spot —
  // unaffected by any banner that pushes builder content down.
  return (
    <div className="fixed bottom-[74px] right-5 z-50">
      <div className={`ai-glow-border${isPerfect ? " score-perfect" : ""}`}>
        <button
        type="button"
        onClick={() => router.push("/builder?step=score")}
        className="group relative flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg transition-shadow hover:shadow-xl max-w-[180px] cursor-pointer"
        aria-label={`CV Score: ${result.total} out of 100 — ${gradeLabel}`}
      >
        <span className="pointer-events-none absolute bottom-full left-0 mb-2 hidden whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white group-hover:block">
          Click to see what to fix {"\u2192"}
        </span>

        {isPerfect ? (
          <span className="shrink-0 text-xs font-bold text-green-600">
            {"\u2713"}
          </span>
        ) : (
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full animate-pulse ${dotColor}`}
          />
        )}

        <span className="text-sm font-black text-gray-900">
          {result.total}/100
        </span>

        <span className="text-xs font-medium text-gray-500 truncate">
          {gradeLabel}
        </span>
        </button>
      </div>
    </div>
  );
}
