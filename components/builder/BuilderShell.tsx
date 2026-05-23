"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StepStatus } from "./Stepper";
import { StepBeads } from "./StepBeads";
import { UAEDot } from "./UAEDot";
import { Icon } from "./Icon";
import { builderSteps } from "../../lib/utils/steps";
import { getStepCompletion } from "../../lib/utils/stepValidation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useUiStore } from "../../lib/store/uiStore";
import { PreviewPanel } from "../preview/PreviewPanel";
import { MappingReview } from "../import/MappingReview";
import { LinkedInImportModal } from "../import/LinkedInImportModal";
import { pdfAdapter } from "../../lib/importers/pdfAdapter";
import { docxAdapter } from "../../lib/importers/docxAdapter";
import { linkedinAdapter } from "../../lib/importers/linkedinAdapter";
import type { ParsedDocument } from "../../lib/importers/adapter";
import type { CvData } from "../../lib/types/cv";
import { UpgradeModal } from "../modals/UpgradeModal";
import { templates, getTemplateById } from "../../lib/templates";
import { downloadCV } from "../../hooks/useDownloadCV";
import { computeScore } from "../../lib/scoreEngine";
import type { ScoreReport } from "../../lib/resumeChecker/types";
import { ScoreChip } from "./ScoreChip";
import { Logo } from "../Logo";
import dynamic from "next/dynamic";

const DevResetAI = dynamic(() => import("../DevResetAI"), { ssr: false });

type ImportType = "pdf" | "docx" | "linkedin";

type ImportContextValue = {
  handleImport: (type: ImportType) => void;
};

const ImportContext = createContext<ImportContextValue | null>(null);

export const useImport = () => {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImport must be used inside BuilderShell");
  return ctx;
};

type ImportState =
  | { phase: "idle" }
  | { phase: "parsing"; source: string }
  | { phase: "review"; source: string; parsed: ParsedDocument }
  | { phase: "linkedin-input" };

/* ─── Fullscreen preview overlay (mobile + below xl) ───────── */
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
        backgroundColor: "rgba(11,15,12,0.78)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
        padding: "32px 16px",
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
          color: "white",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>
          Live preview
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 999,
            padding: "6px 14px",
            color: "white",
            fontSize: 13,
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
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <PreviewPanel sticky={false} />
      </div>
    </div>
  );
};

/* ─── TopBar — 64px, logo + autosave + score chip + actions ── */
const TopBar = ({
  cvName,
  scoreReport,
  onTemplates,
  onDownload,
  isDownloading,
}: {
  cvName: string;
  scoreReport: ScoreReport;
  onTemplates: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) => {
  // Time since last save — local to the component since it ticks every 15s.
  const [savedAgo, setSavedAgo] = useState("just now");
  useEffect(() => {
    const t = setInterval(() => {
      setSavedAgo("just now");
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        height: "var(--topbar-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        background: "var(--ff-card)",
        borderBottom: "1px solid var(--ff-line)",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Left — logo + auto-save chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <Logo variant="horizontal" height={32} />
        <div
          className="hidden md:block"
          style={{
            width: 1,
            height: 18,
            background: "var(--ff-line)",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />
        <span
          className="hidden md:inline"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ff-muted)",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {cvName} · auto-saved {savedAgo}
        </span>
      </div>

      {/* Right — score chip + templates + download */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <ScoreChip report={scoreReport} />
        <button
          type="button"
          onClick={onTemplates}
          className="hidden sm:inline-flex"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--ff-ink)",
            background: "transparent",
            border: "1px solid var(--ff-line)",
            padding: "7px 14px",
            borderRadius: 999,
            cursor: "pointer",
            alignItems: "center",
            gap: 6,
          }}
        >
          Templates
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "white",
            background: "var(--ff-ink)",
            border: "none",
            padding: "7px 16px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: isDownloading ? "wait" : "pointer",
            opacity: isDownloading ? 0.7 : 1,
            fontWeight: 500,
          }}
        >
          {isDownloading ? (
            <>
              <span
                style={{
                  width: 11,
                  height: 11,
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }}
              />
              Preparing…
            </>
          ) : (
            <>
              <Icon name="download" size={13} />
              Download
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/* ─── Right preview drawer (xl+ only) ─────────────────────── */
const PreviewDrawer = ({
  templateId,
  onPrevTemplate,
  onNextTemplate,
  onFullscreen,
  onDownload,
  isDownloading,
}: {
  templateId: string;
  onPrevTemplate: () => void;
  onNextTemplate: () => void;
  onFullscreen: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) => {
  const template = getTemplateById(templateId);
  return (
    <div
      style={{
        position: "absolute",
        right: "var(--drawer-gap)",
        // The drawer is absolute inside MAIN AREA which already sits below the
        // TopBar + ProgressBar — so we only need a small breathing gap here,
        // not the full topbar+progressbar offset (that was the old bug that
        // pushed the drawer ~134px too low).
        top: "var(--drawer-gap)",
        bottom: "var(--drawer-gap)",
        width: "var(--drawer-w)",
        background: "var(--ff-card)",
        border: "1px solid var(--ff-line)",
        borderRadius: 18,
        boxShadow: "var(--shadow-drawer)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      {/* Drawer header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--ff-line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              color: "var(--ff-ink)",
              fontWeight: 600,
            }}
          >
            Live preview
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ff-muted)",
              letterSpacing: "0.06em",
              marginTop: 2,
              textTransform: "uppercase",
            }}
          >
            {template.name} · A4 · auto-fit
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onPrevTemplate}
            aria-label="Previous template"
            style={drawerChevronBtn}
          >
            <Icon name="chevron-left" size={13} color="var(--ff-muted)" />
          </button>
          <button
            type="button"
            onClick={onNextTemplate}
            aria-label="Next template"
            style={drawerChevronBtn}
          >
            <Icon name="chevron-right" size={13} color="var(--ff-muted)" />
          </button>
        </div>
      </div>

      {/* Drawer body — scrollable CV render area */}
      <DrawerPreviewBody />

      {/* Drawer footer */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid var(--ff-line)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onFullscreen}
          style={{
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: 12.5,
            color: "var(--ff-ink)",
            background: "var(--ff-paper)",
            border: "1px solid var(--ff-line)",
            padding: "9px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Open fullscreen
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          style={{
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: 12.5,
            color: "white",
            background: "var(--ff-accent)",
            border: "none",
            padding: "9px",
            borderRadius: 8,
            fontWeight: 600,
            cursor: isDownloading ? "wait" : "pointer",
            opacity: isDownloading ? 0.7 : 1,
          }}
        >
          {isDownloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
};

/* Preview body — scales the 794-px-wide PreviewPanel to fit the drawer width
 * and uses two ResizeObservers so the outer scroll height matches the actual
 * CV content height after scaling (the CV grows past A4 height for long CVs).
 *
 *   wrapRef:    drawer body — measures available width → derives scale
 *   contentRef: inner 794-wide CV → measures rendered scrollHeight to size
 *               the spacer so the scrollbar reflects scaled content height. */
const A4_W = 794;
const DrawerPreviewBody = () => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.55);
  const [contentHeight, setContentHeight] = useState(1123);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / A4_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const h = el.scrollHeight;
      if (h > 0) setContentHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        background: "white",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: contentHeight * scale,
          position: "relative",
        }}
      >
        <div
          ref={contentRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: A4_W,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            background: "white",
          }}
        >
          <PreviewPanel sticky={false} />
        </div>
      </div>
    </div>
  );
};

const drawerChevronBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--ff-line)",
  background: "var(--ff-paper)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  padding: 0,
};

/* ─── BuilderShell ─────────────────────────────────────────── */
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
  const isPro = useCvStore((state) => state.isPro);
  const hasUsedFreeDownload = useCvStore((state) => state.hasUsedFreeDownload);
  const setHasUsedFreeDownload = useCvStore((state) => state.setHasUsedFreeDownload);
  const parseSignals = useCvStore((state) => state.parseSignals);
  const updateSection = useCvStore((state) => state.updateSection);
  const previewOpen = useUiStore((s) => s.previewDrawerOpen);
  const setPreviewOpen = useUiStore((s) => s.setPreviewDrawerOpen);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  // Score report — computed live, shown in the TopBar (number + popover).
  const scoreReport: ScoreReport = useMemo(
    () =>
      computeScore(data, {
        mode: "builder",
        parseSignals: parseSignals ?? undefined,
      }),
    [data, parseSignals],
  );

  const cvName =
    (data.personal.firstName?.trim() || data.personal.lastName?.trim())
      ? `${data.personal.firstName?.trim() ?? ""} ${data.personal.lastName?.trim() ?? ""}`
          .trim()
          .split(" ")[0] + "'s CV"
      : "Untitled CV";

  // ---- Template cycling (drawer chevrons) ----
  const handleCycleTemplate = (direction: 1 | -1) => {
    const idx = templates.findIndex((t) => t.id === data.settings.templateId);
    const nextIdx =
      (((idx >= 0 ? idx : 0) + direction) % templates.length + templates.length) %
      templates.length;
    updateSection("settings", {
      ...data.settings,
      templateId: templates[nextIdx].id,
    });
  };

  // ---- Download (TopBar + drawer) ----
  const handleDownload = async () => {
    if (!isPro && hasUsedFreeDownload) {
      setUpgradeOpen(true);
      return;
    }
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadCV(
        data,
        isPro ? "pro" : "free",
        data.settings.templateId ?? "classic",
      );
      if (!isPro) setHasUsedFreeDownload(true);
    } catch {
      setDownloadError("Couldn't generate PDF. Try again or export as DOCX.");
    } finally {
      setIsDownloading(false);
    }
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

    const accept =
      type === "pdf"
        ? ".pdf,application/pdf"
        : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const source = type === "pdf" ? "PDF" : "DOCX";
    const adapter = type === "pdf" ? pdfAdapter : docxAdapter;

    triggerFileInput(accept, async (file) => {
      setImportState({ phase: "parsing", source });
      try {
        const parsed = await adapter.parse(file);
        setImportState({ phase: "review", source, parsed });
      } catch {
        setImportState({ phase: "idle" });
        setErrorMsg(
          `Could not parse ${source}. Please check the file and try again.`,
        );
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
      setErrorMsg(
        "Could not parse LinkedIn profile text. Please paste the full profile text.",
      );
    }
  };

  const handleImportConfirm = (
    partial: Partial<CvData>,
    mode: "replace" | "merge",
  ) => {
    importCvVersion(partial, mode);
    setImportState({ phase: "idle" });
  };

  const stepIsReview = stepId === "review";
  const stepIsScore = stepId === "score";

  return (
    <ImportContext.Provider value={{ handleImport }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          width: "100%",
          overflow: "hidden",
          fontFamily: "var(--font-body)",
          background: "var(--ff-paper)",
        }}
      >
        <TopBar
          cvName={cvName}
          scoreReport={scoreReport}
          onTemplates={() => onStepChange("review")}
          onDownload={handleDownload}
          isDownloading={isDownloading}
        />

        {/* Progress bar — step beads + UAE-optimised pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 28px",
            background: "var(--ff-card)",
            borderBottom: "1px solid var(--ff-line)",
            flexShrink: 0,
            minHeight: "var(--progressbar-h)",
            overflowX: "auto",
          }}
        >
          <StepBeads
            steps={builderSteps}
            statuses={statuses}
            currentId={stepId}
            onStepClick={(id) => onStepChange(id)}
          />
          <div
            className="hidden md:inline-flex"
            style={{
              marginLeft: "auto",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ff-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            <UAEDot size={11} />
            UAE-Optimised
          </div>
        </div>

        {/* Error bar */}
        {(errorMsg || downloadError) && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#FBEFED",
              borderBottom: "1px solid #F2D2CE",
              padding: "10px 24px",
            }}
          >
            <p style={{ fontSize: 13, color: "var(--ff-red)", fontWeight: 500 }}>
              {errorMsg ?? downloadError}
            </p>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setDownloadError(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--ff-red)",
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

        {/* ── MAIN AREA ─────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            overflow: "hidden",
          }}
        >
          <main
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {!hydrated && (
              <div
                style={{
                  padding: "28px 36px",
                  fontSize: 14,
                  color: "var(--ff-faint)",
                }}
              >
                Loading your saved CV...
              </div>
            )}

            {/* Form column — anchored left on xl+, full-width on smaller */}
            <div
              className={
                stepIsReview || stepIsScore
                  ? "ff-form-column ff-form-column-review"
                  : "ff-form-column"
              }
            >
              {children}
            </div>
          </main>

          {/* Preview drawer — xl+ only, hidden on review/score steps */}
          {!stepIsReview && !stepIsScore && (
            <div className="hidden xl:block" style={{ pointerEvents: "auto" }}>
              <PreviewDrawer
                templateId={data.settings.templateId}
                onPrevTemplate={() => handleCycleTemplate(-1)}
                onNextTemplate={() => handleCycleTemplate(1)}
                onFullscreen={() => setPreviewOpen(true)}
                onDownload={handleDownload}
                isDownloading={isDownloading}
              />
            </div>
          )}
        </div>

        {/* Floating "Preview CV" pill — lg and below */}
        {!stepIsReview && !stepIsScore && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="xl:hidden"
            style={{
              position: "fixed",
              right: 20,
              bottom: 20,
              zIndex: 50,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "var(--ff-ink)",
              color: "white",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 14px 30px rgba(11,15,12,0.20)",
              cursor: "pointer",
            }}
          >
            <Icon name="eye" size={14} />
            Preview CV
          </button>
        )}

        {/* Dev AI reset (dev-only) */}
        <DevResetAI />

        {/* Mobile preview overlay */}
        {previewOpen && <PreviewOverlay onClose={() => setPreviewOpen(false)} />}

        {/* Import overlays */}
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
                background: "var(--ff-card)",
                borderRadius: 14,
                border: "1px solid var(--ff-line)",
                padding: "32px 40px",
                textAlign: "center",
                boxShadow: "var(--shadow-xl)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "4px solid var(--ff-line)",
                  borderTopColor: "var(--ff-accent)",
                  borderRadius: "50%",
                  margin: "0 auto 12px",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--ff-ink-2)",
                }}
              >
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

        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

        {/* Inline style block — keeps the responsive form-column rules close
            to the layout that uses them. */}
        <style>{`
          .ff-form-column {
            width: 100%;
            max-width: 100%;
            padding: 32px 24px 32px;
          }
          @media (min-width: 768px) {
            .ff-form-column { padding: 32px 36px 32px; }
          }
          @media (min-width: 1024px) {
            .ff-form-column { padding: 36px 40px 36px; max-width: 860px; }
          }
          @media (min-width: 1280px) {
            .ff-form-column {
              padding: 28px 24px 28px 40px;
              max-width: var(--form-max);
              margin-right: calc(var(--drawer-w) + var(--drawer-gap) + 28px);
            }
            .ff-form-column-review {
              max-width: 1180px;
              margin-right: 0;
              padding: 28px 40px 28px 40px;
            }
          }
          .cv-bead-strip::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </ImportContext.Provider>
  );
};
