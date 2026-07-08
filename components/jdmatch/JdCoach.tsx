"use client";

import { useMemo, useState } from "react";
import { Icon } from "../builder/Icon";
import { WEIGHTS } from "../../lib/jdMatch/match";
import type { JdCategory, JdTerm } from "../../lib/jdMatch/types";

// Mirror the per-category fix affordances used elsewhere in the panel.
const ADD_SKILL_CATEGORIES: JdCategory[] = ["hardSkills", "tools", "softSkills", "keywords"];
const WEAVE_CATEGORIES: JdCategory[] = ["hardSkills", "keywords"];
const canAddSkill = (c: JdCategory) => ADD_SKILL_CATEGORIES.includes(c);
const canAddCert = (c: JdCategory) => c === "certifications";
const canWeave = (c: JdCategory) => WEAVE_CATEGORIES.includes(c);

const WHY: Record<JdCategory, string> = {
  hardSkills: "A core skill this role screens for.",
  tools: "Software the role expects you to know.",
  certifications: "A credential the job names.",
  softSkills: "A soft skill the job calls out.",
  keywords: "A domain term recruiters scan for.",
};

const cardBase: React.CSSProperties = { borderRadius: 14, padding: 18 };
const iconCircle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--ff-muted)",
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
  // Padded hit area (audit UI-5 touch-target floor) — vertical-only negative
  // margin keeps the layout footprint identical; reclaiming the horizontal
  // padding too would visually collapse the 10px flex gap beside Weave / Add.
  padding: "13px 4px",
  margin: "-13px 0",
};

/**
 * Guided "Coach": instead of a static wall of gaps, walk the user through the
 * highest-impact missing requirement one at a time — what it is, why it matters,
 * the score lift it earns, and the single next action — with a clear sense of
 * progress. Fixes route through the same staged Add / Weave, and the queue
 * advances as the live match result updates. (Founder design Concept 01.)
 */
export const JdCoach = ({
  terms,
  fixable,
  weaveDisabled,
  onAdd,
  onWeave,
  doneCta,
}: {
  terms: JdTerm[];
  fixable: boolean;
  weaveDisabled: boolean;
  onAdd: (category: JdCategory, term: string) => void;
  onWeave: (category: JdCategory, term: string) => void;
  /** Rendered in the all-clear state (e.g. the tailored-download CTA). */
  doneCta?: React.ReactNode;
}) => {
  // `skipped` is pure user intent for this analysis (reset per new analysis via
  // the parent's key). A skipped term that is later resolved simply leaves the
  // gap list; if it ever returns, "Revisit skipped" brings it back.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const total = terms.length;
  const covered = useMemo(() => terms.filter((t) => t.matched).length, [terms]);
  const weightedTotal = useMemo(
    () => terms.reduce((s, t) => s + WEIGHTS[t.category], 0),
    [terms],
  );
  const lift = (c: JdCategory) =>
    weightedTotal ? Math.max(1, Math.round((WEIGHTS[c] / weightedTotal) * 100)) : 0;

  // Highest-impact gaps first; skipped ones drop to the back of the mind.
  const missing = useMemo(
    () =>
      terms
        .filter((t) => !t.matched)
        .sort((a, b) => WEIGHTS[b.category] - WEIGHTS[a.category]),
    [terms],
  );
  const queue = missing.filter((t) => !skipped.has(t.term));
  const skippedRemaining = missing.filter((t) => skipped.has(t.term));
  const current = queue[0] ?? null;
  const pct = total ? Math.round((covered / total) * 100) : 0;

  // ── Every gap handled ──────────────────────────────────────────────────────
  if (!current) {
    const allClosed = missing.length === 0;
    return (
      <div
        style={{
          ...cardBase,
          background: "var(--ff-accent-soft)",
          border: "1px solid var(--ff-accent-ring)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...iconCircle, background: "var(--ff-accent-dark)" }}>
            <Icon name="check" size={15} color="#fff" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--ff-ink)" }}>
              {allClosed ? "Every gap closed" : "You've handled the gaps that matter"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ff-muted)", marginTop: 2 }}>
              {allClosed
                ? `Your CV now covers all ${total} requirements for this job.`
                : `${covered} of ${total} covered${skippedRemaining.length ? ` · ${skippedRemaining.length} skipped` : ""}.`}
            </div>
          </div>
        </div>
        {(doneCta || skippedRemaining.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" }}>
            {doneCta}
            {skippedRemaining.length > 0 && (
              <button type="button" onClick={() => setSkipped(new Set())} style={linkBtn}>
                Revisit {skippedRemaining.length} skipped
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Current focus ──────────────────────────────────────────────────────────
  const showWeave = fixable && canWeave(current.category) && !weaveDisabled;
  const showAdd = fixable && (canAddSkill(current.category) || canAddCert(current.category));
  const addLabel = canAddCert(current.category) ? "Add to certifications" : "Add to skills";

  return (
    <div style={{ ...cardBase, background: "var(--ff-card)", border: "1px solid var(--ff-accent)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ff-accent-dark)" }}>
          Next fix
        </span>
        <span style={{ fontSize: 11, color: "var(--ff-muted)", fontFamily: "var(--font-mono)" }}>
          {queue.length} {queue.length === 1 ? "gap left" : "gaps left"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--ff-ink)" }}>
          {current.term}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: "var(--ff-accent-soft)", color: "var(--ff-accent-dark)", fontSize: 12, fontWeight: 700 }}>
          +{lift(current.category)}%
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--ff-muted)", margin: "5px 0 0", lineHeight: 1.5 }}>
        {WHY[current.category]}
      </p>

      {fixable ? (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          {/* Compact tier (.cv-btn--sm, icon 13) — JdHeatmap's identical
              Weave / Add pair mirrors these exactly. Height parity across
              variants comes from the shared 1px border box math in globals. */}
          {showWeave && (
            <button type="button" className="cv-btn-primary cv-btn--sm" onClick={() => onWeave(current.category, current.term)}>
              <Icon name="sparkle" size={13} />
              Weave into a bullet
            </button>
          )}
          {showAdd && (
            <button type="button" className={`${showWeave ? "cv-btn-secondary" : "cv-btn-primary"} cv-btn--sm`} onClick={() => onAdd(current.category, current.term)}>
              <Icon name="plus" size={13} />
              {addLabel}
            </button>
          )}
          <button type="button" onClick={() => setSkipped((p) => new Set(p).add(current.term))} style={linkBtn}>
            Skip
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--ff-muted)", marginTop: 12 }}>
          Sign in to apply fixes to your CV.
        </p>
      )}

      <div style={{ height: 5, borderRadius: 999, background: "var(--ff-line)", marginTop: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--ff-accent-dark)", borderRadius: 999, transition: "width 350ms ease" }} />
      </div>
      <div style={{ fontSize: 11, color: "var(--ff-muted)", marginTop: 6 }}>
        {covered} of {total} covered
      </div>
    </div>
  );
};
