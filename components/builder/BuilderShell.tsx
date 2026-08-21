"use client";

import {
  createContext,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { StepStatus } from "./Stepper";
import { StepBeads } from "./StepBeads";
import { UAEDot } from "./UAEDot";
import { Icon } from "./Icon";
import { builderSteps } from "../../lib/utils/steps";
import { getStepCompletion } from "../../lib/utils/stepValidation";
import {
  getFirstIncompleteSection,
  getMissingItems,
  getSectionMissing,
} from "../../lib/validation/cvRequirements";
import { Toaster } from "../ui/Toaster";
import { ProcessSteps } from "../ui/ProcessSteps";
import { ExportGateDialog } from "./ExportGateDialog";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useUiStore } from "../../lib/store/uiStore";
import dynamic from "next/dynamic";
import { PreviewPanel } from "../preview/PreviewPanel";
import { ImportParseError } from "../../lib/importers/adapter";
import type { ParsedDocument } from "../../lib/importers/adapter";

// Code-split the rare paths out of /builder's first paint (audit PERF-6):
// MappingReview (743 lines) renders only mid-import, and the adapters pull
// the 816-line heuristic textParser eagerly when imported statically.
const MappingReview = dynamic(
  () => import("../import/MappingReview").then((m) => m.MappingReview),
  { ssr: false },
);
import type { CvData } from "../../lib/types/cv";
import { templates, getTemplateById } from "../../lib/templates";
import { downloadCV } from "../../hooks/useDownloadCV";
import { SegmentedViewToggle } from "../ui/SegmentedViewToggle";
import { exportToDocx } from "../../lib/utils/docxExport";
import { track } from "../../lib/analytics";
import { downloadCvBackup } from "../../lib/utils/download";
import { computeScore } from "../../lib/scoreEngine";
import type { ScoreReport } from "../../lib/resumeChecker/types";
import { ScoreChip } from "./ScoreChip";
import { Logo } from "../Logo";
import { DownloadTipModal, shouldShowDownloadTip } from "../DownloadTipModal";
import { SUPPORT_URL } from "../../lib/config/support";
type ImportContextValue = {
  /** Opens a PDF/DOCX picker; format is routed by file extension. */
  handleImport: () => void;
};

const ImportContext = createContext<ImportContextValue | null>(null);

export const useImport = () => {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImport must be used inside BuilderShell");
  return ctx;
};

// Shared score report (audit PERF-3): BuilderShell computes the engine
// report once per (deferred) data commit for the TopBar chip; ReviewStep
// consumes the same report instead of running the 1,200-line engine a
// second time per commit.
const ScoreReportContext = createContext<ScoreReport | null>(null);

export const useSharedScoreReport = () => useContext(ScoreReportContext);

// Guarded download (founder feedback round, B6): every export — TopBar,
// ReviewStep actions, TemplatePreviewModal, PDF or DOCX — must flow through
// the ExportGateDialog check. ReviewStep previously called downloadCV
// directly and bypassed the gate.
export type ExportKind = "pdf" | "docx" | "json";

const EXPORT_COPY: Record<ExportKind, { success: string; error: string }> = {
  pdf: {
    success: "Your PDF downloaded — check your Downloads folder.",
    error: "Couldn't generate PDF. Try again or export as DOCX.",
  },
  docx: {
    success: "Your Word file downloaded — check your Downloads folder.",
    error: "Couldn't generate DOCX. Try again or export as PDF.",
  },
  json: {
    success: "Backup saved — keep the .json file to restore this CV later.",
    error: "Couldn't save the backup file. Try again.",
  },
};
type DownloadContextValue = {
  requestDownload: (kind: ExportKind) => void | Promise<void>;
  isDownloading: boolean;
};
const DownloadContext = createContext<DownloadContextValue | null>(null);

/** Null outside BuilderShell (e.g. isolated component tests) — callers
 *  should fall back to a direct export in that case. */
export const useGuardedDownload = () => useContext(DownloadContext);

type ImportState =
  | { phase: "idle" }
  | { phase: "parsing"; source: string }
  | { phase: "review"; source: string; parsed: ParsedDocument };

