"use client";

import { useMemo } from "react";
import { useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";
import { ErrorBoundary } from "../ui/ErrorBoundary";

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
}: {
  sticky?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) => {
  const data = useCvStore((state) => state.data);
  const updateSection = useCvStore((state) => state.updateSection);
  const templateId = data.settings.templateId;
  const template = useMemo(
    () => getTemplateById(templateId),
    [templateId]
  );

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
          <template.Render data={data} />
        </ErrorBoundary>
      </div>
    </div>
  );
};
