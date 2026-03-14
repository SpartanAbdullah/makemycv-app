"use client";

import { useState } from "react";
import { builderSteps } from "../../../lib/utils/steps";
import { getStepCompletion } from "../../../lib/utils/stepValidation";
import { useCvStore } from "../../../lib/store/cvStore";
import { NavigationButtons } from "../NavigationButtons";
import { exportToDocx } from "../../../lib/utils/docxExport";
import { downloadCV } from "../../../hooks/useDownloadCV";
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
      await downloadCV(data, isPro ? "pro" : "free", data.settings.templateId ?? "classic");
    } catch {
      setDownloadError("pdf-failed");
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
      {/* Heading */}
      <div>
        <h2 className="cv-step-heading">Your CV is ready.</h2>
        <p className="cv-step-subtitle">
          Review it on the right, then download or export below.
        </p>
      </div>

      {/* Missing sections warning */}
      {incomplete.length > 0 && (
        <div style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid #FDE68A",
          background: "#FFFBEB",
          padding: 16,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Missing sections</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incomplete.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onJump(step.id)}
                style={{
                  borderRadius: 20,
                  border: "1px solid #FDE68A",
                  background: "white",
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#92400E",
                  cursor: "pointer",
                  transition: "background var(--transition-fast)",
                }}
              >
                {step.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Download Actions */}
      <div className="cv-step-card">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="cv-btn-primary"
          style={{ width: "100%", padding: "16px 24px", fontSize: 15 }}
        >
          {isDownloading ? (
            <>
              <span style={{
                width: 16, height: 16,
                border: "2px solid white",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 1s linear infinite",
              }} />
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
        {downloadError === "pdf-failed" && (
          <div style={{
            marginTop: 12,
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
          }}>
            <p style={{ fontSize: 13, color: "#B91C1C", fontWeight: 500 }}>
              PDF download failed. Please try again or export as Word below.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleExportDocx}
          className="cv-btn-secondary"
          style={{ width: "100%", marginTop: 12, padding: "14px 24px", fontSize: 15 }}
        >
          {"\uD83D\uDCC4"} Export as Word (.docx)
        </button>
        <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", marginTop: 12 }}>
          PDF is best for job applications. DOCX is editable.
        </p>
      </div>

      {/* Template Selector */}
      <div>
        <p className="cv-label" style={{ marginBottom: 12, marginTop: 24 }}>
          Choose Template
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleTemplateChange(tmpl.id)}
              className="cv-entry-card"
              style={{
                cursor: "pointer",
                borderWidth: 2,
                borderColor: currentTemplateId === tmpl.id ? "var(--brand-primary)" : undefined,
                background: currentTemplateId === tmpl.id ? "var(--brand-primary-s)" : undefined,
              }}
            >
              <div className="flex flex-col items-center p-3 h-full">
                {/* Thumbnail zone — fixed height */}
                <div className="flex items-center justify-center w-full mb-3" style={{ height: 160 }}>
                  <tmpl.Thumbnail />
                </div>

                {/* Name */}
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", margin: 0, textAlign: "center" }}>
                  {tmpl.name}
                </p>

                {/* Badge */}
                {tmpl.badge && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#059669",
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    borderRadius: 4,
                    padding: "1px 5px",
                    letterSpacing: "0.04em",
                    lineHeight: 1.5,
                    whiteSpace: "nowrap" as const,
                    marginTop: 4,
                  }}>
                    {tmpl.badge}
                  </span>
                )}

                {/* Description — clamped to 2 lines */}
                <p className="line-clamp-2" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4, textAlign: "center", lineHeight: 1.4 }}>
                  {tmpl.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pro Plan Gate */}
      {!isPro && (
        <div style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-soft)",
          background: "linear-gradient(135deg, var(--surface-sunken), var(--brand-primary-s))",
          padding: 24,
        }}>
          <div className="flex items-start gap-3">
            <div style={{
              flexShrink: 0,
              marginTop: 2,
              width: 32, height: 32,
              borderRadius: "50%",
              background: "rgba(79,70,229,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "var(--brand-primary)", fontSize: 14, fontWeight: 700 }}>P</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>Upgrade to Pro</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Remove the watermark, unlock all templates, and export
                unlimited CVs with priority support.
              </p>
              <button
                type="button"
                className="cv-btn-primary"
                style={{ marginTop: 12, fontSize: 12, padding: "8px 16px" }}
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
