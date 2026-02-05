import { BuilderStep } from "../../lib/utils/steps";

export type StepStatus = "done" | "active" | "incomplete" | "locked";

export const Stepper = ({
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
  <nav className="space-y-3">
    {steps.map((step, index) => {
      const status = statuses[step.id];
      const isActive = step.id === currentId;
      const statusColor =
        status === "done"
          ? "bg-emerald-500"
          : status === "active"
            ? "bg-slate-900"
            : status === "locked"
              ? "bg-slate-200"
              : "bg-amber-400";

      return (
        <button
          key={step.id}
          type="button"
          disabled={status === "locked"}
          onClick={() => onStepClick(step.id)}
          className={`w-full rounded-xl border px-3 py-2 text-left transition hover:border-slate-300 ${
            isActive ? "border-slate-400 bg-white" : "border-slate-200 bg-white/70"
          } ${status === "locked" ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs text-white ${statusColor}`}
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {step.title}
              </p>
              <p className="text-xs text-slate-400">
                {step.required ? "Required" : "Optional"}
              </p>
            </div>
          </div>
        </button>
      );
    })}
  </nav>
);
