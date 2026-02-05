"use client";

import Link from "next/link";
import { TemplateCard } from "../../components/templates/TemplateCard";
import { PreviewPanel } from "../../components/preview/PreviewPanel";
import { templates } from "../../lib/templates";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useEffect } from "react";

export default function TemplatesPage() {
  const templateId = useCvStore((state) => state.data.settings.templateId);
  const updateSection = useCvStore((state) => state.updateSection);
  const settings = useCvStore((state) => state.data.settings);

  useEffect(() => {
    bindCvStorage();
  }, []);

  const selectTemplate = (id: string) => {
    updateSection("settings", { ...settings, templateId: id });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f8f6f2)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Templates</p>
            <h1 className="font-display text-3xl font-semibold">Choose your layout</h1>
          </div>
          <Link
            href="/builder?step=review"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            Back to builder
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={templateId === template.id}
                onSelect={() => selectTemplate(template.id)}
              />
            ))}
          </div>
          <div className="hidden lg:block">
            <PreviewPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
