"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper, StepStatus } from "./Stepper";
import { builderSteps, totalSteps } from "../../lib/utils/steps";
import { getStepCompletion } from "../../lib/utils/stepValidation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { PreviewPanel } from "../preview/PreviewPanel";
import { clearCvStorage, exportCvJson, importCvJson } from "../../lib/utils/localStorage";

export const BuilderShell = ({
  stepId,
  children,
  onStepChange,
}: {
  stepId: string;
  children: React.ReactNode;
  onStepChange: (stepId: string) => void;
}) => {
  const router = useRouter();
  const data = useCvStore((state) => state.data);
  const hydrated = useCvStore((state) => state.hydrated);
  const setData = useCvStore((state) => state.setData);
  const reset = useCvStore((state) => state.reset);

  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    bindCvStorage();
  }, []);

  const statuses = useMemo(() => {
    const result: Record<string, StepStatus> = {};
    builderSteps.forEach((step, index) => {
      const completion = getStepCompletion(step, data);
      const previousRequiredValid = builderSteps
        .slice(0, index)
        .filter((prev) => prev.required)
        .every((prev) => getStepCompletion(prev, data));

      if (step.id === stepId) {
        result[step.id] = "active";
      } else if (completion) {
        result[step.id] = "done";
      } else if (step.required) {
        result[step.id] = previousRequiredValid ? "incomplete" : "locked";
      } else {
        result[step.id] = "incomplete";
      }
    });
    return result;
  }, [data, stepId]);

  const handleStepClick = (id: string) => {
    const index = builderSteps.findIndex((step) => step.id === id);
    const allowed = builderSteps
      .slice(0, index)
      .filter((step) => step.required)
      .every((step) => getStepCompletion(step, data));
    if (allowed) onStepChange(id);
  };

  const handleExportJson = () => {
    const blob = new Blob([exportCvJson(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cv-data.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = importCvJson(text);
      if (parsed) {
        setData(parsed);
      } else {
        alert("Invalid JSON file.");
      }
    };
    input.click();
  };

  const handleReset = () => {
    if (!confirm("Reset your CV data? This cannot be undone.")) return;
    reset();
    clearCvStorage();
    router.push("/builder?step=personal");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f8f6f2)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              CV Builder
            </p>
            <h1 className="font-display text-3xl font-semibold text-slate-900">
              Build your resume step by step
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleImportJson}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              Import JSON
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
            >
              Reset CV
            </button>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr_380px]">
          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Progress
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Step {builderSteps.findIndex((step) => step.id === stepId) + 1} of {totalSteps}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <Stepper
                steps={builderSteps}
                statuses={statuses}
                currentId={stepId}
                onStepClick={handleStepClick}
              />
            </div>
          </aside>

          <main className="space-y-6">
            {!hydrated && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Loading your saved CV...
              </div>
            )}
            {children}
          </main>

          <aside className="hidden lg:block">
            <PreviewPanel />
          </aside>
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center lg:hidden">
        <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setPreviewOpen((prev) => !prev)}
            className="text-sm"
          >
            {previewOpen ? "Hide Preview" : "Show Preview"}
          </button>
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white p-4 lg:hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Live Preview</h2>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="text-sm text-slate-500 underline"
            >
              Close
            </button>
          </div>
          <PreviewPanel sticky={false} onToggle={() => setPreviewOpen(false)} />
        </div>
      )}
    </div>
  );
};
