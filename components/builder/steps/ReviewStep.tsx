"use client";

import { useState } from "react";
import { builderSteps } from "../../../lib/utils/steps";
import { getStepCompletion } from "../../../lib/utils/stepValidation";
import { useCvStore } from "../../../lib/store/cvStore";
import { NavigationButtons } from "../NavigationButtons";
import { exportToDocx } from "../../../lib/utils/docxExport";
import { exportCvToPdf } from "../../../lib/utils/pdfExport";
import { templates } from "../../../lib/templates";

export const ReviewStep = ({
  onBack,
  onJump,
}: {
  onBack: () => void;
  onJump: (stepId: string) => void;
}) => {
  const data = useCvStore((state) => state.data);
  const updateSection = useCvStore((state) => state.updateSection);
  const currentTemplateId = data.settings.templateId;
  const [isPro] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleExportDocx = () => exportToDocx(data);
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const firstName = data?.personal?.firstName ?? "my";
      const lastName = data?.personal?.lastName ?? "cv";
      const filename = `${firstName}-${lastName}-cv.pdf`
        .toLowerCase()
        .replace(/\s+/g, "-");
      await exportCvToPdf("cv-preview-root", filename);
    } catch (err) {
      console.error("PDF export failed:", err);
      setDownloadError(
        "PDF export failed. Please try again or use Export as Word instead."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTemplateChange = (id: string) => {
    updateSection("settings", { ...data.settings, templateId: id });
  };

  const incomplete = builderSteps.filter(
    (step) => step.id !== "review" && !getStepCompletion(step, data),
  );

  return (
    <div className="space-y-6">
      {/* Section 1 — Completion header */}
      <div>
        <h2 className="font-bold text-3xl text-slate-800">Your CV is ready.</h2>
        <p className="text-sm text-slate-500 mt-2">
          Review it on the right, then download or export below.
        </p>
      </div>

      {/* Missing sections warning */}
      {incomplete.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Missing sections</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incomplete.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onJump(step.id)}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                {step.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section 2 — Download Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base py-4 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-blue-200"
        >
          {isDownloading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Preparing PDF...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download CV as PDF
            </>
          )}
        </button>
        {downloadError && (
          <p className="text-xs text-red-500 text-center mt-2">{downloadError}</p>
        )}
        <button
          type="button"
          onClick={handleExportDocx}
          className="mt-3 w-full border border-slate-300 bg-white text-slate-700 font-semibold text-base py-3.5 rounded-xl hover:bg-slate-50 transition-colors"
        >
          {"\uD83D\uDCC4"} Export as Word (.docx)
        </button>
        <p className="text-xs text-slate-400 text-center mt-3">
          PDF is best for job applications. DOCX is editable.
        </p>
      </div>

      {/* Section 3 — Template Selector */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3 mt-6">
          Choose Template
        </p>
        <div className="flex flex-row gap-3">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleTemplateChange(tmpl.id)}
              className={`rounded-xl border-2 cursor-pointer p-3 text-center transition-all w-full ${
                currentTemplateId === tmpl.id
                  ? "border-[#2563eb] bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <tmpl.Thumbnail />
              <p className="text-sm font-semibold text-slate-700 mt-2">{tmpl.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{tmpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Section 4 — Pro Plan Gate */}
      {!isPro && (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-full bg-[#2563eb]/10 flex items-center justify-center">
              <span className="text-[#2563eb] text-sm font-bold">P</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Upgrade to Pro</p>
              <p className="text-xs text-slate-500 mt-1">
                Remove the watermark, unlock all templates, and export
                unlimited CVs with priority support.
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      )}

      <NavigationButtons onBack={onBack} />
    </div>
  );
};
