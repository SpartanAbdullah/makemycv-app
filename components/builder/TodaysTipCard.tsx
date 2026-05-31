"use client";

import { useEffect, useMemo } from "react";
import { useUiStore } from "../../lib/store/uiStore";
import { getDailyTipIndex, resolveTipForStep, type UaeTip } from "../../lib/data/tips";
import { UAEDot } from "./UAEDot";
import { Icon } from "./Icon";

type Props = {
  stepId?: UaeTip["stepId"];
  /** When true, lays out as a compact horizontal card for use on review-only screens. */
  compact?: boolean;
};

export const TodaysTipCard = ({ stepId, compact = false }: Props) => {
  const currentTipIndex = useUiStore((s) => s.currentTipIndex);
  const setCurrentTipIndex = useUiStore((s) => s.setCurrentTipIndex);

  // First render of the session — pick the daily rotation index.
  useEffect(() => {
    if (currentTipIndex < 0) {
      setCurrentTipIndex(getDailyTipIndex());
    }
  }, [currentTipIndex, setCurrentTipIndex]);

  const resolved = useMemo(
    () => resolveTipForStep(stepId, Math.max(0, currentTipIndex)),
    [stepId, currentTipIndex],
  );
  const { tip, positionLabel } = resolved;

  const cycle = (direction: 1 | -1) => {
    const next = Math.max(0, currentTipIndex) + direction;
    setCurrentTipIndex(next);
  };

  return (
    <div
      className="tip-card tip-card-animate"
      style={compact ? { minHeight: 0 } : undefined}
      key={tip.id}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <UAEDot size={13} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ff-accent-dark)",
              letterSpacing: "0.18em",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Today&apos;s tip
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ff-muted)",
            letterSpacing: "0.08em",
          }}
        >
          {positionLabel}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: compact ? "8px 0" : "10px 0 6px",
          gap: 10,
        }}
      >
        <p className="tip-quote" style={{ margin: 0 }}>
          &ldquo;{tip.quote}&rdquo;
        </p>
        <p className="tip-citation" style={{ margin: 0 }}>
          {tip.citation}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 10,
          borderTop: "1px solid rgba(14,124,74,0.22)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--ff-accent-dark)",
            fontWeight: 600,
          }}
        >
          UAE-rooted research
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => cycle(-1)}
            aria-label="Previous tip"
            style={chevronBtn}
          >
            <Icon name="chevron-left" size={13} color="var(--ff-muted)" />
          </button>
          <button
            type="button"
            onClick={() => cycle(1)}
            aria-label="Next tip"
            style={chevronBtn}
          >
            <Icon name="chevron-right" size={13} color="var(--ff-muted)" />
          </button>
        </div>
      </div>
    </div>
  );
};

const chevronBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  background: "var(--ff-card)",
  border: "1px solid var(--ff-line)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  padding: 0,
};
