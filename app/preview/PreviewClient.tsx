"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";

export const PreviewClient = () => {
  const data = useCvStore((state) => state.data);
  const template = useMemo(
    () => getTemplateById(data.settings.templateId),
    [data.settings.templateId],
  );

  useEffect(() => {
    bindCvStorage();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Preview</p>
            <h1 className="font-display text-3xl font-semibold">Full-screen view</h1>
          </div>
          <Link
            href="/builder?step=review"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            Back to builder
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <template.Render data={data} />
        </div>
      </div>
    </div>
  );
};
