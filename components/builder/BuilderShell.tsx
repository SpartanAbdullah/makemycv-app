"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StepStatus } from "./Stepper";
import { builderSteps } from "../../lib/utils/steps";
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

const STEP_META: Record<string, { icon: string; label: string; sublabel: string }> = {
  personal:       { icon: "👤", label: "Contact",        sublabel: "Name, email, phone" },
  summary:        { icon: "✍️", label: "Summary",        sublabel: "Professional bio" },
  experience:     { icon: "💼", label: "Experience",     sublabel: "Work history" },
  education:      { icon: "🎓", label: "Education",      sublabel: "Degrees & diplomas" },
  skills:         { icon: "⚡", label: "Skills",         sublabel: "Your expertise" },
  languages:      { icon: "🌐", label: "Languages",      sublabel: "Spoken languages" },
  certifications: { icon: "🏅", label: "Certifications", sublabel: "Credentials" },
  projects:       { icon: "📁", label: "Projects",       sublabel: "Standout work" },
  review:         { icon: "✅", label: "Review",          sublabel: "Download & export" },
};

const PreviewOverlay = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 794,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>Preview</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            color: "white",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
      <div
        style={{
          width: 794,
          maxWidth: "100%",
          minHeight: 1123,
          backgroundColor: "white",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          borderRadius: 4,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <PreviewPanel sticky={false} />
      </div>
    </div>
  );
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
  const resetStore = useCvStore((state) => state.reset);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const doneCount = builderSteps.filter((s) => statuses[s.id] === "done").length;
  const totalSteps = builderSteps.length;
  const currentStepIndex = builderSteps.findIndex((s) => s.id === stepId);

  const handleStepClick = (id: string) => {
    if (statuses[id] === "done") onStepChange(id);
  };

  const handleReset = () => {
    if (!confirm("Reset your CV data? This cannot be undone.")) return;
    resetStore();
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
        setErrorMsg(`Could not parse ${source}. Please check the file and try again.`);
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
      setErrorMsg("Could not parse LinkedIn profile text. Please paste the full profile text.");
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
    <div
      style={{
        display: "flex",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
        background: "var(--surface-page)",
      }}
    >
      {/* ═══ SIDEBAR ═══ */}
      <aside
        className="hidden lg:flex"
        style={{
          width: "var(--sidebar-w)",
          flexShrink: 0,
          background: "var(--sidebar-bg)",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Logo area */}
        <div
          style={{
            padding: "0 20px",
            height: 64,
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #1E293B",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #4F46E5, #6366F1)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
              marginRight: 10,
              flexShrink: 0,
            }}
          >
            M
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "white",
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              MakeMyCV
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#475569",
                letterSpacing: "0.04em",
                textTransform: "uppercase" as const,
              }}
            >
              UAE Builder
            </div>
          </div>
        </div>

        {/* Step navigation */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 8px",
            position: "relative",
          }}
        >
          {/* Progress summary */}
          <div
            style={{
              padding: "0 8px 16px",
              borderBottom: "1px solid #1E293B",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
                color: "#334155",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Your Progress
            </div>
            <div
              style={{
                height: 4,
                background: "#1E293B",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(doneCount / totalSteps) * 100}%`,
                  background: "linear-gradient(90deg, #4F46E5, #6366F1)",
                  borderRadius: 4,
                  transition: "width 400ms cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              {doneCount} of {totalSteps} steps complete
            </div>
          </div>

          {/* Nav items */}
          {builderSteps.map((step, idx) => {
            const status = statuses[step.id];
            const isActive = step.id === stepId;
            const isDone = status === "done";
            const meta = STEP_META[step.id];

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 16px",
                  background: isActive
                    ? "rgba(79,70,229,0.18)"
                    : "transparent",
                  border: "none",
                  borderRadius: 10,
                  cursor: isDone || isActive ? "pointer" : "default",
                  textAlign: "left" as const,
                  transition: "background 150ms ease",
                  marginBottom: 2,
                  position: "relative" as const,
                }}
              >
                {/* Icon block */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    background: isActive
                      ? "rgba(99,102,241,0.25)"
                      : isDone
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(255,255,255,0.04)",
                    flexShrink: 0,
                    transition: "background 150ms ease",
                  }}
                >
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 7L5.5 10L11.5 4"
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span style={{ fontSize: 15 }}>{meta?.icon}</span>
                  )}
                </div>

                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#FFFFFF" : isDone ? "#94A3B8" : "#475569",
                      lineHeight: 1.2,
                      transition: "color 150ms ease",
                    }}
                  >
                    {meta?.label}
                  </div>
                  {isActive && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#6366F1",
                        marginTop: 2,
                        lineHeight: 1,
                      }}
                    >
                      {meta?.sublabel}
                    </div>
                  )}
                </div>

                {/* Step number badge (inactive incomplete) */}
                {!isDone && !isActive && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#475569",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                )}

                {/* Active indicator bar */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute" as const,
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: 24,
                      background: "#6366F1",
                      borderRadius: "0 3px 3px 0",
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1E293B",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => handleImport("pdf")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #1E293B",
              borderRadius: 8,
              cursor: "pointer",
              color: "#64748B",
              fontSize: 12,
              fontWeight: 500,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "#94A3B8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#64748B";
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import CV
          </button>

          <button
            type="button"
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              color: "#475569",
              fontSize: 11,
              fontWeight: 500,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#EF4444";
              e.currentTarget.style.background = "rgba(239,68,68,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#475569";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
            </svg>
            Reset CV
          </button>
        </div>
      </aside>

      {/* ═══ FORM AREA ═══ */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-page)",
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        {/* Error bar */}
        {errorMsg && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#FEF2F2",
              borderBottom: "1px solid #FECACA",
              padding: "10px 24px",
            }}
          >
            <p style={{ fontSize: 13, color: "#B91C1C", fontWeight: 500 }}>{errorMsg}</p>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{
                background: "none",
                border: "none",
                color: "#F87171",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
                marginLeft: 16,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Mobile step indicator */}
        <div
          className="lg:hidden"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            background: "var(--surface-card)",
            borderBottom: "1px solid var(--border-soft)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "white",
              }}
            >
              M
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-heading)",
              }}
            >
              {STEP_META[stepId]?.label}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            Step {currentStepIndex + 1} / {totalSteps}
          </span>
        </div>

        {/* Thin progress bar (mobile only) */}
        <div
          className="lg:hidden"
          style={{ height: 2, background: "var(--border-soft)" }}
        >
          <div
            style={{
              height: "100%",
              width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
              background: "linear-gradient(90deg, #4F46E5, #6366F1)",
              transition: "width 400ms ease",
            }}
          />
        </div>

        {/* Scrollable form content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!hydrated && (
            <div style={{ padding: "32px 48px", fontSize: 14, color: "var(--text-faint)" }}>
              Loading your saved CV...
            </div>
          )}
          <div
            style={{
              padding: "40px 16px",
              maxWidth: "100%",
              width: "100%",
            }}
            className="sm:!px-6"
          >
            {children}
          </div>
        </div>
      </main>

      {/* ═══ PREVIEW PANEL ═══ */}
      <aside
        className="hidden xl:flex"
        style={{
          width: 400,
          flexShrink: 0,
          background: "#0A0F1A",
          borderLeft: "1px solid #1A2233",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Preview header */}
        <div
          style={{
            padding: "0 20px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1A2233",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#334155",
            }}
          >
            Live Preview
          </div>
        </div>

        {/* Scrollable preview area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 12,
          }}
        >
          <div
            style={{
              width: "100%",
              overflow: "hidden",
              position: "relative",
              height: Math.round(1123 * (376 / 794)),
            }}
          >
            <div
              style={{
                width: 794,
                transformOrigin: "top left",
                transform: `scale(${376 / 794})`,
                background: "white",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              <PreviewPanel sticky={false} />
            </div>
          </div>
        </div>
      </aside>

      {/* ═══ Mobile: floating preview button ═══ */}
      <button
        type="button"
        className="xl:hidden"
        onClick={() => setPreviewOpen(true)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 50,
          background: "var(--brand-primary)",
          color: "white",
          border: "none",
          borderRadius: 50,
          padding: "12px 20px",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 20px rgba(79,70,229,0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Preview CV
      </button>

      {/* ═══ Mobile: preview overlay ═══ */}
      {previewOpen && (
        <PreviewOverlay onClose={() => setPreviewOpen(false)} />
      )}

      {/* ═══ Import overlays ═══ */}
      {importState.phase === "parsing" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-overlay)",
          }}
        >
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-soft)",
              padding: "32px 40px",
              textAlign: "center" as const,
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "4px solid var(--border-soft)",
                borderTopColor: "var(--brand-primary)",
                borderRadius: "50%",
                margin: "0 auto 12px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-body)" }}>
              Parsing {importState.source}...
            </p>
          </div>
        </div>
      )}

      {importState.phase === "linkedin-input" && (
        <LinkedInImportModal
          onSubmit={handleLinkedInSubmit}
          onCancel={() => setImportState({ phase: "idle" })}
        />
      )}

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
