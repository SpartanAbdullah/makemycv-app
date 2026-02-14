"use client";

import { useMemo } from "react";
import { useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";

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
  const plan = useCvStore((state) => state.plan);
  const template = useMemo(
    () => getTemplateById(data.settings.templateId),
    [data.settings.templateId]
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
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Live Preview
            </p>
            <p className="text-sm font-semibold text-slate-700">
              {template.name}
            </p>
          </div>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-slate-500 underline"
            >
              Close
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <template.Render data={data} plan={plan} />
        </div>
      </div>
    </div>
  );
};
