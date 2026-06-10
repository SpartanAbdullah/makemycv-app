"use client";

import { useEffect, useRef } from "react";
import type { BuilderStep } from "../../lib/utils/steps";
import type { StepStatus } from "./Stepper";
import { Icon } from "./Icon";

type Props = {
  steps: BuilderStep[];
  statuses: Record<string, StepStatus>;
  currentId: string;
  onStepClick: (id: BuilderStep["id"]) => void;
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

/**
 * Horizontal step-bead strip. Replaces the legacy dark sidebar Stepper. Beads
 * are pill-shaped: future steps render outlined and muted, done steps render
 * filled-soft with an accent check, the active step renders solid black.
 *
 * Every bead navigates (audit UX-1) — done, incomplete, and future steps
 * alike. The bead styling stays honest about completion state; navigation
 * freedom is the point (skipped steps used to be unreachable except by
 * walking Back one step at a time).
 *
 * The strip hides its scrollbar, so on narrow viewports the active bead can
 * sit off-screen with nothing signalling more content — we scroll it into
 * view whenever the step changes (audit PERF-7).
 */
export const StepBeads = ({ steps, statuses, currentId, onStepClick }: Props) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentId]);

  return (
    <div
      className="cv-bead-strip"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
      aria-label="CV builder progress"
      role="navigation"
    >
      {steps.map((step, i) => {
        const status = statuses[step.id];
        const isActive = step.id === currentId;
        const isDone = status === "done";
        const isLocked = status === "locked";
        const label = STEP_LABELS[step.id] ?? step.title;
        const beadClass = isActive
          ? "cv-bead cv-bead-active"
          : isDone
            ? "cv-bead cv-bead-done"
            : isLocked
              ? "cv-bead cv-bead-locked"
              : "cv-bead cv-bead-future";

        const dotClass = isActive
          ? "cv-bead-dot cv-bead-dot-active"
          : isDone
            ? "cv-bead-dot cv-bead-dot-done"
            : "cv-bead-dot cv-bead-dot-future";

        return (
          <div
            key={step.id}
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <button
              type="button"
              ref={isActive ? activeRef : undefined}
              className={beadClass}
              onClick={() => onStepClick(step.id)}
              aria-current={isActive ? "step" : undefined}
              title={label}
            >
              <span className={dotClass}>
                {isDone ? (
                  <Icon name="check" size={9} strokeWidth={3} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <span>{label}</span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 1,
                  background: "var(--ff-line)",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
