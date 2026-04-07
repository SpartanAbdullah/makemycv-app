"use client";

import { useState, useEffect, useCallback } from "react";
import type { AIImproveType } from "../hooks/useAIImprove";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  type: AIImproveType;
  results: string[];
  isLoading: boolean;
  error: string | null;
  onApply: (selected: string[]) => void;
  onRetry?: () => void;
};

const TITLES: Record<AIImproveType, string> = {
  bullets: "\u2728 AI-Generated Bullets",
  skills: "\u2728 Suggested Skills for Your Profile",
  summary: "\u2728 AI-Written Summary Variations",
};

const SUBTITLES: Record<AIImproveType, string> = {
  bullets: "Select the ones you want to add, or edit before applying",
  skills: "Select the skills you want to add to your CV",
  summary: "Pick the variation that best represents you",
};

/* ─── Bullets sub-view ─────────────────────────────────────── */

function BulletsView({
  results,
  onApply,
}: {
  results: string[];
  onApply: (s: string[]) => void;
}) {
  const [cards, setCards] = useState(
    results.map((r) => ({ selected: true, editing: false, text: r })),
  );

  useEffect(() => {
    setCards(results.map((r) => ({ selected: true, editing: false, text: r })));
  }, [results]);

  const toggle = (i: number) =>
    setCards((p) => p.map((c, j) => (j === i ? { ...c, selected: !c.selected } : c)));
  const toggleEdit = (i: number) =>
    setCards((p) => p.map((c, j) => (j === i ? { ...c, editing: !c.editing } : c)));
  const setText = (i: number, t: string) =>
    setCards((p) => p.map((c, j) => (j === i ? { ...c, text: t } : c)));

  const selected = cards.filter((c) => c.selected).map((c) => c.text);

  return (
    <>
      <div className="space-y-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 transition ${card.selected ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 bg-gray-50"}`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={card.selected}
                onChange={() => toggle(i)}
                className="mt-1 accent-indigo-600"
              />
              {!card.editing && (
                <span className="text-sm text-gray-800 flex-1">{card.text}</span>
              )}
            </label>
            {card.editing && (
              <textarea
                rows={2}
                value={card.text}
                onChange={(e) => setText(i, e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            )}
            <button
              type="button"
              onClick={() => toggleEdit(i)}
              className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {card.editing ? "Done" : "Edit"}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => onApply(selected)}
        className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
      >
        Apply Selected Bullets
      </button>
    </>
  );
}

/* ─── Skills sub-view ──────────────────────────────────────── */

function SkillsView({
  results,
  onApply,
}: {
  results: string[];
  onApply: (s: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(results.map((_, i) => i)),
  );

  useEffect(() => {
    setSelected(new Set(results.map((_, i) => i)));
  }, [results]);

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const count = selected.size;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {results.map((skill, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              selected.has(i)
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {skill}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={count === 0}
        onClick={() => onApply(results.filter((_, i) => selected.has(i)))}
        className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
      >
        Add {count} Skill{count !== 1 ? "s" : ""} to My CV
      </button>
    </>
  );
}

/* ─── Summary sub-view ─────────────────────────────────────── */

function SummaryView({
  results,
  onApply,
}: {
  results: string[];
  onApply: (s: string[]) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [texts, setTexts] = useState(results);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    setTexts(results);
    setSelectedIdx(0);
    setEditingIdx(null);
  }, [results]);

  const setText = (i: number, t: string) =>
    setTexts((p) => p.map((v, j) => (j === i ? t : v)));

  return (
    <>
      <div className="space-y-3">
        {texts.map((text, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedIdx(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelectedIdx(i);
            }}
            className={`cursor-pointer rounded-xl border-2 p-4 transition ${
              selectedIdx === i
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <p className="mb-1 text-xs font-bold text-gray-400">
              Variation {i + 1}
            </p>
            {editingIdx === i ? (
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(i, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            ) : (
              <p className="text-sm leading-relaxed text-gray-700">{text}</p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingIdx(editingIdx === i ? null : i);
              }}
              className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {editingIdx === i ? "Done editing" : "Edit this variation"}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onApply([texts[selectedIdx]])}
        className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Use This Summary
      </button>
    </>
  );
}

/* ─── Main Modal ───────────────────────────────────────────── */

export function AIResultsModal({
  isOpen,
  onClose,
  type,
  results,
  isLoading,
  error,
  onApply,
  onRetry,
}: Props) {
  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdrop}
    >
      <div className="relative mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="text-lg font-bold text-gray-900">{TITLES[type]}</h2>
        <p className="mb-4 text-sm text-gray-500">{SUBTITLES[type]}</p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center py-12">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
            <p className="text-sm font-medium text-gray-600">
              Claude is writing for you...
            </p>
            <span className="mt-2 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
          </div>
        )}

        {/* Free limit reached */}
        {error === "FREE_LIMIT_REACHED" && (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-3 text-4xl">{"\u{1F512}"}</span>
            <h3 className="text-base font-bold text-gray-900">
              You&apos;ve used your free AI improvement
            </h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Upgrade to Pro to unlock unlimited AI-powered CV improvements,
              skill suggestions, and summary rewrites.
            </p>
            <button
              type="button"
              onClick={() => {
                window.open("https://makemycv.ae/#pricing", "_blank");
              }}
              className="mt-4 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Upgrade to Pro {"\u2192"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 block text-center text-sm text-gray-400 underline cursor-pointer hover:text-gray-600"
            >
              or continue editing manually
            </button>
          </div>
        )}

        {/* Error state */}
        {error && error !== "FREE_LIMIT_REACHED" && (
          <div className="flex flex-col items-center py-8 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && results.length > 0 && (
          <>
            {type === "bullets" && (
              <BulletsView results={results} onApply={onApply} />
            )}
            {type === "skills" && (
              <SkillsView results={results} onApply={onApply} />
            )}
            {type === "summary" && (
              <SummaryView results={results} onApply={onApply} />
            )}
          </>
        )}

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-gray-400">
          {"\u2728"} Powered by Claude AI {"\u00B7"} 1 free use per feature
        </p>
      </div>
    </div>
  );
}
