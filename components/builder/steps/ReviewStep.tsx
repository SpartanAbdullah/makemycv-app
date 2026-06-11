"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { builderSteps } from "../../../lib/utils/steps";
import { getStepCompletion } from "../../../lib/utils/stepValidation";
import { useCvStore } from "../../../lib/store/cvStore";
import { exportToDocx } from "../../../lib/utils/docxExport";
import { downloadCV } from "../../../hooks/useDownloadCV";
import { templates } from "../../../lib/templates";
import {
  computeScore,
  computeDerivedStats,
  GRADE_LABELS,
} from "../../../lib/scoreEngine";
import { Icon } from "../Icon";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";
import { CustomizePanel } from "../CustomizePanel";
import { TemplatePreviewModal } from "../../preview/TemplatePreviewModal";
import { DownloadTipModal, shouldShowDownloadTip } from "../../DownloadTipModal";
import { ShareScoreCard } from "../../ShareScoreCard";
import { useSharedScoreReport } from "../BuilderShell";
import { ExportGateDialog } from "../ExportGateDialog";
import {
  getFirstIncompleteSection,
  getMissingItems,
} from "../../../lib/validation/cvRequirements";
import type { CvData } from "../../../lib/types/cv";

const A4_W = 794;
const A4_H = 1123;

/**
 * Template thumbnail — A4-aspect mini-render using scale(width / 794).
 * Mirrors the production template renderer so the thumbnail looks like the
 * actual output, not a hand-drawn approximation.
 */