/* ─── Fullscreen preview overlay (mobile + below xl) ───────── */
const PreviewOverlay = ({ onClose }: { onClose: () => void }) => {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  // Keep the latest onClose without re-running the mount effect (the parent
  // re-renders on every keystroke; the inline closure changes each time).
  // Assigned in an effect, not during render: mutating a ref while rendering
  // is unsafe under concurrent rendering, where React may render a component
  // without committing it — the ref would then hold a callback from a render
  // that never happened.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    // Dialog semantics: focus moves in on open, Escape closes, and focus
    // returns to the opener on close (the overlay previously trapped
    // keyboard users with a mouse-only Close button).
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CV preview"
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
          ref={closeBtnRef}
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 999,
            padding: "12px 18px",
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
  saveError,
  scoreReport,
  scoreDelta,
  onTemplates,
  onDownload,
  isDownloading,
}: {
  cvName: string;
  saveError: boolean;
  scoreReport: ScoreReport;
  /** Points gained/lost since import. undefined = no baseline, pill hidden. */
  scoreDelta?: number;
  onTemplates: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) => {
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
        {saveError ? (
          // Save failures must be loud on EVERY viewport — the happy-path
          // label is cosmetic, this one is data loss in progress.
          <span
            role="status"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ff-red)",
              background: "var(--ff-red-soft)",
              border: "1px solid var(--ff-red-line)",
              borderRadius: 999,
              padding: "4px 10px",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            Not saved — storage full
          </span>
        ) : (
          <span
            className="hidden md:inline"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "var(--ff-muted)",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {cvName} · saved on this device
          </span>
        )}
      </div>

      {/* Right — score chip + JD match + templates + download */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <ScoreChip report={scoreReport} delta={scoreDelta} />
        {/* Free CV-vs-job diagnosis. Hidden below lg so the bar stays
            uncluttered on smaller screens; the Review step carries the same
            entry point for everyone else. */}
        <Link
          href="/jd-match"
          className="hidden lg:inline-flex cv-top-btn cv-top-btn-secondary"
        >
          <Icon name="lightbulb" size={13} />
          Match to a job
        </Link>
        <button
          type="button"
          onClick={onTemplates}
          className="hidden sm:inline-flex cv-top-btn cv-top-btn-secondary"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          All templates
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="inline-flex cv-top-btn cv-top-btn-primary"
        >
          {isDownloading ? (
            <>
              <span
                style={{
                  width: 13,
                  height: 13,
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
type PreviewFitMode = "width" | "page";

const PreviewDrawer = ({
  templateId,
  onPrevTemplate,
  onNextTemplate,
  onFullscreen,
}: {
  templateId: string;
  onPrevTemplate: () => void;
  onNextTemplate: () => void;
  onFullscreen: () => void;
}) => {
  const template = getTemplateById(templateId);
  // "width" (default) fills the drawer edge-to-edge and scrolls — readable
  // while editing. "page" keeps the old fit-everything-at-once view for an
  // at-a-glance check of the whole layout.
  const [fitMode, setFitMode] = useState<PreviewFitMode>("width");
  return (
    <div
      style={{
        position: "absolute",
        right: "var(--drawer-gap)",
        // Flush against the progress-bar line (founder request 2026-07: the
        // 24px inset above the drawer read as wasted space). The bar's own
        // bottom border acts as the drawer's top edge, so borderTop is off
        // and only the bottom corners are rounded.
        top: 0,
        bottom: "var(--drawer-gap)",
        width: "var(--drawer-w)",
        background: "var(--ff-card)",
        border: "1px solid var(--ff-line)",
        borderTop: "none",
        borderRadius: "0 0 18px 18px",
        boxShadow: "var(--shadow-drawer)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      {/* Drawer body — the CV render area. Default fit-width mode renders the
          page at the drawer's full width and scrolls vertically (readable
          text while editing); fit-page mode shrinks the whole CV into view
          at once. The CV renders in full including its own page padding —
          faithful to the export. */}
      <DrawerPreviewBody fitMode={fitMode} />

      {/* Drawer footer — template cycler + action buttons. */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid var(--ff-line)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        {/* Template cycler */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            // 36px is the footer's shared control height — the cycler already
            // computes to exactly 36, pinning it keeps siblings flush.
            height: 36,
            padding: "3px 4px 3px 10px",
            background: "var(--ff-paper)",
            border: "1px solid var(--ff-line)",
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              color: "var(--ff-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginRight: 4,
              whiteSpace: "nowrap",
            }}
          >
            {template.name}
          </span>
          <button
            type="button"
            onClick={onPrevTemplate}
            aria-label="Previous template"
            className="ff-hit-target cv-drawer-ctl"
            style={drawerChevronBtn}
          >
            <Icon name="chevron-left" size={12} color="var(--ff-muted)" />
          </button>
          <button
            type="button"
            onClick={onNextTemplate}
            aria-label="Next template"
            className="ff-hit-target cv-drawer-ctl"
            style={drawerChevronBtn}
          >
            <Icon name="chevron-right" size={12} color="var(--ff-muted)" />
          </button>
        </div>
        {/* Fit mode toggle — replaces the duplicate "Download PDF" button
            (the TopBar Download is the single, export-gated CTA). */}
        <div
          role="group"
          aria-label="Preview fit mode"
          style={{
            display: "inline-flex",
            // Shared 36px footer control height: 28px segments + 3+3 padding
            // + 2px border.
            height: 36,
            padding: 3,
            background: "var(--ff-paper)",
            border: "1px solid var(--ff-line)",
            borderRadius: 999,
            flexShrink: 0,
            gap: 2,
          }}
        >
          {(
            [
              { mode: "width" as PreviewFitMode, label: "Fit width" },
              { mode: "page" as PreviewFitMode, label: "Fit page" },
            ]
          ).map(({ mode, label }) => {
            const active = fitMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setFitMode(mode)}
                aria-pressed={active}
                // Background/color/hover live on .cv-fit-seg (globals.css);
                // the aria-pressed attribute drives the active-segment state
                // via its [aria-pressed="true"] selector — no inline colors,
                // or they'd override the class :hover rule.
                className="cv-fit-seg"
                style={{
                  fontFamily: "var(--font-body)",
                  // 12.5 matches the Fullscreen button label — one font size
                  // across the footer's action controls.
                  fontSize: 12.5,
                  fontWeight: 500,
                  height: 28,
                  padding: "0 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onFullscreen}
          // Surface + border + hover come from .cv-drawer-ctl (globals.css) —
          // keeping them off the inline style lets the :hover rule apply.
          className="cv-drawer-ctl"
          style={{
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: 12.5,
            color: "var(--ff-ink)",
            // Pill family at the shared 36px footer height — matches the
            // cycler and fit toggle beside it (and the mobile footer's
            // full-width pill Download).
            height: 36,
            padding: "0 9px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
};

/* Preview body — two fit modes (the founder feedback round, B6):
 *
 * "width" (default): scale = min(wrapW / A4_W, 1). The page fills the
 * drawer edge-to-edge and the body scrolls vertically — 1.3×–2.9× larger
 * than the old fit-page view, so body text is actually readable while
 * editing. Same proven pattern as MobilePreviewView (spacer div carries
 * the scaled height; content stays 794px wide so scrollHeight is
 * scale-independent — no ResizeObserver feedback loop).
 *
 * "page": the original behaviour — scale = min(wrapW / A4_W, wrapH /
 * contentH, 1) so the entire CV is visible at once with no scrolling.
 *
 * Two ResizeObservers feed the calculation: one on the wrap (drawer size)
 * and one on the inner content (unscaled CV height). The live preview
 * renders the CV in full, including each template's own page padding —
 * faithful to the export (an earlier top-clipping experiment broke the
 * full-bleed sidebar templates; don't reintroduce it). */
const A4_W = 794;
const DrawerPreviewBody = ({ fitMode }: { fitMode: PreviewFitMode }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.45);
  const [contentHeight, setContentHeight] = useState(1123);

  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;

    const update = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const ch = content.scrollHeight;
      if (w <= 0 || h <= 0 || ch <= 0) return;
      // Cap at 1 so single-page CVs in a generously-sized drawer don't
      // up-scale and look pixelated.
      const scaleW = Math.min(w / A4_W, 1);
      setScale(fitMode === "page" ? Math.min(scaleW, h / ch) : scaleW);
      setContentHeight(ch);
    };

    update();
    const wrapObs = new ResizeObserver(update);
    const contentObs = new ResizeObserver(update);
    wrapObs.observe(wrap);
    contentObs.observe(content);
    return () => {
      wrapObs.disconnect();
      contentObs.disconnect();
    };
  }, [fitMode]);

  const fitWidth = fitMode === "width";
  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        // Sunken canvas in width mode so any residual gutter reads as a
        // deliberate desk surface, not dead whitespace.
        background: fitWidth ? "var(--ff-sunken, #F1F2F0)" : "white",
        overflowY: fitWidth ? "auto" : "hidden",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Spacer carries the scaled height in width mode so the wrap can
          scroll; in page mode everything fits and the height is moot. */}
      <div
        style={{
          position: "relative",
          height: fitWidth ? contentHeight * scale : "100%",
        }}
      >
        <div
          ref={contentRef}
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width: A4_W,
            transformOrigin: "top center",
            transform: `translateX(-50%) scale(${scale})`,
            background: "white",
            boxShadow: fitWidth ? "0 6px 24px rgba(11,15,12,0.08)" : undefined,
          }}
        >
          <PreviewPanel sticky={false} />
        </div>
      </div>
    </div>
  );
};

/* ─── Mobile preview view (xl-) ─────────────────────────────
 *
 * Used when the mobile Edit | Preview toggle is set to "preview".
 * Renders the SAME A4 template as the desktop drawer, scaled via CSS
 * `transform: scale()` to fit the viewport width — so the preview matches
 * what the printed PDF will look like (NOT a reflowed mobile layout).
 *
 * Sizing is measured client-side in useEffect (ResizeObserver), with a
 * safe SSR default of scale=0.45 so the first paint never mismatches the
 * server-rendered HTML. */
const MobilePreviewView = ({
  templateId,
  onPrevTemplate,
  onNextTemplate,
  onDownload,
  isDownloading,
}: {
  templateId: string;
  onPrevTemplate: () => void;
  onNextTemplate: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) => {
  const template = getTemplateById(templateId);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.45);
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
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        background: "var(--ff-sunken, #F1F2F0)",
        // Leave room at the bottom for the floating Edit|Preview toggle.
        padding: "16px 16px 96px",
      }}
    >
      {/* Mobile preview chrome — the preview was a dead end on phones: no
          template switching, no download (the drawer's controls are xl+
          only and the TopBar "All templates" button is hidden below sm). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            padding: "3px 4px 3px 10px",
            // Paper, not card — matches the desktop drawer's cycler pill so
            // the shared drawerChevronBtn circles sit flush on both.
            background: "var(--ff-paper)",
            border: "1px solid var(--ff-line)",
            borderRadius: 999,
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              color: "var(--ff-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginRight: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {template.name}
          </span>
          <button
            type="button"
            onClick={onPrevTemplate}
            aria-label="Previous template"
            className="ff-hit-target cv-drawer-ctl"
            style={drawerChevronBtn}
          >
            <Icon name="chevron-left" size={12} color="var(--ff-muted)" />
          </button>
          <button
            type="button"
            onClick={onNextTemplate}
            aria-label="Next template"
            className="ff-hit-target cv-drawer-ctl"
            style={drawerChevronBtn}
          >
            <Icon name="chevron-right" size={12} color="var(--ff-muted)" />
          </button>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="inline-flex cv-top-btn cv-top-btn-primary"
          // minHeight 44 keeps the primary mobile download action on the
          // audit UI-5 touch-target floor.
          style={{ flex: 1, justifyContent: "center", minHeight: 44 }}
        >
          {isDownloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>
      <div
        ref={wrapRef}
        style={{
          width: "100%",
          background: "white",
          boxShadow: "0 10px 30px rgba(11,15,12,0.10)",
          borderRadius: 6,
          overflow: "hidden",
          position: "relative",
          height: contentHeight * scale,
          flexShrink: 0,
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

/* Mobile Edit | Preview toggle — now the shared SegmentedViewToggle
 * (components/ui/SegmentedViewToggle.tsx), which carries the floating
 * dark-pill presentation, the 44px touch floor, and the CRITICAL
 * visibility-on-className rule. Builder passes `inline-flex xl:hidden`
 * so the toggle drops out at the same xl line where the side-by-side
 * preview turns on. */

const drawerChevronBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  // 28px circle — nested-pill idiom (999 inside 999), same as the fit
  // toggle's inner segments; both cycler containers that use this are pills.
  // Surface + border live on the .cv-drawer-ctl class (globals.css) so its
  // :hover rule can restyle them — inline declarations would override it.
  borderRadius: 999,
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
  const data = useCvStore((state) => state.data);
  const hydrated = useCvStore((state) => state.hydrated);
  const saveError = useCvStore((state) => state.saveError);
  const staleTab = useCvStore((state) => state.staleTab);
  const importCvVersion = useCvStore((state) => state.importCvVersion);
  const captureScoreBaseline = useCvStore(
    (state) => state.captureScoreBaseline,
  );
  const parseSignals = useCvStore((state) => state.parseSignals);
  const updateSection = useCvStore((state) => state.updateSection);
  const previewOpen = useUiStore((s) => s.previewDrawerOpen);
  const setPreviewOpen = useUiStore((s) => s.setPreviewDrawerOpen);
  const visitedSections = useUiStore((s) => s.visitedSections);
  const markSectionVisited = useUiStore((s) => s.markSectionVisited);
  const pushToast = useUiStore((s) => s.pushToast);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadTipOpen, setDownloadTipOpen] = useState(false);
  const [downloadGuardOpen, setDownloadGuardOpen] = useState(false);

  // Mobile-only Edit | Preview view switch. Defaults to "edit" on every load,
  // which is also what the server renders — keeps SSR hydration safe.
  // Desktop (xl+) ignores this state entirely: the side-by-side layout is
  // applied via CSS (Tailwind responsive utilities) so this never affects
  // the desktop UI even if the value is "preview".
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  // Desktop detection (audit PERF-1): the xl-only preview drawer used to be
  // CSS-hidden but ALWAYS MOUNTED, so every phone paid a full A4 template
  // reconciliation per keystroke commit for a drawer it could never see.
  // Server/mobile first paint renders no drawer (matching what CSS showed);
  // the drawer mounts only once the viewport is confirmed xl+.
  const [isDesktop, setIsDesktop] = useState(false);

  // If the viewport grows to xl+ (e.g. user rotates a tablet), reset to
  // "edit" so the mobile-only preview view is not left dangling in memory.
  // Client-only via useEffect — no window access at render time.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileView("edit");
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    bindCvStorage();
  }, []);

  // Step navigation lands at the top of the new step with focus on its h1.
  // The scroll container (<main>) persists across step swaps, so without
  // this a user who clicked Continue at the bottom of a long step opened
  // the next one mid-scroll, and keyboard/SR focus fell back to <body>.
  const mainRef = useRef<HTMLElement | null>(null);
  const prevStepIdRef = useRef(stepId);
  useEffect(() => {
    if (prevStepIdRef.current === stepId) return;
    prevStepIdRef.current = stepId;
    const main = mainRef.current;
    if (!main) return;
    main.scrollTo({ top: 0 });
    const heading = main.querySelector("h1");
    if (heading instanceof HTMLElement && heading.tabIndex === -1) {
      heading.focus({ preventScroll: true });
    }
  }, [stepId]);

  // No step is ever "locked" any more (audit UX-1/UX-2): the old gating made
  // skipped steps unreachable except by walking Back N times. Beads show
  // honest state and navigate freely. Guided-feedback layering (2026-06):
  // a REQUIRED section the user has visited and left incomplete gets the
  // amber "attention" state; untouched sections stay neutral so a fresh
  // user isn't greeted by four warnings. Completion comes from the shared
  // cvRequirements module (via getStepCompletion) — the same definition the
  // field badges and the export dialog read.
  const completionMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    builderSteps.forEach((step) => {
      m[step.id] = getStepCompletion(step, data);
    });
    return m;
  }, [data]);

  const statuses = useMemo(() => {
    const result: Record<string, StepStatus> = {};
    builderSteps.forEach((step) => {
      if (step.id === stepId) {
        result[step.id] = "active";
      } else if (completionMap[step.id]) {
        result[step.id] = "done";
      } else if (step.required && visitedSections[step.id]) {
        result[step.id] = "attention";
      } else {
        result[step.id] = "incomplete";
      }
    });
    return result;
  }, [completionMap, stepId, visitedSections]);

  // Section-leave feedback: when the user navigates away from a required
  // section that's still incomplete, mark it visited (amber bead) and show
  // a dismissible, NON-blocking toast naming the first missing thing.
  // Never a modal — movement is always free.
  const prevStepRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = stepId;
    if (!prev || prev === stepId) return;
    markSectionVisited(prev);
    const prevStep = builderSteps.find((s) => s.id === prev);
    if (prevStep?.required && !getStepCompletion(prevStep, data)) {
      const first = getSectionMissing(prevStep.id, data)[0];
      if (first) {
        pushToast(
          `${first.sectionTitle}: ${first.label.charAt(0).toLowerCase()}${first.label.slice(1)}. You can come back anytime.`,
          { tone: "notice" },
        );
      }
    }
    // `data` is read at navigation time; re-runs on data change exit early
    // because prev === stepId.
  }, [stepId, data, markSectionVisited, pushToast]);

  // Section-done celebration: fires when a section flips incomplete →
  // complete, once per section per browser session (sessionStorage flag —
  // revisits and reload-then-recomplete stay quiet). Skips until the store
  // has hydrated so a returning user's already-complete sections don't
  // toast on load.
  const prevCompletionRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const prev = prevCompletionRef.current;
    prevCompletionRef.current = completionMap;
    if (!prev) return;
    for (const step of builderSteps) {
      if (step.id === "review") continue; // derived — would be noise
      if (!prev[step.id] && completionMap[step.id]) {
        try {
          const key = `mmcv_done_toast_${step.id}`;
          if (window.sessionStorage.getItem(key)) continue;
          window.sessionStorage.setItem(key, "1");
        } catch {
          /* sessionStorage unavailable — still toast, once per mount */
        }
        pushToast(`${step.title} section done ✓`, {
          tone: "success",
          duration: 3000,
        });
      }
    }
  }, [completionMap, hydrated, pushToast]);

  // Score report — shown in the TopBar (number + popover) and shared with
  // ReviewStep via ScoreReportContext. Computed on DEFERRED data (audit
  // PERF-3) so the regex-heavy engine runs after urgent typing renders,
  // off the keystroke path on low-end devices.
  const deferredData = useDeferredValue(data);
  const scoreReport: ScoreReport = useMemo(
    () =>
      computeScore(deferredData, {
        mode: "builder",
        parseSignals: parseSignals ?? undefined,
      }),
    [deferredData, parseSignals],
  );

  // Delta vs the score at import time. undefined (pill hidden) when there is
  // no baseline — i.e. the CV was typed from scratch — or while the CV is still
  // empty, where a large negative would punish someone for arriving.
  const scoreBaseline = useCvStore((state) => state.scoreBaseline);
  const scoreDelta =
    scoreBaseline && scoreReport.total > 0
      ? scoreReport.total - scoreBaseline.total
      : undefined;

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

  // ---- Download (TopBar + ReviewStep + TemplatePreviewModal) ----
  // The download runs IMMEDIATELY on click — no modal in the way. On
  // success, the post-download tip jar is scheduled to appear ~1500ms
  // later, but only if the user is eligible (no recent tip + not
  // dismissed this session). Errors do NOT open the modal; the existing
  // downloadError bar handles them.
  const runDownload = async (kind: ExportKind = "pdf") => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      if (kind === "json") {
        downloadCvBackup(data);
      } else if (kind === "docx") {
        await exportToDocx(data);
      } else {
        await downloadCV(data, "pro", data.settings.templateId ?? "classic");
      }
      pushToast(EXPORT_COPY[kind].success, { tone: "success", duration: 4000 });

      /* North-star metric. Fired here and nowhere else: this is the single
         export gate for the whole builder (TopBar, ReviewStep and the template
         preview modal all route through it), and it sits after the await, so it
         only counts exports that actually produced a file — not clicks, and not
         attempts that threw.

         `json` is excluded deliberately. A backup is housekeeping, not a
         finished CV; the tip jar makes exactly that distinction three lines
         below. Counting backups here would inflate the one number the product
         gets judged on.

         No `plan` parameter: every call site passes "pro", so it would be a
         constant masquerading as a dimension. Add it when a real free/pro
         split exists. */
      if (kind !== "json") {
        track("cv_export", {
          format: kind,
          template: data.settings.templateId ?? "classic",
        });
      }
      // A backup is housekeeping, not a finished-CV moment — don't ask for a
      // tip for it.
      if (kind !== "json" && shouldShowDownloadTip()) {
        window.setTimeout(() => setDownloadTipOpen(true), 1500);
      }
    } catch {
      setDownloadError(EXPORT_COPY[kind].error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Export gate (guided feedback, 2026-06) — supersedes the wave-2
  // near-empty guard. If ANY required content is missing (per the shared
  // cvRequirements module), the export dialog lists it with "Go back and
  // fix" / "Export anyway". The only blocking interaction in the system,
  // and even it never hard-blocks. ALL exports (PDF + DOCX, every button)
  // flow through here via the DownloadContext.
  const [pendingExportKind, setPendingExportKind] = useState<ExportKind>("pdf");
  const handleDownload = async (kind: ExportKind = "pdf") => {
    // The completeness gate exists to stop a half-finished CV reaching an
    // employer. A backup of a half-finished CV is precisely what a user wants,
    // so JSON bypasses it — gating the recovery path on completeness would
    // withhold it exactly when work is most likely to be lost.
    if (kind !== "json" && getMissingItems(data).length > 0) {
      setPendingExportKind(kind);
      setDownloadGuardOpen(true);
      return;
    }
    await runDownload(kind);
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

  // One picker for both formats, routed by extension — the DOCX adapter was
  // fully implemented but unreachable because the only caller hardcoded
  // "pdf" (audit UX-4). Word CVs are the most common format among UAE job
  // seekers.
  const handleImport = async () => {
    const accept =
      ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    triggerFileInput(accept, async (file) => {
      const isDocx =
        /\.docx$/i.test(file.name) ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const source = isDocx ? "DOCX" : "PDF";
      setImportState({ phase: "parsing", source });
      try {
        // Adapters (and the textParser they pull in) load on first import,
        // not at builder first paint (audit PERF-6).
        const adapter = isDocx
          ? (await import("../../lib/importers/docxAdapter")).docxAdapter
          : (await import("../../lib/importers/pdfAdapter")).pdfAdapter;
        const parsed = await adapter.parse(file);
        setImportState({ phase: "review", source, parsed });
      } catch (err) {
        // Typed failures route to specific guidance (audit UX-18); the file
        // is untouched and the user stays in the builder — never a dead end.
        setImportState({ phase: "idle" });
        if (err instanceof ImportParseError) {
          setErrorMsg(
            err.kind === "empty-text"
              ? `${err.message} You can also try the free AI Resume Checker, which handles more layouts.`
              : err.message,
          );
        } else {
          setErrorMsg(
            `Could not read your ${source} file. Check the file and try again — or fill in your details below.`,
          );
        }
      }
    });
  };

  const handleImportConfirm = (
    partial: Partial<CvData>,
    mode: "replace" | "merge",
  ) => {
    importCvVersion(partial, mode);
    // Snapshot the "before" for the TopBar delta. Zustand set() is synchronous,
    // so this reads the CV that importCvVersion just wrote. This path sets no
    // parseSignals, so both baseline and live score run without them — the
    // comparison stays like-for-like, which is the only thing that matters.
    captureScoreBaseline();
    setImportState({ phase: "idle" });
    const n = [
      partial.personal?.firstName || partial.personal?.email ? 1 : 0,
      partial.experience?.length ? 1 : 0,
      partial.education?.length ? 1 : 0,
      partial.skills?.length ? 1 : 0,
      partial.languages?.length ? 1 : 0,
      partial.certifications?.length ? 1 : 0,
      partial.projects?.length ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    pushToast(
      `${mode === "merge" ? "Merged" : "Imported"} ${n} section${n === 1 ? "" : "s"} — review the steps below and tweak anything.`,
      { tone: "success" },
    );
  };

  const stepIsReview = stepId === "review";

  return (
    <ImportContext.Provider value={{ handleImport }}>
      <ScoreReportContext.Provider value={scoreReport}>
      <DownloadContext.Provider
        value={{ requestDownload: handleDownload, isDownloading }}
      >
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
          saveError={saveError}
          scoreReport={scoreReport}
          scoreDelta={scoreDelta}
          onTemplates={() => onStepChange("review")}
          onDownload={() => handleDownload("pdf")}
          isDownloading={isDownloading}
        />

        {/* Progress bar — segmented step focus + UAE-optimised pill */}
        <div
          style={{
            padding: "8px 28px",
            background: "var(--ff-card)",
            borderBottom: "1px solid var(--ff-line)",
            flexShrink: 0,
          }}
        >
          <StepBeads
            steps={builderSteps}
            statuses={statuses}
            currentId={stepId}
            onStepClick={(id) => onStepChange(id)}
            rightSlot={
              <span
                className="hidden md:inline-flex"
                style={{
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-body)",
                  fontSize: 10,
                  color: "var(--ff-muted)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                <UAEDot size={11} />
                UAE-Optimised
              </span>
            }
          />
        </div>

        {/* Stale-tab bar (audit A-W3-003). Another tab has saved a newer CV,
            so autosave in THIS tab is now stopped to stop it overwriting the
            newer copy. Not dismissible: dismissing would leave the user typing
            into a tab that silently no longer saves, which is worse than the
            bug this replaced. Sits above the error bar because it invalidates
            everything below it. */}
        {staleTab && (
          <div
            role="alert"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "#FFF7E6",
              borderBottom: "1px solid #F5D9A0",
              padding: "10px 24px",
            }}
          >
            <p style={{ fontSize: 13, color: "#7A4B00", fontWeight: 500 }}>
              You edited this CV in another tab. Changes here are no longer
              being saved, so they can&rsquo;t overwrite the newer version.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cv-btn-secondary"
              style={{ flexShrink: 0 }}
            >
              Reload this tab
            </button>
          </div>
        )}

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
                marginLeft: 4,
                // Padded hit area — the bare text link was ~15px tall
                // (audit UI-5 touch-target floor).
                padding: "14px 12px",
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
          {/*
            On mobile, when the Edit | Preview toggle is set to "preview" we
            hide the form so the scaled preview can take the full viewport.
            On xl+ the form is always visible (desktop side-by-side layout).
            `display: contents` keeps <main> a direct flex child of MAIN AREA
            for layout purposes — the wrapper has no box of its own.
          */}
          <div
            className={
              mobileView === "preview" && !stepIsReview
                ? "hidden xl:contents"
                : "contents"
            }
          >
            <main
              ref={mainRef}
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
                  stepIsReview
                    ? "ff-form-column ff-form-column-review"
                    : "ff-form-column"
                }
              >
                {children}
              </div>

              {/* Subtle support link — never a CTA, never a banner. Sits at the
                  bottom of the scrollable column so it appears below content
                  when the form is short and below the fold when it's long. */}
              <div
                className="ff-support-footer"
                style={{
                  marginTop: "auto",
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  color: "var(--ff-faint)",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                }}
              >
                <p style={{ marginBottom: 6, letterSpacing: "0.02em" }}>
                  Your CV lives in this browser only — we never see it. AI
                  suggestions are the one exception (sent securely, never
                  stored).
                </p>
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--ff-muted)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Built by Abdullah
                </a>
              </div>
            </main>
          </div>

          {/* Mobile preview view (xl-) — scaled A4 CV that matches the export.
              Only mounted when toggled on, AND only on steps that have a
              preview at all (not review, which has its own layout).
              `xl:hidden` ensures desktop never shows it. */}
          {mobileView === "preview" && !stepIsReview && (
            <div className="contents xl:hidden">
              <MobilePreviewView
                templateId={data.settings.templateId}
                onPrevTemplate={() => handleCycleTemplate(-1)}
                onNextTemplate={() => handleCycleTemplate(1)}
                onDownload={() => handleDownload("pdf")}
                isDownloading={isDownloading}
              />
            </div>
          )}

          {/* Preview drawer — mounted ONLY on confirmed xl+ viewports
              (audit PERF-1); the hidden/xl:block class stays as a CSS
              belt-and-braces. Hidden on the review step. */}
          {!stepIsReview && isDesktop && (
            <div className="hidden xl:block" style={{ pointerEvents: "auto" }}>
              <PreviewDrawer
                templateId={data.settings.templateId}
                onPrevTemplate={() => handleCycleTemplate(-1)}
                onNextTemplate={() => handleCycleTemplate(1)}
                onFullscreen={() => setPreviewOpen(true)}
              />
            </div>
          )}
        </div>

        {/* Mobile Edit | Preview toggle — replaces the old floating pill.
            Hidden on xl+ via Tailwind (side-by-side handles desktop). */}
        {!stepIsReview && (
          <SegmentedViewToggle
            className="inline-flex xl:hidden"
            ariaLabel="Switch between editing and previewing your CV"
            options={[
              { value: "edit", label: "Edit", icon: "edit" },
              { value: "preview", label: "Preview", icon: "eye" },
            ]}
            value={mobileView}
            onChange={setMobileView}
          />
        )}

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
                borderRadius: "var(--radius-2xl)",
                border: "1px solid var(--ff-line)",
                padding: "26px 28px",
                width: "min(360px, calc(100vw - 32px))",
                boxShadow: "var(--shadow-xl)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--ff-ink)",
                  marginBottom: 14,
                }}
              >
                Reading your {importState.source}
              </div>
              <ProcessSteps
                steps={[
                  "Reading the file",
                  "Extracting the text",
                  "Detecting sections",
                  "Mapping to your CV",
                ]}
              />
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ff-faint)",
                  lineHeight: 1.5,
                  margin: "16px 0 0",
                  paddingTop: 12,
                  borderTop: "1px solid var(--ff-line)",
                }}
              >
                This happens in your browser — your file is never uploaded. You&apos;ll
                review everything before it&apos;s added.
              </p>
            </div>
          </div>
        )}

        {importState.phase === "review" && (
          <MappingReview
            source={importState.source}
            parsed={importState.parsed}
            onConfirm={handleImportConfirm}
            onCancel={() => setImportState({ phase: "idle" })}
          />
        )}

        <DownloadTipModal
          open={downloadTipOpen}
          onClose={() => setDownloadTipOpen(false)}
          userName={data.personal.firstName?.trim() || undefined}
        />

        {/* Guided-feedback toasts (section leave/done) — aria-live polite. */}
        <Toaster />

        {/* Export gate (guided feedback) — the only blocking dialog. */}
        <ExportGateDialog
          open={downloadGuardOpen}
          missing={downloadGuardOpen ? getMissingItems(data) : []}
          onClose={() => setDownloadGuardOpen(false)}
          onGoFix={() => {
            setDownloadGuardOpen(false);
            const target = getFirstIncompleteSection(data);
            if (target) onStepChange(target);
          }}
          onExportAnyway={async () => {
            setDownloadGuardOpen(false);
            await runDownload(pendingExportKind);
          }}
        />

        {/* Inline style block — keeps the responsive form-column rules close
            to the layout that uses them. */}
        <style>{`
          .ff-form-column {
            width: 100%;
            max-width: 100%;
            /* 110px bottom padding clears the fixed Edit|Preview pill
               (bottom:20 + ~50px tall) so it can't sit on top of the
               Continue button or footer link at full scroll (audit
               PERF-7/UX). Preview mode reserves its own 96px. */
            padding: 32px 24px 110px;
          }
          @media (min-width: 768px) {
            .ff-form-column { padding: 32px 36px 110px; }
          }
          @media (min-width: 1024px) {
            /* Toggle is still visible until xl (1280px) — keep the bottom
               clearance until the drawer layout takes over. */
            .ff-form-column { padding: 36px 40px 110px; max-width: 860px; }
          }
          /* The support/privacy footer is a SIBLING of the form column (so
             it sits below content on short forms), which means the column's
             110px clearance never covered it — at full scroll the fixed
             Edit|Preview pill parked exactly on the privacy line and the
             credit link (measured 390x844, 2026-08-03). Give the footer its
             own dock clearance below xl; the pill disappears at xl. */
          .ff-support-footer {
            padding: 16px 24px 96px;
          }
          @media (min-width: 1280px) {
            .ff-support-footer { padding: 16px 24px 20px; }
          }
          @media (min-width: 1280px) {
            .ff-form-column {
              padding: 28px 24px 28px 40px;
              /* Fill the space up to 28px short of the drawer, capped at
                 --form-max for ultra-wide readability. The reservation MUST
                 live inside max-width: with a plain margin-right, an
                 over-constrained row (width:100% + margin) resolves by
                 IGNORING margin-right in LTR, and the form would slide
                 under the drawer. */
              max-width: min(
                var(--form-max),
                calc(100% - var(--drawer-w) - var(--drawer-gap) - 28px)
              );
            }
            .ff-form-column-review {
              /* Review step has no preview drawer, so it can use the whole
                 page width — capped so the 3-column grid (hero | templates |
                 customize) has enough room on wide displays. */
              max-width: clamp(1180px, 96vw, 1640px);
              margin-right: 0;
              padding: 28px 40px 28px 40px;
            }
          }
          .cv-bead-strip::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
      </DownloadContext.Provider>
      </ScoreReportContext.Provider>
    </ImportContext.Provider>
  );
};
