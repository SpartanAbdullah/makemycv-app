"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";

export const PreviewClient = () => {
  const data = useCvStore((state) => state.data);
  const plan = useCvStore((state) => state.plan);
  const searchParams = useSearchParams();
  const isPrint = searchParams.get("print") === "1";
  const template = useMemo(
    () => getTemplateById(data.settings.templateId),
    [data.settings.templateId],
  );

  useEffect(() => {
    bindCvStorage();
  }, []);

  useEffect(() => {
    if (!isPrint) return;
    const timeout = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(timeout);
  }, [isPrint, data.settings.templateId]);

  return (
    <div className={`min-h-screen ${isPrint ? "bg-white" : "bg-slate-100"} print-root`}>
      <div
        className={`mx-auto max-w-5xl print-root ${isPrint ? "px-0 py-0" : "px-6 py-8"}`}
      >
        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${isPrint ? "print-hide" : ""}`}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Preview</p>
            <h1 className="font-display text-3xl font-semibold">Full-screen view</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/builder?step=review"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              Back to builder
            </Link>
            <Link
              href="/preview?print=1"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Export PDF
            </Link>
          </div>
        </div>

        <div
          className={`rounded-2xl border border-slate-200 bg-white shadow-sm print-surface print-root ${isPrint ? "rounded-none border-transparent shadow-none" : ""}`}
        >
          <template.Render data={data} plan={plan} />
        </div>
      </div>
    </div>
  );
};