function TemplateThumb({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.22);

  useEffect(() => {
    const el = ref.current;
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

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1.414",
        overflow: "hidden",
        borderRadius: 8,
        background: "white",
        border: "1px solid var(--ff-line)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: A4_W,
          height: A4_H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}


/* ─── Review step ───────────────────────────────────────── */
export const ReviewStep = ({
  onBack,
  onJump,
}: {
  onBack: () => void;
  onJump: (stepId: string) => void;
}) => {
  const data = useCvStore((state) => state.data);
  const parseSignals = useCvStore((state) => state.parseSignals);
  const updateSection = useCvStore((state) => state.updateSection);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [downloadTipOpen, setDownloadTipOpen] = useState(false);

  // Reuse BuilderShell's report instead of running the engine a second
  // time per commit (audit PERF-3). The local fallback only exists for
  // any future mount outside the shell.
  const sharedReport = useSharedScoreReport();
  const fallbackReport = useMemo(
    () =>
      sharedReport
        ? null
        : computeScore(data, {
            mode: "builder",
            parseSignals: parseSignals ?? undefined,
          }),
    [sharedReport, data, parseSignals],
  );
  const score = sharedReport ?? fallbackReport!;

  const animatedScore = useAnimatedNumber(score.total);
  const firstName =
    data.personal.firstName?.trim() ||
    data.personal.lastName?.trim() ||
    "friend";

  // Export gate (guided feedback, 2026-06): both export formats check the
  // shared cvRequirements module first. Missing required content opens the
  // ONE blocking dialog in the system — "Go back and fix" / "Export anyway".
  const [exportGate, setExportGate] = useState<null | "pdf" | "docx">(null);

  // The PDF download runs immediately. On success, the post-download
  // tip jar is scheduled ~1500ms later (suppressed if recently tipped
  // or dismissed this session). Errors stay in the existing inline
  // error UI — they don't open the modal.
  const runDownloadPdf = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadCV(data, "pro", data.settings.templateId ?? "classic");
      if (shouldShowDownloadTip()) {
        window.setTimeout(() => setDownloadTipOpen(true), 1500);
      }
    } catch {
      setDownloadError("pdf-failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const runExport = async (kind: "pdf" | "docx") => {
    if (kind === "docx") {
      exportToDocx(data);
      return;
    }
    await runDownloadPdf();
  };

  const requestExport = (kind: "pdf" | "docx") => {
    if (getMissingItems(data).length > 0) {
      setExportGate(kind);
      return;
    }
    void runExport(kind);
  };

  const handleExportDocx = () => requestExport("docx");
  const handleDownloadPdf = () => requestExport("pdf");

  // The CV lives only in this browser's localStorage — sharing the builder
  // URL would hand the recipient an EMPTY builder (audit UX-5). We share
  // the product link instead, native share sheet first (WhatsApp-first UAE
  // audience), clipboard as fallback.
  const handleShareLink = async () => {
    if (typeof navigator === "undefined") return;
    const shareUrl = "https://makemycv.ae";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "MakeMyCV — free UAE CV builder",
          url: shareUrl,
        });
      } catch {
        /* share sheet dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  };

  const handleTemplateChange = (id: string) => {
    updateSection("settings", { ...data.settings, templateId: id });
  };

  const incomplete = builderSteps.filter(
    (step) => step.id !== "review" && !getStepCompletion(step, data),
  );

  /* ── Stats + label come from the engine — never recomputed locally.
        The old local copies used different rules (untrimmed bullets, a
        second threshold table), which is how "0 of 9 measurable bullets"
        could sit beside "Strong CV" (audit §4 symptom b). ── */
  const stats = useMemo(() => computeDerivedStats(data), [data]);
  const scoreCategoryLabel = GRADE_LABELS[score.grade];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
      className="ff-review-root"
    >
      {/* Responsive grid (1 / 2 / 3 columns) — see <style> at the bottom of
          this component. Areas: hero | templates | customize. */}
      <div className="ff-review-grid">
        {/* ── Left: hero + score + actions ───────────────── */}
        <div
          className="ff-review-hero"
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          <div>
            <h1 className="cv-step-heading cv-step-heading-hero">
              {score.total >= 40 ? "Looking good," : "Let's build this out,"}
              <br />
              <span className="accent">{firstName}.</span>
            </h1>
            <p className="cv-step-subtitle" style={{ maxWidth: 380 }}>
              Your CV scores {score.total}/100 on our UAE hiring rubric. Take a
              final look, pick a template, and download.
            </p>
          </div>

          {/* Missing sections */}
          {incomplete.length > 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #F7E2A3",
                background: "var(--ff-warn-soft)",
                padding: 16,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ff-warn)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Missing sections
              </p>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {incomplete.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onJump(step.id)}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #F7E2A3",
                      background: "white",
                      padding: "5px 14px",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--ff-warn)",
                      cursor: "pointer",
                    }}
                  >
                    {step.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Score card */}
          <div
            style={{
              padding: 22,
              background: "var(--ff-card)",
              border: "1px solid var(--ff-line)",
              borderRadius: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <ScoreDonut total={score.total} />
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    color: "var(--ff-ink)",
                    fontWeight: 600,
                  }}
                >
                  {scoreCategoryLabel}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--ff-muted)",
                    marginTop: 4,
                  }}
                >
                  {data.personal.headline?.trim() || "Your CV"} · UAE hiring
                  rubric
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--ff-accent)",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--ff-accent)",
                    }}
                  />
                  Live score · {animatedScore}/100
                </div>
              </div>
            </div>
            <div
              style={{
                height: 1,
                background: "var(--ff-line)",
                margin: "18px 0",
              }}
            />
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <StatRow
                label="Measurable bullets"
                value={
                  stats.totalBullets > 0
                    ? `${stats.measurableBullets} of ${stats.totalBullets}`
                    : "—"
                }
              />
              <StatRow
                label="UAE essentials filled"
                value={
                  stats.uaeFilledCount === 3
                    ? "All ✓"
                    : `${stats.uaeFilledCount} of 3`
                }
              />
              <StatRow
                label="Sections complete"
                value={`${builderSteps.filter((s) => s.id !== "review" && getStepCompletion(s, data)).length} of ${builderSteps.length - 1}`}
              />
              <StatRow
                label="Expected length"
                value={`${stats.expectedPages} page${stats.expectedPages > 1 ? "s" : ""}`}
              />
            </div>
          </div>

          {/* Action stack */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="cv-btn-primary"
              style={{ width: "100%", padding: "16px", fontSize: 15 }}
            >
              {isDownloading ? (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      border: "2px solid white",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Preparing PDF…
                </>
              ) : (
                <>
                  <Icon name="download" size={15} />
                  Download CV as PDF
                </>
              )}
            </button>
            {downloadError === "pdf-failed" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#FBEFED",
                  border: "1px solid #F2D2CE",
                }}
              >
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ff-red)",
                    fontWeight: 500,
                  }}
                >
                  PDF download failed. Try again or export as Word below.
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleExportDocx}
                className="cv-btn-secondary"
                style={{ flex: 1, padding: "12px" }}
              >
                Export .docx
              </button>
              <button
                type="button"
                onClick={handleShareLink}
                className="cv-btn-secondary"
                style={{ flex: 1, padding: "12px" }}
              >
                {shareCopied ? "Link copied ✓" : "Share MakeMyCV"}
              </button>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--ff-faint)",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              PDF is best for applications. DOCX is editable.
            </p>
            <div style={{ textAlign: "center" }}>
              <ShareScoreCard total={score.total} />
            </div>
          </div>

        </div>

        {/* ── Middle: choose a template ─────────────────────── */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          className="ff-review-templates"
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color: "var(--ff-ink)",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Choose a template
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
                color: "var(--ff-muted)",
                marginTop: 3,
              }}
            >
              All six export as real text, not images. Classic and ATS Clean
              are the safest picks for online applications.
            </div>
          </div>

          <div className="ff-templates-grid">
            {templates.map((tmpl) => {
              const isSelected = data.settings.templateId === tmpl.id;
              return (
                <TemplateCard
                  key={tmpl.id}
                  name={tmpl.name}
                  description={tmpl.description}
                  badge={tmpl.badge}
                  selected={isSelected}
                  onClick={() => handleTemplateChange(tmpl.id)}
                  onPreview={() => setPreviewTemplateId(tmpl.id)}
                >
                  <TemplateGalleryPreview Render={tmpl.Render} data={data} />
                </TemplateCard>
              );
            })}
          </div>
        </div>

        {/* ── Right: customize panel ────────────────────────── */}
        <div className="ff-review-customize">
          <CustomizePanel />
        </div>
      </div>

      {/* Back nav */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          paddingTop: 12,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="cv-btn-secondary"
          style={{ padding: "11px 22px" }}
        >
          <Icon name="chevron-left" size={13} />
          Back
        </button>
      </div>

      <DownloadTipModal
        open={downloadTipOpen}
        onClose={() => setDownloadTipOpen(false)}
        userName={data.personal.firstName?.trim() || undefined}
      />

      {/* Export gate — the only blocking dialog in the system. */}
      <ExportGateDialog
        open={exportGate !== null}
        missing={exportGate ? getMissingItems(data) : []}
        onClose={() => setExportGate(null)}
        onGoFix={() => {
          const target = getFirstIncompleteSection(data);
          setExportGate(null);
          if (target) onJump(target);
        }}
        onExportAnyway={() => {
          const kind = exportGate;
          setExportGate(null);
          if (kind) void runExport(kind);
        }}
      />

      <TemplatePreviewModal
        templateId={previewTemplateId}
        open={previewTemplateId !== null}
        onClose={() => setPreviewTemplateId(null)}
        onSelect={(id) => {
          handleTemplateChange(id);
          setPreviewTemplateId(null);
        }}
        onDownload={(id) => {
          handleTemplateChange(id);
          setPreviewTemplateId(null);
          handleDownloadPdf();
        }}
      />

      <style>{`
        /* Stacked on mobile: hero → templates → customize. */
        .ff-review-grid {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-areas: "hero" "templates" "customize";
          gap: 28px;
        }
        .ff-review-hero      { grid-area: hero; }
        .ff-review-templates { grid-area: templates; }
        .ff-review-customize { grid-area: customize; }

        /* 2 columns at 1200px+: hero | templates, with customize beneath
           templates (still in the right rail). */
        @media (min-width: 1200px) {
          .ff-review-grid {
            grid-template-columns: 1fr 1.4fr;
            grid-template-areas:
              "hero templates"
              "hero customize";
            gap: 28px 32px;
          }
        }

        /* 3 columns at 1500px+: hero | templates | customize. Fills the empty
           right rail on wide displays. */
        @media (min-width: 1500px) {
          .ff-review-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 0.9fr);
            grid-template-areas: "hero templates customize";
            gap: 32px;
          }
        }

        .ff-templates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        /* On the 3-col layout the templates column is narrower — keep it
           2-up there, expand to 3-up only on the 2-col layout where the
           templates rail is wider. */
        @media (min-width: 880px) and (max-width: 1499px) {
          .ff-templates-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>
    </div>
  );
};

/* ─── Memoized gallery thumbnail (audit PERF-4) ──────────────
   Six full A4 template trees are mounted at once in the gallery; without
   memo, every unrelated ReviewStep state change (share feedback, modal
   opens) re-rendered all six. memo skips them unless the CV data or the
   template itself changes. content-visibility lets the browser skip
   painting thumbnails that are scrolled off-screen (mobile stacks them
   in one column). */
const TemplateGalleryPreview = memo(function TemplateGalleryPreview({
  Render,
  data,
}: {
  Render: (props: { data: CvData; plan?: "free" | "pro" }) => React.ReactElement;
  data: CvData;
}) {
  return (
    <div style={{ contentVisibility: "auto", containIntrinsicSize: "auto 320px" }}>
      <TemplateThumb>
        <Render data={data} plan="pro" />
      </TemplateThumb>
    </div>
  );
});

/* ─── Score donut ───────────────────────────────────────── */
const ScoreDonut = ({ total }: { total: number }) => {
  const angle = total * 3.6;
  return (
    <div
      style={{
        width: 90,
        height: 90,
        borderRadius: "50%",
        background: `conic-gradient(var(--ff-accent) 0 ${angle}deg, var(--ff-line) ${angle}deg)`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        transition: "background 800ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        style={{
          width: 74,
          height: 74,
          borderRadius: "50%",
          background: "var(--ff-card)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 700,
              color: "var(--ff-ink)",
              lineHeight: 1,
            }}
          >
            {total}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--ff-muted)",
              letterSpacing: "0.14em",
              marginTop: 3,
              textTransform: "uppercase",
            }}
          >
            / 100
          </div>
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-body)",
      fontSize: 13,
      color: "var(--ff-ink-2)",
    }}
  >
    <span>{label}</span>
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--ff-ink)",
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  </div>
);

const TemplateCard = ({
  name,
  description,
  badge,
  selected,
  onClick,
  onPreview,
  children,
}: {
  name: string;
  description: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
  onPreview?: () => void;
  children: ReactNode;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    aria-pressed={selected}
    style={{
      position: "relative",
      padding: 8,
      borderRadius: 14,
      background: selected ? "var(--ff-accent-soft)" : "var(--ff-card)",
      border: `2px solid ${selected ? "var(--ff-accent)" : "var(--ff-line)"}`,
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      flexDirection: "column",
      transition:
        "background var(--transition-base), border-color var(--transition-base)",
    }}
  >
    {onPreview && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        aria-label={`Open ${name} full preview`}
        title="Open full preview"
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          zIndex: 3,
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "var(--ff-ink)",
          color: "white",
          border: "none",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          opacity: 0.92,
        }}
      >
        <Icon name="search" size={13} />
      </button>
    )}
    {badge && (
      <span
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 2,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--ff-ink)",
          background: "var(--ff-paper)",
          padding: "3px 8px",
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: "0.08em",
          border: "1px solid var(--ff-line)",
          textTransform: "uppercase",
        }}
      >
        {badge}
      </span>
    )}
    {children}
    <div
      style={{
        marginTop: 10,
        padding: "0 4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          color: "var(--ff-ink)",
          fontWeight: 600,
        }}
      >
        {name}
      </div>
      {selected && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ff-accent)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--ff-accent)",
            }}
          />
          Selected
        </span>
      )}
    </div>
    <p
      style={{
        fontSize: 11,
        color: "var(--ff-faint)",
        marginTop: 4,
        padding: "0 4px",
        lineHeight: 1.4,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {description}
    </p>
  </div>
);
