"use client";

import Link from "next/link";
import { builderSteps } from "../../../lib/utils/steps";
import { getStepCompletion } from "../../../lib/utils/stepValidation";
import { useCvStore } from "../../../lib/store/cvStore";
import { NavigationButtons } from "../NavigationButtons";

export const ReviewStep = ({
  onBack,
  onJump,
}: {
  onBack: () => void;
  onJump: (stepId: string) => void;
}) => {
  const data = useCvStore((state) => state.data);
  const incomplete = builderSteps.filter(
    (step) => step.id !== "review" && !getStepCompletion(step, data)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-2xl">Review & Finish</h2>
        <p className="mt-2 text-sm text-slate-500">
          Spot any missing sections, then choose a template or export.
        </p>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700">Missing sections</h3>
          {incomplete.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-600">All required steps are complete.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {incomplete.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onJump(step.id)}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700"
                >
                  {step.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Link
            href="/templates"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            Choose a template
          </Link>
          <Link
            href="/preview"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            Full-screen preview
          </Link>
          <Link
            href="/export"
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
          >
            Export PDF
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Double-check spacing and keep content within one page.
        </div>
      </section>

      <NavigationButtons onBack={onBack} nextLabel="All set" />
    </div>
  );
};
