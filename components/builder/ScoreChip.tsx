"use client";

import { useEffect, useRef, useState } from "react";
import type { ScoreReport } from "../../lib/resumeChecker/types";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";

type Tier = "danger" | "warn" | "ok" | "great";

function tierFor(score: number): Tier {
  if (score < 50) return "danger";
  if (score < 70) return "warn";
  if (score < 85) return "ok";
  return "great";
}

const TIER_STYLE: Record<
  Tier,
  { fg: string; bg: string; border: string; labelFg: string }
> = {
  danger: {
    fg: "#9F1239",
    bg: "#FEF2F2",
    border: "#FCA5A5",
    labelFg: "#B91C1C",
  },
  warn: {
    fg: "#92400E",
    bg: "#FFFBEB",
    border: "#FCD34D",
    labelFg: "#B45309",
  },
  ok: {
    fg: "var(--ff-accent-dark)",
    bg: "var(--ff-accent-soft)",
    border: "rgba(14,124,74,0.30)",
    labelFg: "var(--ff-accent-dark)",
  },
  great: {
    fg: "var(--ff-accent-dark)",
    bg: "var(--ff-accent-soft)",
    border: "var(--ff-accent)",
    labelFg: "var(--ff-accent-dark)",
  },
};

export const ScoreChip = ({
  report,
  delta,
}: {
  report: ScoreReport;
  delta?: number;
}) => {
  const animated = useAnimatedNumber(report.total);
  const tier = tierFor(report.total);
  const style = TIER_STYLE[tier];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Pull the top open issues (errors first, then reviews), capped at 3.
  const issues = report.categories
    .flatMap((c) => c.issues)
    .filter((i) => i.severity === "error" || i.severity === "review")
    .sort((a, b) => {
      const rank = (s: string) => (s === "error" ? 0 : 1);
      return rank(a.severity) - rank(b.severity);
    })
    .slice(0, 3);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`CV Score: ${report.total} out of 100. Click for details.`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 5px 5px 12px",
          background: style.bg,
          border: `1px solid ${style.border}`,
          borderRadius: 999,
          cursor: "pointer",
          transition: "border-color 120ms, background 120ms",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: style.labelFg,
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          SCORE
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            color: style.fg,
            fontWeight: 700,
            minWidth: 22,
            textAlign: "center",
          }}
        >
          {animated}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              color: delta > 0 ? "#065F46" : "#9F1239",
              background: delta > 0 ? "#D1FAE5" : "#FEE2E2",
              padding: "3px 7px",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Score breakdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            background: "var(--ff-card)",
            border: "1px solid var(--ff-line)",
            borderRadius: 14,
            boxShadow:
              "0 24px 48px -16px rgba(15,23,42,0.18), 0 4px 12px -2px rgba(15,23,42,0.06)",
            padding: 14,
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--ff-muted)",
              }}
            >
              CV SCORE · {report.total}/100
            </span>
            <span
              style={{
                fontSize: 11,
                color: style.labelFg,
                fontWeight: 600,
              }}
            >
              {tier === "danger" && "Needs work"}
              {tier === "warn" && "Fair"}
              {tier === "ok" && "Strong"}
              {tier === "great" && "Excellent"}
            </span>
          </div>

          {issues.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--ff-ink-2)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              No outstanding issues — your CV looks solid. Keep tightening
              bullets for measurable impact.
            </p>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ff-ink)",
                  marginBottom: 8,
                }}
              >
                Top {issues.length === 1 ? "fix" : `${issues.length} fixes`}
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {issues.map((issue) => (
                  <li
                    key={issue.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        marginTop: 5,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        flexShrink: 0,
                        background:
                          issue.severity === "error"
                            ? "#DC2626"
                            : "#D97706",
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ff-ink)",
                          lineHeight: 1.35,
                        }}
                      >
                        {issue.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ff-ink-2)",
                          lineHeight: 1.45,
                          marginTop: 2,
                        }}
                      >
                        {issue.actionable}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};
