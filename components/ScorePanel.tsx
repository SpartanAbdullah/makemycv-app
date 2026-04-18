"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useCvStore } from "../lib/store/cvStore";
import { calculateScore } from "../lib/scoreEngine";
import { hasUsedFreeAI } from "../hooks/useAIImprove";
import type { LegacyScoreCategory as ScoreCategory } from "../lib/scoreEngine";
import type { AIImproveType } from "../hooks/useAIImprove";

/* ─── Helpers ──────────────────────────────────────────────── */

function getGradeColor(total: number) {
  if (total >= 85)
    return {
      ring: "#22c55e",
      badge: "bg-green-100 text-green-700",
      progress: "bg-green-500",
    };
  if (total >= 65)
    return {
      ring: "#3b82f6",
      badge: "bg-blue-100 text-blue-700",
      progress: "bg-blue-500",
    };
  if (total >= 40)
    return {
      ring: "#f59e0b",
      badge: "bg-amber-100 text-amber-700",
      progress: "bg-amber-500",
    };
  return {
    ring: "#ef4444",
    badge: "bg-red-100 text-red-700",
    progress: "bg-red-500",
  };
}

function getHeadline(score: number): string {
  if (score >= 85) return "\u{1F389} Outstanding! Your CV is recruiter-ready.";
  if (score >= 65) return "Almost there \u2014 a few tweaks will make it shine.";
  if (score >= 40) return "Good start. Let\u2019s strengthen your CV together.";
  return "Let\u2019s build this up \u2014 you\u2019re just getting started.";
}

const CATEGORY_SHORT: Record<string, string> = {
  "Contact Completeness": "Contact Details",
  "Professional Summary": "Summary",
  "Work Experience": "Experience",
  Education: "Education",
  Skills: "Skills",
  "ATS Compatibility": "ATS Details",
};

