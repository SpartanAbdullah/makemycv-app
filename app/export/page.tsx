"use client";

import Link from "next/link";
import { useEffect } from "react";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { downloadCV } from "../../hooks/useDownloadCV";

export default function ExportPage() {
  useEffect(() => {
    bindCvStorage();
  }, []);

  const handleDownload = () => {
    const data = useCvStore.getState().data;
    downloadCV(data, "free").catch((err) => {
      console.error("Export PDF failed:", err);
    });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Export</p>
            <h1 className="font-display text-3xl font-semibold">Download your PDF</h1>
          </div>
          <Link
            href="/builder?step=review"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            Back to builder
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">
            Export uses @react-pdf/renderer for exact A4 fidelity.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center rounded-full bg-slate-900 px-6 py-2 text-sm text-white"
            >
              Download PDF (A4)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
