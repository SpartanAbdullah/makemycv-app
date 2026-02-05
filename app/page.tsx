"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEY } from "../lib/utils/localStorage";

export default function HomePage() {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasDraft(Boolean(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f8f6f2)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center">
        <div className="max-w-xl space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">MakeMyCV</p>
          <h1 className="font-display text-4xl leading-tight text-slate-900 md:text-5xl">
            Craft a confident CV with a guided, modern workflow.
          </h1>
          <p className="text-lg text-slate-600">
            Follow a step-by-step builder, see your resume update live, and export
            a polished PDF in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/builder?step=personal"
              className="rounded-full bg-slate-900 px-6 py-3 text-sm text-white"
            >
              Create new CV
            </Link>
            {hasDraft && (
              <Link
                href="/builder?step=review"
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm"
              >
                Continue last CV
              </Link>
            )}
            <Link
              href="/templates"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm"
            >
              Browse templates
            </Link>
          </div>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-2 w-full rounded bg-slate-100" />
              <div className="h-2 w-5/6 rounded bg-slate-100" />
              <div className="h-2 w-4/6 rounded bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-xl bg-emerald-50" />
              <div className="h-20 rounded-xl bg-amber-50" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Build with guided steps, ATS tips, and live preview.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
