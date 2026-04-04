"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCvStore } from "../lib/store/cvStore";
import { calculateScore } from "../lib/scoreEngine";

function getScoreColor(total: number) {
  if (total >= 85)
    return { ring: "#22c55e", bg: "bg-green-500/10", text: "text-green-400" };
  if (total >= 65)
    return { ring: "#3b82f6", bg: "bg-blue-500/10", text: "text-blue-400" };
  if (total >= 40)
    return { ring: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-400" };
  return { ring: "#ef4444", bg: "bg-red-500/10", text: "text-red-400" };
}

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreWidget() {
  const router = useRouter();
  const data = useCvStore((state) => state.data);
  const result = useMemo(() => calculateScore(data), [data]);
  const color = getScoreColor(result.total);
  const offset = CIRCUMFERENCE * (1 - result.total / 100);

  const tooltipText =
    result.total === 100
      ? "Your CV scores perfectly! \u2713"
      : "Click to see what to improve \u2192";

  return (
    <button
      type="button"
      onClick={() => router.push("/builder?step=score")}
      className={`group relative fixed z-40 bottom-20 right-5 lg:bottom-6 lg:right-6 xl:right-[420px] flex items-center gap-2.5 rounded-full border border-white/10 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:shadow-xl ${color.bg}`}
      aria-label={`CV Score: ${result.total} out of 100 — ${result.grade}`}
    >
      {/* Attention dot / perfect check */}
      {result.total < 100 ? (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
      ) : (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 text-[7px] font-bold text-white">
          {"\u2713"}
        </span>
      )}

      {/* CSS-only tooltip */}
      <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {tooltipText}
        <span className="absolute right-4 top-full border-4 border-transparent border-t-gray-900" />
      </span>

      {/* Ring */}
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        className="shrink-0 -rotate-90"
      >
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-white/10"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke={color.ring}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>

      {/* Score + Grade */}
      <div className="flex flex-col items-start leading-none">
        <span className="text-lg font-bold text-white">{result.total}</span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${color.text}`}
        >
          {result.grade}
        </span>
      </div>
    </button>
  );
}
