import type { ScoreGrade } from "@/lib/resumeChecker/types";

// Grade hues must track the builder ScoreChip tiers (green/green/amber/red)
// so a score never changes color language across surfaces — see
// docs/score-parity-smoke-test.md. good/excellent share the green hue and
// are distinguished by label, exactly like the builder.
const GRADE_COLOR: Record<ScoreGrade, string> = {
  excellent: "var(--severity-good)",
  good: "var(--severity-good)",
  "needs-work": "var(--severity-review)",
  poor: "var(--severity-error)",
};

// Darker -text ramps for the pill LABEL only — 12px text on the pill's 12%
// tint needs 4.5:1; the ring stroke and tint keep the brighter GRADE_COLOR
// hues (graphics floor is 3:1).
const GRADE_TEXT_COLOR: Record<ScoreGrade, string> = {
  excellent: "var(--severity-good-text)",
  good: "var(--severity-good-text)",
  "needs-work": "var(--severity-review-text)",
  poor: "var(--severity-error-text)",
};

const GRADE_LABEL: Record<ScoreGrade, string> = {
  excellent: "Excellent",
  good: "Good",
  "needs-work": "Needs work",
  poor: "Poor",
};

export default function ScoreRing({
  score,
  grade,
  size = 160,
}: {
  score: number;
  grade: ScoreGrade;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }} aria-hidden>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={GRADE_COLOR[grade]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="font-display text-4xl font-bold tabular-nums text-slate-900 leading-none"
            aria-label={`Score ${clamped} out of 100`}
          >
            {clamped}
          </div>
          <div className="mt-1 text-sm text-slate-500">/100</div>
        </div>
      </div>
      <div
        className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
        style={{
          color: GRADE_TEXT_COLOR[grade],
          background: `color-mix(in oklab, ${GRADE_COLOR[grade]} 12%, transparent)`,
        }}
      >
        {GRADE_LABEL[grade]}
      </div>
    </div>
  );
}
