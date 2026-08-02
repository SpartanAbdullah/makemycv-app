"use client";

import { useState, useEffect, useCallback } from "react";
import type { AIError, AIImproveType } from "../hooks/useAIImprove";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ModalCloseButton } from "./ui/ModalCloseButton";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  type: AIImproveType;
  results: string[];
  isLoading: boolean;
  error: AIError | null;
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
  const [cards, setCards] = useState(() =>
    results.map((r) => ({ selected: true, editing: false, text: r })),
  );

  // Reset when a new batch of suggestions arrives. Adjusting state DURING
  // render is React's documented pattern for "derive state from a prop
  // change" — React discards the in-progress render and re-runs immediately,
  // so the user never sees a frame with stale cards. The useEffect version
  // this replaces committed the stale frame first, then re-rendered.
  const [prevResults, setPrevResults] = useState(results);
  if (prevResults !== results) {
    setPrevResults(results);
    setCards(results.map((r) => ({ selected: true, editing: false, text: r })));
  }

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
            className={`rounded-xl border p-3 transition ${card.selected ? "border-[var(--ff-accent)] bg-[var(--ff-accent-soft)]" : "border-[var(--ff-line)] bg-[var(--ff-sunken)]"}`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={card.selected}
                onChange={() => toggle(i)}
                className="mt-1 accent-[var(--ff-accent)]"
              />
              {!card.editing && (
                <span className="text-sm text-[var(--ff-ink-2)] flex-1">{card.text}</span>
              )}
            </label>
            {card.editing && (
              <textarea
                rows={2}
                value={card.text}
                onChange={(e) => setText(i, e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--ff-line-strong)] px-3 py-2 text-sm focus:border-[var(--ff-accent)] focus:outline-none"
              />
            )}
            <button
              type="button"
              onClick={() => toggleEdit(i)}
              className="mt-1 text-xs font-medium text-[var(--ff-accent)] hover:text-[var(--ff-accent-dark)]"
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
        className="cv-btn-primary mt-4 w-full"
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

  // Reset on a new batch — see the note in BulletsView.
  const [prevResults, setPrevResults] = useState(results);
  if (prevResults !== results) {
    setPrevResults(results);
    setSelected(new Set(results.map((_, i) => i)));
  }

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
                ? "border-[var(--ff-accent)] bg-[var(--ff-accent)] text-white"
                : "border-[var(--ff-accent-ring)] bg-[var(--ff-accent-soft)] text-[var(--ff-accent-dark)] hover:border-[var(--ff-accent)]"
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
        className="cv-btn-primary mt-4 w-full"
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

  // Reset on a new batch — see the note in BulletsView.
  const [prevResults, setPrevResults] = useState(results);
  if (prevResults !== results) {
    setPrevResults(results);
    setTexts(results);
    setSelectedIdx(0);
    setEditingIdx(null);
  }

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
                ? "border-[var(--ff-accent)] bg-[var(--ff-accent-soft)]"
                : "border-[var(--ff-line)] hover:border-[var(--ff-line-strong)]"
            }`}
          >
            <p className="mb-1 text-xs font-bold text-[var(--ff-faint)]">
              Variation {i + 1}
            </p>
            {editingIdx === i ? (
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(i, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-lg border border-[var(--ff-line-strong)] px-3 py-2 text-sm focus:border-[var(--ff-accent)] focus:outline-none"
              />
            ) : (
              <p className="text-sm leading-relaxed text-[var(--ff-ink-2)]">{text}</p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingIdx(editingIdx === i ? null : i);
              }}
              className="mt-2 text-xs font-medium text-[var(--ff-accent)] hover:text-[var(--ff-accent-dark)]"
            >
              {editingIdx === i ? "Done editing" : "Edit this variation"}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onApply([texts[selectedIdx]])}
        className="cv-btn-primary mt-4 w-full"
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

  // Lock body scroll while open — reference-counted so overlapping modals
  // (e.g. the download tip firing over this one) release in any order.
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[var(--surface-overlay)]"
      onClick={handleBackdrop}
    >
      <div className="relative mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <ModalCloseButton onClick={onClose} className="absolute right-3 top-3" />

        {/* Header */}
        <h2 className="text-lg font-bold text-[var(--ff-ink)]">{TITLES[type]}</h2>
        <p className="mb-4 text-sm text-[var(--ff-muted)]">{SUBTITLES[type]}</p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center py-12">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[var(--ff-line)] border-t-[var(--ff-accent)]" />
            <p className="text-sm font-medium text-[var(--ff-muted)]">
              Claude is writing for you...
            </p>
            <span className="mt-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--ff-accent)]" />
          </div>
        )}

        {/* Rate-limited (per-IP server limit on /api/ai-improve) */}
        {error?.code === "RATE_LIMITED" && (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-3 text-4xl">{"\u{1F4A1}"}</span>
            <h3 className="text-base font-bold text-[var(--ff-ink)]">
              Take a breather
            </h3>
            <p className="mt-2 max-w-sm text-sm text-[var(--ff-muted)]">
              {error.message}
            </p>
            {error.supportUrl && (
              <a
                href={error.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cv-btn-primary mt-4"
              >
                Support MakeMyCV
              </a>
            )}
            {/* Free third exit — peak appreciation, possibly zero budget
                (audit ENG-18). Native share sheet first, clipboard fallback. */}
            <button
              type="button"
              onClick={async () => {
                const url = "https://makemycv.ae";
                if (typeof navigator.share === "function") {
                  try {
                    await navigator.share({
                      title: "MakeMyCV — free UAE CV builder",
                      url,
                    });
                  } catch {
                    /* share sheet dismissed */
                  }
                  return;
                }
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  /* clipboard blocked */
                }
              }}
              className="mt-3 text-sm text-[var(--ff-muted)] underline cursor-pointer hover:text-[var(--ff-ink-2)]"
            >
              Can&apos;t tip? Sharing helps too &rarr;
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 block text-center text-sm text-[var(--ff-muted)] underline cursor-pointer hover:text-[var(--ff-ink-2)]"
            >
              Continue editing
            </button>
          </div>
        )}

        {/* Generic error */}
        {error && error.code !== "RATE_LIMITED" && (
          <div className="flex flex-col items-center py-8 text-center">
            <p className="text-sm font-medium text-red-600">{error.message}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="cv-btn-secondary mt-3"
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
        <p className="mt-4 text-center text-xs text-[var(--ff-faint)]">
          {"\u2728"} Powered by Claude AI
        </p>
      </div>
    </div>
  );
}
