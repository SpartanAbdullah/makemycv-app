"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StepStatus } from "./Stepper";
import { CompactStepper } from "./CompactStepper";
import { BuilderHeader } from "./BuilderHeader";
import { builderSteps, totalSteps } from "../../lib/utils/steps";
import { getStepCompletion } from "../../lib/utils/stepValidation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { PreviewPanel } from "../preview/PreviewPanel";
import { clearCvStorage } from "../../lib/utils/localStorage";
import { exportToDocx } from "../../lib/utils/docxExport";
import { MappingReview } from "../import/MappingReview";
import { LinkedInImportModal } from "../import/LinkedInImportModal";
import { pdfAdapter } from "../../lib/importers/pdfAdapter";
import { docxAdapter } from "../../lib/importers/docxAdapter";
import { linkedinAdapter } from "../../lib/importers/linkedinAdapter";
import type { ParsedDocument } from "../../lib/importers/adapter";
import type { CvData } from "../../lib/types/cv";

type ImportType = "pdf" | "docx" | "linkedin";

type ImportState =
  | { phase: "idle" }
  | { phase: "parsing"; source: string }
  | { phase: "review"; source: string; parsed: ParsedDocument }
  | { phase: "linkedin-input" };

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
  const importCvVersion = useCvStore((state) => state.importCvVersion);
  const reset = useCvStore((state) => state.reset);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });

  useEffect(() => {
    bindCvStorage();
  }, []);

  // Compute step statuses for stepper
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

  // Progress percentage based on required steps completion
  const progressPct = useMemo(() => {
    const required = builderSteps.filter((s) => s.required);
    const done = required.filter((s) => getStepCompletion(s, data)).length;
    return Math.round((done / required.length) * 100);
  }, [data]);

  const currentStep = builderSteps.find((s) => s.id === stepId);
  const stepIndex = builderSteps.findIndex((s) => s.id === stepId);

  const handleStepClick = (id: string) => {
    const index = builderSteps.findIndex((step) => step.id === id);
    const allowed = builderSteps
      .slice(0, index)
      .filter((step) => step.required)
      .every((step) => getStepCompletion(step, data));
    if (allowed) onStepChange(id);
  };

  const handleExportDocx = async () => {
    await exportToDocx(data);
  };

  const handleReset = () => {
    if (!confirm("Reset your CV data? This cannot be undone.")) return;
    reset();
    clearCvStorage();
    router.push("/builder?step=personal");
  };

  // ---- Import flow ----

  const triggerFileInput = (accept: string, onFile: (file: File) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) onFile(file);
    };
    input.click();
  };

  const handleImport = async (type: ImportType) => {
    if (type === "linkedin") {
      setImportState({ phase: "linkedin-input" });
      return;
    }

    const accept = type === "pdf" ? ".pdf,application/pdf" : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const source = type === "pdf" ? "PDF" : "DOCX";
    const adapter = type === "pdf" ? pdfAdapter : docxAdapter;

    triggerFileInput(accept, async (file) => {
      setImportState({ phase: "parsing", source });
      try {
        const parsed = await adapter.parse(file);
        setImportState({ phase: "review", source, parsed });
      } catch {
        setImportState({ phase: "idle" });
        alert(`Could not parse ${source} file.`);
      }
    });
  };

  const handleLinkedInSubmit = async (text: string) => {
    setImportState({ phase: "parsing", source: "LinkedIn" });
    try {
      const parsed = await linkedinAdapter.parse(text);
      setImportState({ phase: "review", source: "LinkedIn", parsed });
    } catch {
      setImportState({ phase: "idle" });
      alert("Could not parse LinkedIn profile text.");
    }
  };

  const handleImportConfirm = (
    partial: Partial<CvData>,
    mode: "replace" | "merge",
  ) => {
    importCvVersion(partial, mode);
    setImportState({ phase: "idle" });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* ── Sticky header ── */}
      <BuilderHeader
        stepTitle={currentStep?.title ?? ""}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        progressPct={progressPct}
        onImport={handleImport}
        onExportDocx={handleExportDocx}
      />

      {/* ── Split content area (desktop) ── */}
      <div className="flex flex-1 overflow-hidden lg:divide-x lg:divide-slate-200">

        {/* ── Left panel: stepper + form ── */}
        <div className="flex w-full flex-col overflow-hidden lg:w-[42%] lg:min-w-[420px] lg:max-w-[560px]">
          {/* Compact step nav */}
          <div className="hidden lg:block flex-shrink-0 overflow-y-auto border-b border-slate-100 bg-slate-50/60 max-h-64">
            <CompactStepper
              steps={builderSteps}
              statuses={statuses}
              currentId={stepId}
              onStepClick={handleStepClick}
            />
          </div>

          {/* Mobile step progress bar label */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 lg:hidden">
            <p className="text-sm font-medium text-slate-700">
              {currentStep?.title}
            </p>
            <p className="text-xs text-slate-400">
              Step {stepIndex + 1} / {totalSteps}
            </p>
          </div>

          {/* Form area — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {!hydrated && (
              <div className="m-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Loading your saved CV…
              </div>
            )}

            <div className="px-4 py-5 space-y-5 lg:px-6">
              {children}
            </div>

            {/* Bottom reset link */}
            <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Reset CV
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel: live preview (desktop only) ── */}
        <div className="hidden lg:flex lg:flex-1 lg:min-w-[520px] lg:flex-col bg-slate-50/40">
          <div className="flex-shrink-0 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Live Preview
            </p>
            <p className="text-xs text-slate-400">Updates as you type</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PreviewPanel sticky={false} />
          </div>
        </div>
      </div>

      {/* ── Mobile: floating preview button ── */}
      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium shadow-lg backdrop-blur"
        >
          <span aria-hidden="true">👁</span> Preview CV
        </button>
      </div>

      {/* ── Mobile: preview overlay ── */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="CV preview"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="font-display text-lg font-semibold">Live Preview</p>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="text-sm text-slate-500 underline"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PreviewPanel sticky={false} onToggle={() => setPreviewOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Import: parsing indicator ── */}
      {importState.phase === "parsing" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-xl">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700 mx-auto" />
            <p className="text-sm font-medium text-slate-700">
              Parsing {importState.source}…
            </p>
          </div>
        </div>
      )}

      {/* ── Import: LinkedIn text input ── */}
      {importState.phase === "linkedin-input" && (
        <LinkedInImportModal
          onSubmit={handleLinkedInSubmit}
          onCancel={() => setImportState({ phase: "idle" })}
        />
      )}

      {/* ── Import: mapping review ── */}
      {importState.phase === "review" && (
        <MappingReview
          source={importState.source}
          parsed={importState.parsed}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportState({ phase: "idle" })}
        />
      )}
    </div>
  );
};
