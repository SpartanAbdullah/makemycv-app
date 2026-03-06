"use client";

import Link from "next/link";
import { useState } from "react";
import { LINKEDIN_IMPORT_ENABLED } from "../../lib/importers/linkedinAdapter";

type ImportType = "pdf" | "docx" | "linkedin";

type Props = {
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  progressPct: number;
  onImport: (type: ImportType) => void;
  onExportDocx: () => void;
};

export const BuilderHeader = ({
  stepTitle,
  stepIndex,
  totalSteps,
  progressPct,
  onImport,
  onExportDocx,
}: Props) => {
  const [importMenuOpen, setImportMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Left: logo + step info */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="flex-shrink-0">
            <span className="font-display text-lg font-semibold text-slate-900">
              MakeMyCV
            </span>
          </Link>

          <div className="hidden sm:block h-4 w-px bg-slate-200" />

          <div className="hidden sm:block min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">
              {stepTitle}
            </p>
            <p className="text-xs text-slate-400">
              Step {stepIndex + 1} of {totalSteps}
            </p>
          </div>
        </div>

        {/* Centre: progress bar (desktop) */}
        <div
          className="hidden md:block flex-1 max-w-xs mx-4"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`CV completion: ${progressPct}%`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Completion</span>
            <span className="text-xs font-semibold text-slate-700">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Import dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setImportMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={importMenuOpen}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Import
              <svg
                className={`h-3 w-3 transition-transform ${importMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {importMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setImportMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <ImportMenuItem
                    label="Import PDF"
                    description=".pdf resume"
                    onClick={() => {
                      setImportMenuOpen(false);
                      onImport("pdf");
                    }}
                  />
                  <ImportMenuItem
                    label="Import DOCX"
                    description=".docx resume"
                    onClick={() => {
                      setImportMenuOpen(false);
                      onImport("docx");
                    }}
                  />
                  {LINKEDIN_IMPORT_ENABLED && (
                    <ImportMenuItem
                      label="Import LinkedIn"
                      description="Paste profile text"
                      onClick={() => {
                        setImportMenuOpen(false);
                        onImport("linkedin");
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Export DOCX */}
          <button
            type="button"
            onClick={onExportDocx}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export DOCX
          </button>

          {/* Export PDF */}
          <Link
            href="/preview?print=1&autoprint=1"
            className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Export PDF
          </Link>
        </div>
      </div>

      {/* Mobile progress bar */}
      <div
        className="md:hidden h-1 bg-slate-100"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`CV completion: ${progressPct}%`}
      >
        <div
          className="h-1 bg-emerald-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>
  );
};

const ImportMenuItem = ({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="w-full px-4 py-2.5 text-left hover:bg-slate-50"
  >
    <p className="text-sm font-medium text-slate-700">{label}</p>
    <p className="text-xs text-slate-400">{description}</p>
  </button>
);
