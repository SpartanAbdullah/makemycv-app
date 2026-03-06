"use client";

import type { BuilderStep } from "../../lib/utils/steps";
import type { StepStatus } from "./Stepper";

export const CompactStepper = ({
  steps,
  statuses,
  currentId,
  onStepClick,
}: {
  steps: BuilderStep[];
  statuses: Record<string, StepStatus>;
  currentId: string;
  onStepClick: (id: BuilderStep["id"]) => void;
}) => (
  <nav
    aria-label="CV builder steps"
    className="flex flex-col gap-0.5 p-2"
  >
    {steps.map((step, index) => {
      const status = statuses[step.id];
      const isActive = step.id === currentId;
      const isLocked = status === "locked";
      const isDone = status === "done";

      return (
        <button
          key={step.id}
          type="button"
          disabled={isLocked}
          onClick={() => !isLocked && onStepClick(step.id)}
          aria-current={isActive ? "step" : undefined}
          aria-disabled={isLocked}
          className={[
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
            isActive
              ? "bg-slate-100"
              : isLocked
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-slate-50",
          ].join(" ")}
        >
          {/* Status indicator */}
          <span
            className={[
              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              isDone
                ? "bg-emerald-500 text-white"
                : isActive
                ? "bg-slate-900 text-white"
                : isLocked
                ? "bg-slate-200 text-slate-400"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}
            aria-hidden="true"
          >
            {isDone ? "✓" : index + 1}
          </span>

          {/* Label */}
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-xs font-medium ${
                isActive ? "text-slate-900" : "text-slate-600"
              }`}
            >
              {step.title}
            </p>
            {!isDone && !isLocked && step.required && (
              <p className="text-[10px] text-slate-400">Required</p>
            )}
          </div>
        </button>
      );
    })}
  </nav>
);
