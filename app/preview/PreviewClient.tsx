"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { getTemplateById } from "../../lib/templates";

export const PreviewClient = () => {
  const data = useCvStore((state) => state.data);
  const searchParams = useSearchParams();
  const isPrint = searchParams.get("print") === "1";
  const shouldAutoPrint = searchParams.get("autoprint") === "1";
  const [showDoneBar, setShowDoneBar] = useState(false);
  const autoPrintTriggeredRef = useRef(false);
  const template = useMemo(
    () => getTemplateById(data.settings.templateId),
    [data.settings.templateId],
  );

  useEffect(() => {
    bindCvStorage();
  }, []);

  useEffect(() => {
    if (!isPrint || !shouldAutoPrint || autoPrintTriggeredRef.current) return;

    autoPrintTriggeredRef.current = true;
    setShowDoneBar(false);

    let cancelled = false;
    let settleTimer: number | null = null;

    const onAfterPrint = () => {
      if (!cancelled) setShowDoneBar(true);
    };

    window.addEventListener("afterprint", onAfterPrint);

    const runAutoprint = async () => {
      if ("fonts" in document) {
        try {
          await document.fonts.ready;
        } catch {
          // Ignore font readiness failures and continue.
        }
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      await new Promise<void>((resolve) => {
        settleTimer = window.setTimeout(() => resolve(), 400);
      });

      if (!cancelled) window.print();
    };

    void runAutoprint();

    return () => {
      cancelled = true;
      if (settleTimer) window.clearTimeout(settleTimer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [isPrint, shouldAutoPrint]);

  return (
    <div className={`min-h-screen ${isPrint ? "bg-white" : "bg-slate-100"} print-root`}>
      <div
        className={`mx-auto max-w-5xl print-root ${isPrint ? "px-0 py-0" : "px-6 py-8"}`}
      >
        {!isPrint && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
                href="/preview?print=1&autoprint=1"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Export PDF
              </Link>
            </div>
          </div>
        )}

        <div
          className={`rounded-2xl border border-slate-200 bg-white shadow-sm print-surface print-root ${isPrint ? "rounded-none border-transparent shadow-none" : ""}`}
        >
          <template.Render data={data} />
        </div>
      </div>
      {isPrint && shouldAutoPrint && showDoneBar && (
        <div className="print-hide fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[calc(100%-2rem)] max-w-2xl items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg">
          <p className="text-sm text-slate-600">Done</p>
          <div className="flex gap-2">
            <Link
              href="/builder?step=review"
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm"
            >
              Back to builder
            </Link>
            <Link
              href="/export"
              className="rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white"
            >
              Back to export
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