function getProTip(weakestName: string, isPerfect: boolean) {
  if (isPerfect)
    return {
      icon: "\u{1F680}",
      text: "Your CV looks strong! Share it with confidence. Consider tailoring it per job application for best results.",
      cta: null as string | null,
      section: null as string | null,
    };
  switch (weakestName) {
    case "Work Experience":
      return {
        icon: "\u{1F4C8}",
        text: "CVs with measurable achievements get 2x more callbacks. Add numbers to your experience bullets.",
        cta: "Improve Experience \u2192",
        section: "Work Experience",
      };
    case "Skills":
      return {
        icon: "\u{1F3AF}",
        text: "Most UAE ATS systems filter CVs by keyword density. 10+ relevant skills dramatically improves your shortlist rate.",
        cta: "Add More Skills \u2192",
        section: "Skills",
      };
    case "Professional Summary":
      return {
        icon: "\u270D\uFE0F",
        text: "Your summary is the first thing recruiters read. A strong summary with metrics increases read time by 40%.",
        cta: "Write Better Summary \u2192",
        section: "Professional Summary",
      };
    default:
      return {
        icon: "\u{1F4C8}",
        text: "UAE recruiters spend an average of 6 seconds scanning a CV. A score above 85 significantly increases your callback rate.",
        cta: `Improve ${CATEGORY_SHORT[weakestName] || weakestName} \u2192`,
        section: weakestName,
      };
  }
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type CardLevel = 1 | 2 | 3;

const AI_CTA_MAP: Record<string, { type: AIImproveType; label: string } | null> = {
  "Work Experience": { type: "bullets", label: "\u2728 AI Generate Bullets" },
  Skills: { type: "skills", label: "\u2728 AI Suggest Skills" },
  "Professional Summary": { type: "summary", label: "\u2728 AI Write Summary" },
  "ATS Compatibility": { type: "summary", label: "\u2728 AI Improve Summary" },
  "Contact Completeness": null,
  Education: null,
};

function triggerAIAndNavigate(
  aiType: AIImproveType,
  categoryName: string,
  onSectionClick?: (name: string) => void,
) {
  try {
    sessionStorage.setItem("makemycv_ai_trigger", aiType);
  } catch { /* SSR guard */ }
  onSectionClick?.(categoryName);
}

/* ─── Category Card ────────────────────────────────────────── */

function CategoryCard({
  category,
  level,
  isExpanded,
  onToggle,
  onSectionClick,
}: {
  category: ScoreCategory;
  level: CardLevel;
  isExpanded: boolean;
  onToggle: () => void;
  onSectionClick?: (name: string) => void;
}) {
  const pct =
    category.maxScore > 0 ? (category.score / category.maxScore) * 100 : 0;

  const cardClass =
    level === 1
      ? "border-2 border-amber-300 bg-white rounded-2xl shadow-sm"
      : level === 3
        ? "bg-gray-50 border border-gray-100 rounded-xl opacity-75"
        : "border border-gray-200 bg-white rounded-xl";

  const barColor =
    level === 1 ? "bg-amber-400" : level === 3 ? "bg-green-400" : "bg-blue-400";

  const handleCardClick = () => {
    if (level === 2) onToggle();
    else onSectionClick?.(category.name);
  };

  return (
    <div
      className={`${cardClass} cursor-pointer p-4 transition-shadow hover:shadow-md`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            level === 1
              ? "text-sm font-bold text-gray-900"
              : level === 3
                ? "text-sm font-medium text-gray-400"
                : "text-sm font-semibold text-gray-800"
          }
        >
          {category.name}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {level === 3 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              {"\u2713"} Perfect
            </span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                level === 1
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {category.score} / {category.maxScore}
            </span>
          )}
          {level === 2 && (
            <span
              className={`inline-block text-xs text-gray-400 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              {"\u25BC"}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar — always visible on md+ for levels 2/3; always for level 1 */}
      <div
        className={
          level === 1 || level === 3
            ? "mt-3"
            : isExpanded
              ? "mt-3"
              : "mt-3 hidden md:block"
        }
      >
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Level 1: always show all suggestions + CTA */}
      {level === 1 && category.suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {category.suggestions.map((s, i) => (
            <p
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-gray-700"
            >
              <span className="shrink-0">{"\u{1F449}"}</span>
              <span>{s}</span>
            </p>
          ))}
          {(() => {
            const aiCta = AI_CTA_MAP[category.name];
            if (aiCta) {
              const used = hasUsedFreeAI(aiCta.type);
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (used) {
                      onSectionClick?.(category.name);
                    } else {
                      triggerAIAndNavigate(aiCta.type, category.name, onSectionClick);
                    }
                  }}
                  className="mt-1 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {used ? `${aiCta.label} \u{1F512}` : aiCta.label}
                </button>
              );
            }
            return null;
          })()}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSectionClick?.(category.name);
            }}
            className="mt-1 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            Fix This Now {"\u2192"}
          </button>
        </div>
      )}

      {/* Level 2: expandable suggestions */}
      {level === 2 && isExpanded && category.suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {category.suggestions.map((s, i) => (
            <p
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-gray-700"
            >
              <span className="shrink-0">{"\u{1F4A1}"}</span>
              <span>{s}</span>
            </p>
          ))}
          {(() => {
            const aiCta = AI_CTA_MAP[category.name];
            if (aiCta) {
              const used = hasUsedFreeAI(aiCta.type);
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (used) {
                      onSectionClick?.(category.name);
                    } else {
                      triggerAIAndNavigate(aiCta.type, category.name, onSectionClick);
                    }
                  }}
                  className="mt-1 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {used ? `${aiCta.label} \u{1F512}` : aiCta.label}
                </button>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Level 2 desktop-only toggle text */}
      {level === 2 && category.suggestions.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-2 hidden text-xs font-medium text-blue-500 transition hover:text-blue-700 md:inline-block"
        >
          {isExpanded ? "\u25B2 Hide" : "\u25BC Show suggestions"}
        </button>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────── */

export function ScorePanel({
  onSectionClick,
}: {
  onSectionClick?: (sectionName: string) => void;
}) {
  const data = useCvStore((state) => state.data);
  const result = useMemo(() => calculateScore(data), [data]);
  const color = getGradeColor(result.total);
  const offset = CIRCUMFERENCE * (1 - result.total / 100);

  /* Weakest category */
  const weakestIdx = useMemo(() => {
    let idx = 0;
    let lowestRatio = Infinity;
    result.categories.forEach((cat, i) => {
      if (cat.maxScore === 0) return;
      const ratio = cat.score / cat.maxScore;
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        idx = i;
      }
    });
    return idx;
  }, [result.categories]);

  const weakest = result.categories[weakestIdx];
  const hasWeakest = weakest.score < weakest.maxScore;
  const isPerfect = result.total === 100;
  const weakestShort = CATEGORY_SHORT[weakest.name] || weakest.name;
  const pointsGap = weakest.maxScore - weakest.score;

  const weakestRef = useRef<HTMLDivElement>(null);

  /* Expand / collapse */
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = useCallback((name: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const scrollToWeakest = useCallback(() => {
    weakestRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const getLevel = useCallback(
    (cat: ScoreCategory, idx: number): CardLevel => {
      if (cat.score === cat.maxScore) return 3;
      if (hasWeakest && idx === weakestIdx) return 1;
      return 2;
    },
    [hasWeakest, weakestIdx],
  );

  const proTip = getProTip(hasWeakest ? weakest.name : "", isPerfect);
  const tipSection = proTip.section;
  const psychPercent = Math.min(Math.round(result.total * 0.95), 97);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-24 md:pb-4">
      {/* ── SECTION 1 — Hero Score Area ── */}
      <div className="flex flex-col items-center text-center">
        {/* A) Motivational headline */}
        <h2 className="mb-4 text-xl font-bold text-gray-800">
          {getHeadline(result.total)}
        </h2>

        {/* B) Circular score display */}
        <div className="relative mb-4 drop-shadow-lg">
          <svg
            width="140"
            height="140"
            viewBox="0 0 140 140"
            className="-rotate-90"
          >
            <circle
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="6"
            />
            <circle
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke={color.ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-gray-900">
              {result.total}
            </span>
            <span className="text-sm text-gray-400">/ 100</span>
          </div>
        </div>

        {/* C) Grade badge */}
        <span
          className={`mb-3 inline-block rounded-full px-5 py-1 text-xs font-bold uppercase tracking-wider ${color.badge}`}
        >
          {result.grade}
        </span>

        {/* D) Progress psychology bar */}
        <p className="mb-2 text-xs italic text-gray-500">
          Your CV is stronger than {psychPercent}% of profiles on MakeMyCV
        </p>
        <div className="w-full max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${color.progress}`}
              style={{ width: `${result.total}%` }}
            />
          </div>
        </div>

        {/* E) Primary CTA */}
        {result.total < 100 && (
          <button
            type="button"
            onClick={scrollToWeakest}
            className="mt-4 w-full max-w-xs rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {"\u{1F4CB}"} See What to Fix
          </button>
        )}
      </div>

      {/* ── SECTION 2 — Weakest Area Spotlight ── */}
      {hasWeakest && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            {"\u26A0\uFE0F"} Your weakest area
          </p>
          <p className="mt-1 text-base font-bold text-gray-800">
            {weakest.name}
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Add {pointsGap} more point{pointsGap !== 1 ? "s" : ""} to boost
            your score by +{pointsGap}
          </p>
          {weakest.suggestions[0] && (
            <p className="mt-2 text-sm text-gray-700">
              {weakest.suggestions[0]}
            </p>
          )}
          <button
            type="button"
            onClick={() => onSectionClick?.(weakest.name)}
            className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            Add {weakestShort} Now {"\u2192"}
          </button>
        </div>
      )}

      {/* ── SECTION 3 — Category Breakdown ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Breakdown
        </h3>
        {result.categories.map((cat, idx) => {
          const level = getLevel(cat, idx);
          const isWeakestCard = hasWeakest && idx === weakestIdx;
          return (
            <div key={cat.name} ref={isWeakestCard ? weakestRef : undefined}>
              <CategoryCard
                category={cat}
                level={level}
                isExpanded={expandedCards.has(cat.name)}
                onToggle={() => toggleCard(cat.name)}
                onSectionClick={onSectionClick}
              />
            </div>
          );
        })}
      </div>

      {/* ── SECTION 4 — Pro Tip ── */}
      <div className="rounded-r-xl border-l-4 border-indigo-500 bg-indigo-50 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
          <span>{proTip.icon}</span> PRO TIP
        </p>
        <p className="mt-1 text-sm leading-relaxed text-indigo-900">
          {proTip.text}
        </p>
        {proTip.cta && tipSection && (
          <button
            type="button"
            onClick={() => onSectionClick?.(tipSection)}
            className="mt-3 cursor-pointer text-sm font-semibold text-indigo-700 underline transition hover:text-indigo-900"
          >
            {proTip.cta}
          </button>
        )}
      </div>

      {/* ── SECTION 5 — Mobile Sticky Bottom Bar ── */}
      {hasWeakest && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">
                {result.total}/100 {"\u00B7"} {result.grade}
              </p>
              <p className="truncate text-xs text-gray-500">
                Weakest: {weakestShort}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSectionClick?.(weakest.name)}
              className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
            >
              Fix {weakestShort} {"\u2192"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
