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
      <template.Render data={data} />
    </div>
  );
};
