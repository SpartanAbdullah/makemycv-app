"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StepStatus } from "./Stepper";
import { builderSteps, totalSteps } from "../../lib/utils/steps";
import { getStepCompletion } from "../../lib/utils/stepValidation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { PreviewPanel } from "../preview/PreviewPanel";
import { clearCvStorage } from "../../lib/utils/localStorage";
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

  const handleStepClick = (id: string) => {
    const index = builderSteps.findIndex((step) => step.id === id);
    const allowed = builderSteps
      .slice(0, index)
      .filter((step) => step.required)
      .every((step) => getStepCompletion(step, data));
    if (allowed) onStepChange(id);
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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Top bar: logo + dot stepper ── */}
      <header className="flex-shrink-0 border-b border-slate-100 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <Link href="/" className="flex-shrink-0">
            <span className="font-display text-lg font-semibold text-slate-900">
              MakeMyCV
            </span>
          </Link>

          {/* Dot stepper — desktop */}
          <nav
            className="hidden sm:flex items-center gap-0.5"
            aria-label="CV builder steps"
          >
            {builderSteps.map((step, i) => {
              const status = statuses[step.id];
              const isActive = step.id === stepId;
              const isDone = status === "done";
              const isLocked = status === "locked";

              return (
                <Fragment key={step.id}>
                  {i > 0 && (
                    <div
                      className={`h-px w-4 md:w-6 transition-colors ${
                        isDone ? "bg-blue-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleStepClick(step.id)}
                    title={step.title}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={step.title}
                    className={[
                      "h-2.5 w-2.5 rounded-full transition-all",
                      isActive
                        ? "bg-blue-600 ring-[3px] ring-blue-600/20 scale-125"
                        : isDone
                        ? "bg-blue-600"
                        : "bg-slate-300",
                      isLocked
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer hover:scale-125",
                    ].join(" ")}
                  />
                </Fragment>
              );
            })}
          </nav>

          {/* Mobile: step counter */}
          <p className="text-sm text-slate-400 sm:hidden">
            Step {builderSteps.findIndex((s) => s.id === stepId) + 1} / {totalSteps}
          </p>

          {/* Right spacer to keep dots centred */}
          <div className="w-[72px]" />
        </div>
      </header>

      {/* ── Split content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: form (~55%) */}
        <div className="flex w-full flex-col overflow-hidden bg-white lg:w-[55%]">
          <div className="flex-1 overflow-y-auto">
            {!hydrated && (
              <div className="px-6 py-8 text-sm text-slate-400 lg:px-10">
                Loading your saved CV...
              </div>
            )}

            <div className="px-6 py-6 lg:px-10 lg:py-8">
              {children}
            </div>
          </div>

          {/* Bottom: subtle reset */}
          <div className="flex-shrink-0 border-t border-slate-100 px-6 py-2 lg:px-10">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-300 hover:text-red-500 transition-colors"
            >
              Reset CV
            </button>
          </div>
        </div>

        {/* Right panel: live preview (~45%, dark) */}
        <div className="hidden lg:flex lg:w-[45%] flex-col overflow-hidden bg-[#1a1a2e]">
          <div className="flex-shrink-0 px-6 py-3">
            <p className="text-[11px] uppercase tracking-widest text-white/30">
              Preview
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <PreviewPanel sticky={false} />
          </div>
        </div>
      </div>

      {/* ── Mobile: floating preview button ── */}
      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#1a1a2e] px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          Preview CV
        </button>
      </div>

      {/* ── Mobile: preview overlay ── */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#1a1a2e] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="CV preview"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-display text-lg font-semibold text-white">Preview</p>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="text-sm text-slate-400 underline"
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
              Parsing {importState.source}...
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
