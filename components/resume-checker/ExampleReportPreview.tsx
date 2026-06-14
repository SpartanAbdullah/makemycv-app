// Static mockup that previews the upcoming ATS report on the upload page.
// Pure JSX, no interactivity, no real data. "Aisha K." is a placeholder.

import { Logo } from "../Logo";

const EXAMPLE_SCORE = 82;
const RADIUS = 40;
const STROKE = 8;
const CIRC = 2 * Math.PI * RADIUS;
const DASH = (EXAMPLE_SCORE / 100) * CIRC;

const CATEGORIES: Array<{ name: string; pct: number; tone: "good" | "review" | "error" }> = [
  { name: "Content", pct: 80, tone: "good" },
  { name: "Sections", pct: 100, tone: "good" },
  { name: "ATS Essentials", pct: 67, tone: "review" },
  { name: "Design", pct: 90, tone: "good" },
];

const toneBar: Record<"good" | "review" | "error", string> = {
  good: "bg-severity-good",
  review: "bg-severity-review",
  error: "bg-severity-error",
};

export default function ExampleReportPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-lg-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-paper-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <Logo variant="mark" height={22} href={null} />
          <span className="text-xs font-semibold text-slate-900">makemycv.ae · ATS Checker</span>
          <span className="rounded-full border border-severity-review/40 bg-severity-review/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-severity-review">
            Example report
          </span>
        </div>
        <div className="rounded-md border border-line bg-paper px-2 py-1 text-[10px] font-medium text-slate-500">
          Share
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Example: Marketing Manager CV
        </div>

        <div className="mt-4 flex items-center gap-5">
          {/* Score ring */}
          <div className="relative h-[100px] w-[100px] flex-shrink-0" aria-hidden>
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="var(--line)"
                strokeWidth={STROKE}
              />
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="var(--brand-blue)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${DASH} ${CIRC}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
                {EXAMPLE_SCORE}
              </div>
              <div className="text-[10px] text-slate-500">/100</div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-severity-good-border bg-severity-good-bg px-2.5 py-0.5 text-xs font-semibold text-severity-good">
              Good
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Close to the ATS-safe bar. A couple of fixes will push it over.
            </div>
          </div>
        </div>

        {/* Issue count chips */}
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-error-bg px-2.5 py-1 text-xs font-medium text-severity-error">
            <span className="h-1.5 w-1.5 rounded-full bg-severity-error" aria-hidden />
            2 errors
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-review-bg px-2.5 py-1 text-xs font-medium text-severity-review">
            <span className="h-1.5 w-1.5 rounded-full bg-severity-review" aria-hidden />
            3 to review
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-good-bg px-2.5 py-1 text-xs font-medium text-severity-good">
            <span className="h-1.5 w-1.5 rounded-full bg-severity-good" aria-hidden />
            4 strong
          </span>
        </div>

        {/* Category rows */}
        <div className="mt-5 space-y-2.5">
          {CATEGORIES.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className="w-28 flex-shrink-0 text-xs font-medium text-slate-700">
                {c.name}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${toneBar[c.tone]}`}
                  style={{ width: `${c.pct}%` }}
                />
              </div>
              <div className="w-10 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-slate-900">
                {c.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fade overlay teaser */}
      <div className="relative h-20">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-paper/85 to-paper" aria-hidden />
        <div className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-slate-500">
          + detailed issues and fixes
        </div>
      </div>
    </div>
  );
}
