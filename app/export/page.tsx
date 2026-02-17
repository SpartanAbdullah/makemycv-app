"use client";

import Link from "next/link";
import { useEffect } from "react";
import { bindCvStorage } from "../../lib/store/cvStore";

export default function ExportPage() {
  useEffect(() => {
    bindCvStorage();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 print-wrapper">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print-hide">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 print-surface">
          <p className="text-sm text-slate-500">
            Export uses the same renderer as preview for exact fidelity.
          </p>
          <div className="mt-6 print-hide">
            <Link
              href="/preview?print=1&autoprint=1"
              className="inline-flex items-center rounded-full bg-slate-900 px-6 py-2 text-sm text-white"
            >
              Download PDF (A4)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
