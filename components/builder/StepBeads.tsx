"use client";

import { formatStepCounter } from "../../lib/utils/steps";
import type { BuilderStep } from "../../lib/utils/steps";
import type { StepStatus } from "./Stepper";

type Props = {
  steps: BuilderStep[];
  statuses: Record<string, StepStatus>;
  currentId: string;
  onStepClick: (id: BuilderStep["id"]) => void;
  /** Optional right-aligned content on the context line (e.g. the UAE pill). */
  rightSlot?: React.ReactNode;
};

const STEP_LABELS: Record<string, string> = {
  personal: "Contact",
  uaeEssentials: "UAE Essentials",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  certifications: "Certifications",
  projects: "Projects",
  review: "Review",
};

// Shorter labels for the tiny under-bar row so 10 fit without truncating.
const SHORT_LABELS: Record<string, string> = {
  uaeEssentials: "UAE Ess.",
  certifications: "Certs",
};

const stateText = (status: StepStatus | undefined, isActive: boolean) =>
  isActive
    ? "current step"
    : status === "done"
      ? "completed"
      : status === "attention"
        ? "needs attention"
        : "not started";

// Map each step's state to our palette (not the mockup's hardcoded hex).
const segColor = (status: StepStatus | undefined, isActive: boolean) =>
  isActive
    ? "var(--ff-ink)"
    : status === "done"
      ? "var(--ff-accent)"
      : status === "attention"
        ? "var(--ff-warn)"
        : "var(--ff-line-strong)";

/**
 * "Segmented focus" stepper (founder design Concept 03). A context line names
 * the moment — "Step 06 / 10 · Skills · next: Languages" — over a ten-segment
 * progress bar; tiny labels ride beneath on desktop. Far lighter than the old
 * chunky capsule row, and the segment bar flexes to any width so it never
 * scrolls sideways (the labels hide on mobile; the context line still says
 * where you are).
 *
 * Every segment stays a real button — done/current/future alike navigate
 * (audit UX-1) — with a tooltip + aria-label so nothing is lost when the labels
 * are hidden. The amber "needs attention" state (a required, visited, still
 * incomplete section) is preserved.
 */
export const StepBeads = ({ steps, statuses, currentId, onStepClick, rightSlot }: Props) => {
  const total = steps.length;
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentId));
  const activeLabel = STEP_LABELS[currentId] ?? steps[currentIndex]?.title ?? "";
  const next = steps[currentIndex + 1];
  const nextLabel = next ? STEP_LABELS[next.id] ?? next.title : null;

  return (
    <div style={{ width: "100%", minWidth: 0 }} role="navigation" aria-label="CV builder progress">
      {/* Context line — where you are, what's next */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", lineHeight: 1.1 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            // --ff-muted, not --ff-faint: this is functional wayfinding text
            // (~2.3:1 in faint — below the 4.5:1 body-text floor).
            color: "var(--ff-muted)",
          }}
        >
          {formatStepCounter(currentIndex, total)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--ff-ink)",
          }}
        >
          {activeLabel}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ff-muted)" }}>
          {nextLabel ? `· next: ${nextLabel}` : "· final step"}
        </span>
        {rightSlot && <span style={{ marginLeft: "auto" }}>{rightSlot}</span>}
      </div>

      {/* Segmented bar — one segment per step, each a navigable button */}
      <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
        {steps.map((step) => {
          const status = statuses[step.id];
          const isActive = step.id === currentId;
          const label = STEP_LABELS[step.id] ?? step.title;
          const shortLabel = SHORT_LABELS[step.id] ?? label;
          return (
            <button
              key={step.id}
              type="button"
              className="cv-step-seg"
              onClick={() => onStepClick(step.id)}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${label} — ${stateText(status, isActive)}`}
              title={label}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 5,
                padding: "2px 0 0",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span
                className="cv-step-seg-bar"
                style={{
                  display: "block",
                  height: 7,
                  borderRadius: 999,
                  background: segColor(status, isActive),
                  boxShadow: isActive ? "0 0 0 3px var(--ff-line)" : undefined,
                  transition: "background 200ms ease",
                }}
              />
              <span
                className="cv-step-seg-label"
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  lineHeight: 1,
                  fontWeight: isActive ? 800 : 600,
                  // Untouched steps share --ff-muted with done ones (faint was
                  // ~2.3:1); state stays distinguishable via the segment bar
                  // colors, the tooltip, and the aria-label state text.
                  color: isActive
                    ? "var(--ff-ink)"
                    : status === "attention"
                      ? "var(--ff-warn)"
                      : "var(--ff-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        .cv-step-seg:hover .cv-step-seg-bar { filter: brightness(0.92); }
        .cv-step-seg:focus-visible {
          outline: 2px solid var(--ff-accent);
          outline-offset: 3px;
          border-radius: 6px;
        }
        @media (max-width: 639.98px) {
          .cv-step-seg-label { display: none !important; }
          /* With labels hidden each segment collapses to ~9px tall — an
             invisible vertical hit extension restores a ~45px tap target
             (audit UI-5 floor) with zero layout shift. Vertical-only so
             neighbouring segments (5px gaps) never overlap. */
          .cv-step-seg { position: relative; }
          .cv-step-seg::before { content: ""; position: absolute; inset: -18px 0; }
        }
      `}</style>
    </div>
  );
};
