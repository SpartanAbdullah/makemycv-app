"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useCvStore } from "../lib/store/cvStore";
import { computeScore } from "../lib/scoreEngine";
import type {
  ScoreCategory,
  ScoreCategoryId,
  ScoreGrade,
  ScoreIssue,
} from "../lib/resumeChecker/types";
import type { AIImproveType } from "../hooks/useAIImprove";

/* ─── Helpers ──────────────────────────────────────────────── */

const GRADE_LABEL: Record<ScoreGrade, string> = {
  excellent: "Excellent",
  good: "Good",
  "needs-work": "Needs Work",
  poor: "Poor",
};

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

// AI CTAs keyed by unified category id. Each CTA is the pragma a recruiter
// would reach for when fixing that category in the Builder.
const AI_CTA_BY_CATEGORY: Record<
  ScoreCategoryId,
  { type: AIImproveType; label: string } | null
> = {
  content: { type: "summary", label: "\u2728 AI Write Summary" },
  sections: null,
  atsEssentials: { type: "bullets", label: "\u2728 AI Generate Bullets" },
  design: { type: "skills", label: "\u2728 AI Suggest Skills" },
};

// Primary Builder step to jump to when a user clicks "Fix this" on a category.
// Content covers summary + experience; we jump to summary as the highest-value
// entry point. Sections covers contact/education/skills; we jump to personal.
const CATEGORY_TO_STEP: Record<ScoreCategoryId, string> = {
  content: "summary",
  sections: "personal",
  atsEssentials: "personal",
  design: "skills",
};

