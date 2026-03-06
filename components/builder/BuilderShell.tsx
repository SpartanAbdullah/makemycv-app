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

const STEP_LABELS: Record<string, string> = {
  personal: "CONTACT",
  summary: "ABOUT",
  experience: "EXPERIENCE",
  education: "EDUCATION",
  skills: "SKILLS",
  languages: "LANGUAGES",
  certifications: "CERTIFICATIONS",
  projects: "PROJECTS",
  review: "FINISH IT",
};

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
    if (statuses[id] === "done") onStepChange(id);
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

  const currentStep = builderSteps.find((s) => s.id === stepId);
  const stepIndex = builderSteps.findIndex((s) => s.id === stepId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f0f0f0]">
      {/* ── Header ── */}
      <header className="flex-shrink-0 h-14 border-b border-slate-200 bg-white">
        <div className="flex h-full items-center px-4">
          {/* Left: logo */}
          <div className="w-36 flex-shrink-0">
            <Link href="/">
              <span className="font-display text-lg font-bold text-slate-900">
                MakeMyCV
              </span>
            </Link>
          </div>

          {/* Centre: horizontal step progress bar */}
          <nav
            className="hidden lg:flex flex-1 items-center justify-center"
            aria-label="CV builder steps"
          >
            <div className="flex items-end gap-0">
              {builderSteps.map((step, i) => {
                const status = statuses[step.id];
                const isActive = step.id === stepId;
                const isDone = status === "done";
                const isLocked = status === "locked";
                return (
                  <Fragment key={step.id}>
                    {/* Connector line between dots */}
                    {i > 0 && (
                      <div className="flex items-center pb-[7px]">
                        <div
                          className={`h-[3px] w-7 rounded-sm ${
                            statuses[builderSteps[i - 1].id] === "done"
                              ? "bg-[#2563eb]"
                              : "bg-[#e2e8f0]"
                          }`}
                        />
                      </div>
                    )}

                    {/* Step column: label + dot + underline */}
                    <button
                      type="button"
                      disabled={!isDone}
                      onClick={() => isDone && handleStepClick(step.id)}
                      className={`flex flex-col items-center gap-1 px-1 ${
                        isDone ? "cursor-pointer" : "cursor-default"
                      }`}
                      aria-current={isActive ? "step" : undefined}
                      aria-label={step.title}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-widest leading-none ${
                          isActive
                            ? "text-[#2563eb]"
                            : isDone
                            ? "text-[#64748b]"
                            : "text-[#94a3b8]"
                        }`}
                      >
                        {STEP_LABELS[step.id] ?? step.title}
                      </span>
                      <div
                        className={`rounded-full ${
                          isActive
                            ? "h-3.5 w-3.5 bg-[#2563eb]"
                            : isDone
                            ? "h-2.5 w-2.5 bg-[#2563eb]"
                            : "h-2 w-2 bg-[#cbd5e1]"
                        }`}
                      />
                      {isActive && (
                        <div className="h-0.5 w-6 rounded-full bg-[#2563eb]" />
                      )}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </nav>

          {/* Right: Import / Export */}
          <div className="w-36 flex-shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => handleImport("pdf")}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Import
            </button>
            <Link
              href="/preview?print=1&autoprint=1"
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Export
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: form */}
        <div className="flex w-full flex-col overflow-hidden bg-[#f0f0f0] lg:w-[55%]">
          {/* Mobile: step name bar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
            <p className="text-sm font-medium text-slate-700">
              {currentStep?.title}
            </p>
            <p className="text-xs text-slate-400">
              Step {stepIndex + 1} / {totalSteps}
            </p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {!hydrated && (
              <div className="px-6 py-8 text-sm text-slate-400">
                Loading your saved CV...
              </div>
            )}

            <div className="mx-auto max-w-2xl px-6 py-8">
              {children}
            </div>
          </div>

          {/* Bottom: reset */}
          <div className="flex-shrink-0 px-6 py-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Reset CV
            </button>
          </div>
        </div>

        {/* Right panel: preview (dark) */}
        <div className="hidden lg:flex lg:flex-1 flex-col overflow-hidden bg-[#3a3a3a]">
          <div className="flex-shrink-0 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              PREVIEW
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-6">
            <div className="rounded-xl bg-white shadow-2xl">
              <PreviewPanel sticky={false} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: floating preview button ── */}
      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#3a3a3a] px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          Preview CV
        </button>
      </div>

      {/* ── Mobile: preview overlay ── */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#3a3a3a] lg:hidden"
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
            <div className="rounded-xl bg-white shadow-2xl">
              <PreviewPanel sticky={false} onToggle={() => setPreviewOpen(false)} />
            </div>
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
