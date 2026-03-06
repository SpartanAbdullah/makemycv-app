"use client";

import { useState } from "react";

type Props = {
  onSubmit: (text: string) => void;
  onCancel: () => void;
};

export const LinkedInImportModal = ({ onSubmit, onCancel }: Props) => {
  const [text, setText] = useState("");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import from LinkedIn"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Import from LinkedIn
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-slate-900">
              Paste your LinkedIn profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            Open your LinkedIn profile, select all text (Ctrl/Cmd + A), copy
            it, and paste it below. We&apos;ll extract your work history,
            education, and skills automatically.
          </p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Pasted profile text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your LinkedIn profile text here..."
              rows={10}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
              aria-label="LinkedIn profile text"
            />
          </label>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            <strong>Tip:</strong> On your LinkedIn profile page, use &ldquo;More → Save to PDF&rdquo;
            and upload the PDF instead for better results.
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => onSubmit(text)}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Parse Profile
          </button>
        </div>
      </div>
    </div>
  );
};