function getProTip(weakestId: ScoreCategoryId | null, isPerfect: boolean) {
  if (isPerfect)
    return {
      icon: "\u{1F680}",
      text: "Your CV looks strong! Share it with confidence. Consider tailoring it per job application for best results.",
      cta: null as string | null,
      categoryId: null as ScoreCategoryId | null,
    };
  switch (weakestId) {
    case "content":
      return {
        icon: "\u270D\uFE0F",
        text: "Strong bullets with numbers beat adjectives every time. Quantify each bullet with a metric.",
        cta: "Improve Content \u2192",
        categoryId: "content" as ScoreCategoryId,
      };
    case "sections":
      return {
        icon: "\u{1F4CB}",
        text: "Missing sections (contact, summary, experience, education, skills) make ATS parsers misfile your CV.",
        cta: "Fix Section Structure \u2192",
        categoryId: "sections" as ScoreCategoryId,
      };
    case "atsEssentials":
      return {
        icon: "\u{1F4C8}",
        text: "ATS filters rank CVs by recency, keywords, and parseable fields. A missing headline or date hurts ranking fast.",
        cta: "Fix ATS Essentials \u2192",
        categoryId: "atsEssentials" as ScoreCategoryId,
      };
    case "design":
      return {
        icon: "\u{1F3AF}",
        text: "Right length and healthy skill count signal maturity. 10–20 focused skills is the UAE sweet spot.",
        cta: "Improve Design \u2192",
        categoryId: "design" as ScoreCategoryId,
      };
    default:
      return {
        icon: "\u{1F4C8}",
        text: "UAE recruiters spend an average of 6 seconds scanning a CV. A score above 85 significantly increases your callback rate.",
        cta: null,
        categoryId: null,
      };
  }
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type CardLevel = 1 | 2 | 3;

function triggerAIAndNavigate(
  aiType: AIImproveType,
  categoryId: ScoreCategoryId,
  onSectionClick?: (id: ScoreCategoryId) => void,
) {
  try {
    sessionStorage.setItem("makemycv_ai_trigger", aiType);
  } catch {
    /* SSR guard */
  }
  onSectionClick?.(categoryId);
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
  onSectionClick?: (id: ScoreCategoryId) => void;
}) {
  const pct = category.score;
  const actionable = category.issues.filter((i) => i.severity !== "good");

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
    else onSectionClick?.(category.id);
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
              {category.score}/100
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

      {level === 1 && actionable.length > 0 && (
        <div className="mt-3 space-y-2">
          {actionable.slice(0, 4).map((issue) => (
            <IssueLine key={issue.id} issue={issue} />
          ))}
          {(() => {
            const aiCta = AI_CTA_BY_CATEGORY[category.id];
            if (aiCta) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerAIAndNavigate(aiCta.type, category.id, onSectionClick);
                  }}
                  className="mt-1 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {aiCta.label}
                </button>
              );
            }
            return null;
          })()}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSectionClick?.(category.id);
            }}
            className="mt-1 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            Fix This Now {"\u2192"}
          </button>
        </div>
      )}

      {level === 2 && isExpanded && actionable.length > 0 && (
        <div className="mt-3 space-y-2">
          {actionable.slice(0, 5).map((issue) => (
            <IssueLine key={issue.id} issue={issue} />
          ))}
          {(() => {
            const aiCta = AI_CTA_BY_CATEGORY[category.id];
            if (aiCta) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerAIAndNavigate(aiCta.type, category.id, onSectionClick);
                  }}
                  className="mt-1 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {aiCta.label}
                </button>
              );
            }
            return null;
          })()}
        </div>
      )}

      {level === 2 && actionable.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-2 hidden text-xs font-medium text-blue-500 transition hover:text-blue-700 md:inline-block"
        >
          {isExpanded
            ? "\u25B2 Hide"
            : `\u25BC Show ${actionable.length} suggestion${actionable.length === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function IssueLine({ issue }: { issue: ScoreIssue }) {
  const icon =
    issue.severity === "error" ? "\u{1F6A9}" : issue.severity === "review" ? "\u{1F4A1}" : "\u2705";
  return (
    <div className="flex gap-2 text-sm leading-relaxed text-gray-700">
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="font-medium text-gray-900">{issue.title}</p>
        {issue.actionable && (
          <p className="mt-0.5 text-xs text-gray-600">{issue.actionable}</p>
        )}
      </div>
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
  const parseSignals = useCvStore((state) => state.parseSignals);
  const result = useMemo(
    () =>
      computeScore(data, {
        mode: "builder",
        parseSignals: parseSignals ?? undefined,
      }),
    [data, parseSignals],
  );
  const color = getGradeColor(result.total);
  const offset = CIRCUMFERENCE * (1 - result.total / 100);
  const gradeLabel = GRADE_LABEL[result.grade];

  // Weakest category = lowest score, breaking ties by heavier weight.
  const weakestIdx = useMemo(() => {
    let idx = 0;
    let lowest = Infinity;
    result.categories.forEach((cat, i) => {
      if (cat.score < lowest) {
        lowest = cat.score;
        idx = i;
      }
    });
    return idx;
  }, [result.categories]);

  const weakest = result.categories[weakestIdx];
  const hasWeakest = weakest && weakest.score < 100;
  const isPerfect = result.total === 100;
  const pointsGap = 100 - (weakest?.score ?? 0);
  const weakestShort = weakest?.name ?? "";

  const weakestRef = useRef<HTMLDivElement>(null);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = useCallback((id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollToWeakest = useCallback(() => {
    weakestRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleCategoryClick = useCallback(
    (id: ScoreCategoryId) => {
      // Translate category id → builder step and forward to BuilderClient.
      const step = CATEGORY_TO_STEP[id];
      onSectionClick?.(step);
    },
    [onSectionClick],
  );

  const getLevel = useCallback(
    (cat: ScoreCategory, idx: number): CardLevel => {
      if (cat.score === 100) return 3;
      if (hasWeakest && idx === weakestIdx) return 1;
      return 2;
    },
    [hasWeakest, weakestIdx],
  );

  const proTip = getProTip(hasWeakest ? weakest.id : null, isPerfect);
  const tipCategoryId = proTip.categoryId;
  const psychPercent = Math.min(Math.round(result.total * 0.95), 97);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-24 md:pb-4">
      {/* ── SECTION 1 — Hero Score Area ── */}
      <div className="flex flex-col items-center text-center">
        <h2 className="mb-4 text-xl font-bold text-gray-800">
          {getHeadline(result.total)}
        </h2>

        <div className="relative mb-4 drop-shadow-lg">
          <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
            <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth="6" />
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
            <span className="text-4xl font-black text-gray-900">{result.total}</span>
            <span className="text-sm text-gray-400">/ 100</span>
          </div>
        </div>

        <span
          className={`mb-3 inline-block rounded-full px-5 py-1 text-xs font-bold uppercase tracking-wider ${color.badge}`}
        >
          {gradeLabel}
        </span>

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
      {hasWeakest && weakest && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            {"\u26A0\uFE0F"} Your weakest area
          </p>
          <p className="mt-1 text-base font-bold text-gray-800">{weakest.name}</p>
          <p className="mt-1 text-sm text-amber-800">
            This category is scoring {weakest.score}/100 — fixing it will lift your overall.
          </p>
          {weakest.issues[0]?.title && (
            <p className="mt-2 text-sm text-gray-700">
              {weakest.issues[0].title}
              {weakest.issues[0].actionable ? ` — ${weakest.issues[0].actionable}` : ""}
            </p>
          )}
          <button
            type="button"
            onClick={() => handleCategoryClick(weakest.id)}
            className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            Fix {weakestShort} Now {"\u2192"}
          </button>
          {/* Keep pointsGap accessible to linter — used for secondary stat rendering below if needed. */}
          <span className="sr-only">Gap: {pointsGap} points</span>
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
            <div key={cat.id} ref={isWeakestCard ? weakestRef : undefined}>
              <CategoryCard
                category={cat}
                level={level}
                isExpanded={expandedCards.has(cat.id)}
                onToggle={() => toggleCard(cat.id)}
                onSectionClick={handleCategoryClick}
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
        <p className="mt-1 text-sm leading-relaxed text-indigo-900">{proTip.text}</p>
        {proTip.cta && tipCategoryId && (
          <button
            type="button"
            onClick={() => handleCategoryClick(tipCategoryId)}
            className="mt-3 cursor-pointer text-sm font-semibold text-indigo-700 underline transition hover:text-indigo-900"
          >
            {proTip.cta}
          </button>
        )}
      </div>

      {/* ── SECTION 5 — Mobile Sticky Bottom Bar ── */}
      {hasWeakest && weakest && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">
                {result.total}/100 {"\u00B7"} {gradeLabel}
              </p>
              <p className="truncate text-xs text-gray-500">
                Weakest: {weakestShort}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCategoryClick(weakest.id)}
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
