"use client";

import { useState } from "react";
import { Icon } from "../builder/Icon";
import type { JdCategory } from "../../lib/jdMatch/types";
import type { HeatSegment } from "../../lib/jdMatch/heatmap";

// Mirror the per-category fix affordances used by the chip list (kept in sync
// with JdMatchPanel): everything non-cert adds as a skill; certs add as a cert;
// hard skills + domain keywords also offer a truthful bullet weave.
const ADD_SKILL_CATEGORIES: JdCategory[] = ["hardSkills", "tools", "softSkills", "keywords"];
const WEAVE_CATEGORIES: JdCategory[] = ["hardSkills", "keywords"];
const canAddSkill = (c: JdCategory) => ADD_SKILL_CATEGORIES.includes(c);
const canAddCert = (c: JdCategory) => c === "certifications";
const canWeave = (c: JdCategory) => WEAVE_CATEGORIES.includes(c);

const matchedSpan: React.CSSProperties = {
  background: "var(--ff-accent-soft)",
  color: "var(--ff-accent-dark)",
  borderRadius: 5,
  padding: "1px 5px",
  fontWeight: 600,
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
};

const missingSpanBase: React.CSSProperties = {
  background: "var(--ff-warn-soft)",
  color: "var(--ff-warn)",
  borderRadius: 5,
  padding: "1px 5px",
  fontWeight: 600,
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
};

const legendDot = (bg: string, border: string): React.CSSProperties => ({
  width: 11,
  height: 11,
  borderRadius: 3,
  background: bg,
  border: `1px solid ${border}`,
  display: "inline-block",
});

/**
 * Reads the pasted job description with each requirement highlighted in place —
 * green = already on your CV, amber = a gap you can fix in one tap. The intuitive
 * "see where you stand against the actual job" view. Derived from the live match
 * result, so spans flip green as fixes are staged. View-only on the JD text; the
 * fix routes through the same staged Add / Weave as the chips.
 */
export const JdHeatmap = ({
  segments,
  fixable,
  weaveDisabled,
  onAdd,
  onWeave,
}: {
  segments: HeatSegment[];
  fixable: boolean;
  weaveDisabled: boolean;
  onAdd: (category: JdCategory, term: string) => void;
  onWeave: (category: JdCategory, term: string) => void;
}) => {
  const [pick, setPick] = useState<{ category: JdCategory; term: string } | null>(null);

  const showAdd = pick && (canAddSkill(pick.category) || canAddCert(pick.category));
  const showWeave = pick && canWeave(pick.category) && !weaveDisabled;

  return (
    <div
      style={{
        background: "var(--ff-card)",
        border: "1px solid var(--ff-line)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ff-muted)",
          }}
        >
          The job, against your CV
        </span>
        <span style={{ display: "inline-flex", gap: 14, fontSize: 11, color: "var(--ff-muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={legendDot("var(--ff-accent-soft)", "var(--ff-accent-ring)")} />
            On your CV
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={legendDot("var(--ff-warn-soft)", "var(--ff-warn)")} />
            {fixable ? "Missing — tap to fix" : "Missing"}
          </span>
        </span>
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 2,
          color: "var(--ff-ink-2)",
          maxHeight: 340,
          overflowY: "auto",
        }}
      >
        {segments.map((s, i) => {
          if (s.status === "matched") {
            return (
              <span key={i} style={matchedSpan} title={`“${s.term}” is on your CV`}>
                {s.text}
              </span>
            );
          }
          if (s.status === "missing") {
            if (fixable) {
              return (
                <button
                  key={i}
                  type="button"
                  title={`Fix “${s.term}”`}
                  onClick={() => setPick({ category: s.category!, term: s.term! })}
                  style={{
                    ...missingSpanBase,
                    border:
                      pick?.term === s.term
                        ? "1px solid var(--ff-warn)"
                        : "1px dashed var(--ff-warn)",
                    cursor: "pointer",
                    font: "inherit",
                    lineHeight: "inherit",
                  }}
                >
                  {s.text}
                </button>
              );
            }
            return (
              <span key={i} style={{ ...missingSpanBase, border: "1px dashed var(--ff-warn)" }}>
                {s.text}
              </span>
            );
          }
          return <span key={i}>{s.text}</span>;
        })}
      </div>

      {pick && fixable && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--ff-warn-soft)",
            border: "1px solid var(--ff-warn)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--ff-ink)" }}>
            <strong style={{ color: "var(--ff-warn)" }}>{pick.term}</strong> — not on your CV yet
          </span>
          <span style={{ display: "inline-flex", gap: 8, marginLeft: "auto" }}>
            {showWeave && (
              <button
                type="button"
                className="cv-btn-primary"
                style={{ padding: "7px 12px", fontSize: 12.5 }}
                onClick={() => {
                  onWeave(pick.category, pick.term);
                  setPick(null);
                }}
              >
                <Icon name="sparkle" size={11} />
                Weave into a bullet
              </button>
            )}
            {showAdd && (
              <button
                type="button"
                className="cv-btn-secondary"
                style={{ padding: "7px 12px", fontSize: 12.5 }}
                onClick={() => {
                  onAdd(pick.category, pick.term);
                  setPick(null);
                }}
              >
                <Icon name="plus" size={11} />
                {canAddCert(pick.category) ? "Add to certifications" : "Add to skills"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPick(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--ff-muted)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Cancel
            </button>
          </span>
        </div>
      )}
    </div>
  );
};
