"use client";

import { useMemo } from "react";
import { useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { meaningfulExperience } from "../../lib/utils/experience";
import { meaningfulEducation } from "../../lib/utils/education";
import { meaningfulProjects } from "../../lib/utils/projects";
import type { CvData } from "../../lib/types/cv";

/* Empty-state ghost (Part 2 polish, 2026-08-03). Before any body section
 * has content the sheet collapses to a header stub and the pane reads as
 * a void — the live preview's "watch it build" promise is invisible at the
 * exact moment it should be selling itself. While the body is empty we
 * hold the sheet at A4 aspect and sketch where the CV will grow: three
 * fading skeleton sections under a quiet hint pill. Pure decoration
 * (aria-hidden) — it disappears with the first real body content. */
const GHOST_SECTIONS: Array<{ label: string; lines: string[]; opacity: number }> = [
  { label: "38%", lines: ["100%", "94%", "82%"], opacity: 0.9 },
  { label: "30%", lines: ["100%", "88%"], opacity: 0.6 },
  { label: "26%", lines: ["96%", "74%"], opacity: 0.35 },
];

const PreviewGhost = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0"
    style={{ top: "27%", padding: "0 10%" }}
  >
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ff-muted)",
          background: "var(--ff-paper)",
          border: "1px solid var(--ff-line)",
          borderRadius: 999,
          padding: "5px 12px",
        }}
      >
        Your CV builds here as you type
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {GHOST_SECTIONS.map((s, i) => (
        <div key={i} style={{ opacity: s.opacity }}>
          <div
            style={{
              height: 9,
              width: s.label,
              borderRadius: 4,
              background: "#CBD5E1",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {s.lines.map((w, j) => (
              <div
                key={j}
                style={{ height: 7, width: w, borderRadius: 4, background: "#E2E8F0" }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* Preview crash fallback (audit 2026-06-12, gap #2).
 * A template render crash must NOT take the form down with it — the
 * boundary isolates the preview island so the user keeps editing.
 * Recovery paths: retry the same template, or fall back to Classic
 * (most crashes are template-specific). The boundary also auto-resets
 * when the user picks a different template (resetKeys=[templateId]). */
const PreviewCrashFallback = ({
  onRetry,
  onUseClassic,
  isClassic,
}: {
  onRetry: () => void;
  onUseClassic: () => void;
  isClassic: boolean;
}) => (
  <div
    role="alert"
    className="flex min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-xl border px-6 py-10 text-center"
    style={{
      background: "var(--surface-card)",
      borderColor: "var(--border-soft)",
      boxShadow: "var(--shadow-md)",
    }}
  >
    <span
      aria-hidden
      className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
      style={{ background: "var(--ff-warn-soft)", color: "var(--ff-warn)" }}
    >
      !
    </span>
    <div>
      <p
        className="text-base font-semibold"
        style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
      >
        Preview hit a snag
      </p>
      <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
        Your CV data is safe — it autosaves in this browser as you type.
        Only the preview failed to draw.
      </p>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full px-4 py-2 text-sm font-semibold text-white"
        style={{ background: "var(--brand-primary)" }}
      >
        Reload preview
      </button>
      {!isClassic && (
        <button
          type="button"
          onClick={onUseClassic}
          className="rounded-full border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--border-medium)", color: "var(--text-body)" }}
        >
          Switch to Classic
        </button>
      )}
    </div>
  </div>
);

export const PreviewPanel = ({
  sticky = true,
  collapsed = false,
  onToggle,
  data: dataOverride,
}: {
  sticky?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  /** Render this CV instead of the store's — used by JD Match to preview
   *  staged-but-not-yet-saved changes without mutating the store. Omit it
   *  (the builder) to track the live store. */
  data?: CvData;
}) => {
  const storeData = useCvStore((state) => state.data);
  const data = dataOverride ?? storeData;
  const updateSection = useCvStore((state) => state.updateSection);
  const templateId = data.settings.templateId;
  const template = useMemo(
    () => getTemplateById(templateId),
    [templateId]
  );

  // Ghost only while EVERY body section is empty — contact details alone
  // still count as "not started" (they only fill the header).
  const bodyEmpty =
    !data.personal.summary?.trim() &&
    meaningfulExperience(data.experience).length === 0 &&
    meaningfulEducation(data.education).length === 0 &&
    data.skills.length === 0 &&
    data.certifications.length === 0 &&
    data.languages.length === 0 &&
    meaningfulProjects(data.projects).length === 0;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
      >
        Open Preview
      </button>
    );
  }

  return (
    <div className={`w-full ${sticky ? "lg:sticky lg:top-6" : ""}`}>
      <div id="cv-preview-root">
        <ErrorBoundary
          resetKeys={[templateId]}
          fallback={(reset) => (
            <PreviewCrashFallback
              onRetry={reset}
              isClassic={templateId === "classic"}
              onUseClassic={() =>
                updateSection("settings", {
                  ...data.settings,
                  templateId: "classic",
                })
              }
            />
          )}
        >
          {/* While the body is empty, hold the sheet at A4 aspect (the
              template alone collapses to a header stub) and sketch the
              ghost. Filled CVs render exactly as before — no wrapper
              constraints, multi-page height untouched. */}
          <div
            style={
              bodyEmpty
                ? {
                    position: "relative",
                    background: "#ffffff",
                    aspectRatio: "1 / 1.414",
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            <template.Render data={data} />
            {bodyEmpty && <PreviewGhost />}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
};
