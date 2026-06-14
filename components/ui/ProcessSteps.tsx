"use client";

import { useEffect, useState } from "react";
import { Icon } from "../builder/Icon";

/**
 * A reassuring, stepped "what's happening" status for short async work (import
 * parsing, JD analysis, etc.). The labels are the REAL phases the work passes
 * through; since the underlying operations don't emit progress events, the
 * checklist advances on a gentle timer and then HOLDS on the last step until the
 * parent unmounts it (i.e. the work finished). It never loops or claims "done"
 * on its own — completion is signalled by the parent swapping it out.
 *
 * Rendered as an aria-live region so screen-reader users hear each phase.
 */
export const ProcessSteps = ({
  steps,
  intervalMs = 850,
  compact = false,
}: {
  steps: string[];
  intervalMs?: number;
  compact?: boolean;
}) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= steps.length - 1) return;
    const t = setTimeout(() => setIdx((i) => Math.min(i + 1, steps.length - 1)), intervalMs);
    return () => clearTimeout(t);
  }, [idx, steps.length, intervalMs]);

  return (
    <ul
      role="status"
      aria-live="polite"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 9 : 11,
        textAlign: "left",
      }}
    >
      {steps.map((label, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: i > idx ? 0.5 : 1,
              transition: "opacity 220ms ease",
            }}
          >
            <span style={{ width: 18, height: 18, display: "grid", placeItems: "center", flexShrink: 0 }}>
              {done ? (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--ff-accent)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name="check" size={10} strokeWidth={3} color="#fff" />
                </span>
              ) : active ? (
                <span
                  style={{
                    width: 15,
                    height: 15,
                    border: "2px solid var(--ff-line)",
                    borderTopColor: "var(--ff-accent)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ff-line-strong)" }} />
              )}
            </span>
            <span
              style={{
                fontSize: compact ? 13 : 14,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--ff-ink)" : done ? "var(--ff-muted)" : "var(--ff-faint)",
                lineHeight: 1.3,
              }}
            >
              {label}
              {active ? "…" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
