import type React from "react";
import type { CvData } from "../types/cv";
import { ClassicTemplate } from "./classic";
import { ModernTemplate } from "./modern";

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  Thumbnail: () => React.ReactElement;
  Render: ({ data }: { data: CvData }) => React.ReactElement;
};

const ClassicThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-slate-300" />
        <div className="h-2 w-20 rounded bg-slate-200" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-2 w-16 rounded bg-slate-200" />
        <div className="h-2 w-12 rounded bg-slate-200" />
      </div>
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-2 w-16 rounded bg-slate-300" />
      <div className="h-2 w-full rounded bg-slate-200" />
      <div className="h-2 w-5/6 rounded bg-slate-200" />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="h-6 rounded bg-slate-100" />
      <div className="h-6 rounded bg-slate-100" />
    </div>
  </div>
);

const ModernThumb = () => (
  <div className="h-32 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-3">
    <div className="h-4 w-16 rounded bg-emerald-200" />
    <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-slate-200" />
        <div className="h-2 w-5/6 rounded bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-emerald-100" />
        <div className="h-2 w-4/6 rounded bg-emerald-100" />
      </div>
    </div>
  </div>
);

export const templates: TemplateDefinition[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Clean single-column layout for traditional roles.",
    Thumbnail: ClassicThumb,
    Render: ClassicTemplate,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Two-column layout with a refined accent section.",
    Thumbnail: ModernThumb,
    Render: ModernTemplate,
  },
];

export const getTemplateById = (id: string) =>
  templates.find((template) => template.id === id) ?? templates[0];
