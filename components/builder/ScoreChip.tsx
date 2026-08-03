"use client";

import { useEffect, useRef, useState } from "react";
import type { ScoreGrade, ScoreReport } from "../../lib/resumeChecker/types";
import { GRADE_CHIP_LABELS } from "../../lib/scoreEngine";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";

type Tier = "danger" | "warn" | "ok" | "great";

// Tier (color treatment) derives from the engine grade — the chip used to
// hardcode its own 50/70/85 thresholds, so a 65–69 CV showed "Strong CV"
// on the Review step and amber "Fair" here simultaneously (audit §4).
const TIER_BY_GRADE: Record<ScoreGrade, Tier> = {
  poor: "danger",
  "needs-work": "warn",
  good: "ok",
  excellent: "great",
};

// Before the user has typed anything meaningful (total === 0) the chip is a
// coach, not a judge: neutral greys, a dash in the dial, "Builds as you
// type" — a red "0 · Needs work" verdict on an empty page punishes people
// for arriving (Part 2 polish, 2026-08-03).
const PRISTINE_STYLE = {
  fg: "var(--ff-muted)",
  bg: "var(--ff-card)",
  border: "var(--ff-line)",
  labelFg: "var(--ff-muted)",
};

const TIER_STYLE: Record<
  Tier,
  { fg: string; bg: string; border: string; labelFg: string }
> = {
  // Danger reuses the exact tints of the save-error chip in the same bar
  // (--ff-red on --ff-red-soft is ~5.3:1, passes AA) so the two red states
  // read as one system rather than two clashing palettes.
  danger: {
    fg: "var(--ff-red)",
    bg: "var(--ff-red-soft)",
    border: "var(--ff-red-line)",
    labelFg: "var(--ff-red)",
  },
  // Warn fg is darkened via color-mix because raw --ff-warn on --ff-warn-soft
  // is ~4.4:1 — just below AA for the 11.5px bold grade text; the rgba border
  // mirrors the ok tier's alpha-tint pattern.
  warn: {
    fg: "color-mix(in srgb, var(--ff-warn) 85%, black)",
    bg: "var(--ff-warn-soft)",
    border: "rgba(162, 101, 0, 0.35)",
    labelFg: "var(--ff-warn)",
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

// Circumference of the score dial ring (r = 13).
const RING_CIRC = 2 * Math.PI * 13;

export const ScoreChip = ({
  report,
  delta,
}: {
  report: ScoreReport;
  delta?: number;
}) => {
  const animated = useAnimatedNumber(report.total);
  const pristine = report.total === 0;
  const tier = TIER_BY_GRADE[report.grade];
  const style = pristine ? PRISTINE_STYLE : TIER_STYLE[tier];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // How far (px) the popover shifts right of its default right:0 anchor so it
  // stays on-screen on narrow phones — anchored to the chip's right edge, a
  // 320px panel can spill past the LEFT viewport edge on ~360px screens.
  const [shiftRight, setShiftRight] = useState(0);

  const openPopover = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(320, window.innerWidth - 32);
      const left = rect.right - width;
      setShiftRight(left < 16 ? 16 - left : 0);
    }
    setOpen(true);
  };

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        ref={triggerRef}
        type="button"
        className="cv-score-chip"
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-label={
          pristine
            ? "CV Score: builds as you type. Click for details."
            : `CV Score: ${report.total} out of 100. Click for details.`
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          // Feeds .cv-score-chip:hover's tier-tinted glow (globals.css).
          ...({ "--chip-glow": style.fg } as React.CSSProperties),
        }}
      >
        {/* Score dial — ring fills with the score, exact number inside */}
        <span style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            style={{ display: "block", transform: "rotate(-90deg)" }}
            aria-hidden="true"
          >
            <circle cx="16" cy="16" r="13" fill="none" stroke={style.border} strokeWidth="3" />
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke={style.fg}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC * (1 - Math.min(100, Math.max(0, report.total)) / 100)}
              style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.8,0.2,1)" }}
            />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-display)",
              fontSize: 11.5,
              fontWeight: 700,
              color: style.fg,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pristine ? "—" : animated}
          </span>
        </span>
        {/* Label + grade — hidden on the tightest screens (the dial stands alone) */}
        <span className="hidden sm:flex" style={{ flexDirection: "column", lineHeight: 1.15, textAlign: "left" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              fontWeight: 600,
              color: style.labelFg,
            }}
          >
            CV SCORE
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: style.fg }}>
            {pristine ? "Builds as you type" : GRADE_CHIP_LABELS[report.grade]}
          </span>
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              color: delta > 0 ? "var(--ff-accent-dark)" : "var(--ff-red)",
              background: delta > 0 ? "var(--ff-accent-soft)" : "var(--ff-red-soft)",
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
            right: -shiftRight,
            width: "min(320px, calc(100vw - 32px))",
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
              CV SCORE · {pristine ? "—" : report.total}/100
            </span>
            <span
              style={{
                fontSize: 11,
                color: style.labelFg,
                fontWeight: 600,
              }}
            >
              {pristine ? "Builds as you type" : GRADE_CHIP_LABELS[report.grade]}
            </span>
          </div>

          {pristine ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--ff-ink-2)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Your score grows with every section you complete — name and
              contact details first, then UAE essentials, experience and
              skills. 65+ counts as a Strong CV here.
            </p>
          ) : issues.length === 0 ? (
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
