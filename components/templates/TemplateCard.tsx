"use client";

import { TemplateDefinition } from "../../lib/templates";

export const TemplateCard = ({
  template,
  selected,
  onSelect,
}: {
  template: TemplateDefinition;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-2xl border p-4 text-left transition ${
      selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
    }`}
  >
    <template.Thumbnail />
    <div className="mt-4">
      <h3 className="text-base font-semibold text-slate-700">{template.name}</h3>
      <p className="text-sm text-slate-500">{template.description}</p>
    </div>
  </button>
);
