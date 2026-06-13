"use client";

import { useEffect, useMemo, useState } from "react";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useJdMatch } from "../../hooks/useJdMatch";
import { useBulletRewrite } from "../../hooks/useBulletRewrite";
import { matchRequirementsToCv } from "../../lib/jdMatch/match";
import {
  addCertificationToCv,
  addSkillToCv,
  applyBulletRewrite,
} from "../../lib/jdMatch/applyFix";
import { Icon } from "../builder/Icon";
import {
  JD_BAND_LABELS,
  JD_CATEGORY_LABELS,
  JD_MIN_TEXT,
  type JdCategory,
  type JdCategoryResult,
} from "../../lib/jdMatch/types";
import type { CvExperience } from "../../lib/types/cv";

const BAND_COLOR: Record<string, string> = {
  strong: "var(--ff-accent)",
  good: "var(--ff-accent)",
  partial: "var(--ff-warn)",
  low: "var(--ff-red)",
};

// Which fix affordance each JD category gets on its MISSING chips. Per the
// Phase B spec: all non-cert buckets can be added as a skill; certifications
// add as a certification; hard skills and domain keywords (the ones better
// evidenced in experience) ALSO offer a truthful bullet "weave".
const ADD_SKILL_CATEGORIES: JdCategory[] = ["hardSkills", "tools", "softSkills", "keywords"];
const WEAVE_CATEGORIES: JdCategory[] = ["hardSkills", "keywords"];
const canAddSkill = (c: JdCategory) => ADD_SKILL_CATEGORIES.includes(c);
const canAddCert = (c: JdCategory) => c === "certifications";
const canWeave = (c: JdCategory) => WEAVE_CATEGORIES.includes(c);

/**
 * JD Match panel.
 *  - Phase A: paste a JD → match score + matched/missing keywords by category.
 *  - Phase B: one-click apply-fixes on missing chips — "Add" a skill/cert
 *    (local, instant, deduped) or "Weave" a keyword into a bullet (AI rewrite
 *    that never fabricates). Gated behind isPro. The result is derived live
 *    from the store CV, so every fix recomputes the score and flips chips.
 *
 * Privacy: the CV never leaves the browser. Only the JD text (analyse) and a
 * single bullet+keyword+roleTitle (weave) are ever sent to the server.
 */
export const JdMatchPanel = () => {
  const cv = useCvStore((s) => s.data);
  const hydrated = useCvStore((s) => s.hydrated);
  const isPro = useCvStore((s) => s.isPro);
  const setData = useCvStore((s) => s.setData);
  const { run, requirements, isLoading, error, clear } = useJdMatch();
  const [jobText, setJobText] = useState("");
  // Which missing term is mid-weave (keyed by term string — chip positions
  // shift as fixes flip terms from missing to matched).
  const [weave, setWeave] = useState<{ category: JdCategory; term: string } | null>(null);
  // Set after applying a weave whose wording paraphrased the keyword instead
  // of using it literally, so the term's chip won't flip (the matcher is
  // literal/alias-based) — we tell the user rather than leave them puzzled.
  const [weaveNote, setWeaveNote] = useState<string | null>(null);

  // Standalone page: hydrate the store ourselves (idempotent). See Phase A.
  useEffect(() => {
    bindCvStorage();
  }, []);

  // Reactive result: re-runs the deterministic matcher against the LIVE store
  // CV whenever a fix mutates it, so chips flip to matched (aliases included)
  // and the score updates with zero extra bookkeeping.
  const result = useMemo(
    () => (requirements ? matchRequirementsToCv(requirements, cv) : null),
    [requirements, cv],
  );

  // Roles that have at least one non-empty bullet are the only valid weave
  // targets — we never "rewrite" an empty bullet (that would be fabricating).
  const weavableRoles = useMemo(
    () => cv.experience.filter((r) => r.bullets.some((b) => b.trim())),
    [cv.experience],
  );

  const tooShort = jobText.trim().length < JD_MIN_TEXT;
  const disabled = tooShort || isLoading || !hydrated;

  const onAnalyze = () => {
    if (disabled) return;
    setWeave(null);
    setWeaveNote(null);
    run(jobText.trim());
  };

  // Writes read FRESH store state (avoid stale-closure lost updates when chips
  // are clicked in quick succession); the applyFix helpers are immutable and
  // dedupe case-insensitively.
  const handleAdd = (category: JdCategory, term: string) => {
    const fresh = useCvStore.getState().data;
    setData(
      category === "certifications"
        ? addCertificationToCv(fresh, term)
        : addSkillToCv(fresh, term),
    );
  };

  const handleApplyWeave = (
    experienceId: string,
    bulletIndex: number,
    text: string,
  ) => {
    const next = applyBulletRewrite(
      useCvStore.getState().data,
      experienceId,
      bulletIndex,
      text,
    );
    setData(next);
    // If the woven wording paraphrased the keyword instead of using it
    // literally, the (literal/alias) matcher won't credit it — surface that
    // rather than silently leaving the chip a gap after an apply.
    const term = weave?.term;
    const stillMissing =
      !!term &&
      !!requirements &&
      matchRequirementsToCv(requirements, next).categories.some((c) =>
        c.missing.includes(term),
      );
    setWeaveNote(
      stillMissing
        ? `Applied to your bullet. “${term}” now reads as a close paraphrase rather than the exact keyword, so its chip stays a gap — that's fine for a human reader, but Weave it again and pick the variant that uses “${term}” word-for-word if you want it to count toward the match.`
        : null,
    );
    setWeave(null);
  };

  const fixable = isPro && hydrated;
  const hasGaps = result ? result.matchedCount < result.totalRequirements : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 700,
            color: "var(--ff-ink)",
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          JD Match
        </h1>
        <p style={{ fontSize: 14, color: "var(--ff-muted)", lineHeight: 1.55, maxWidth: 560 }}>
          Paste a job description and see how well your CV matches it — the
          score, the keywords you already cover, and the ones you&apos;re
          missing. Your CV stays in your browser; only the job text is sent to
          analyse it, and it&apos;s never stored.
        </p>
      </div>

      {/* Paste box */}
      <div>
        <textarea
          className="cv-input"
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          placeholder="Paste the full job description here…"
          rows={9}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 160,
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--ff-faint)", fontFamily: "var(--font-mono)" }}>
            {jobText.trim().length} chars
            {tooShort && jobText.length > 0 ? " · paste a bit more" : ""}
          </span>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={disabled}
            className="cv-btn-primary"
            style={{
              padding: "11px 20px",
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Icon name="sparkle" size={13} />
            {isLoading ? "Analysing…" : "Check match"}
          </button>
        </div>
        {!hydrated && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--ff-faint)" }}>
            Loading your saved CV…
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#FBEFED",
            border: "1px solid #F2D2CE",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--ff-red)", fontWeight: 500 }}>
            {error.message}
          </p>
          {error.code === "RATE_LIMITED" && error.supportUrl ? (
            <a
              href={error.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ff-accent-dark)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Support MakeMyCV
            </a>
          ) : (
            <button
              type="button"
              onClick={onAnalyze}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ff-ink)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Score header (recomputes live as fixes apply) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: 18,
              background: "var(--ff-card)",
              border: "1px solid var(--ff-line)",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                border: `3px solid ${BAND_COLOR[result.band]}`,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 24,
                color: "var(--ff-ink)",
                transition: "border-color 300ms",
              }}
            >
              {result.score}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 600,
                  color: BAND_COLOR[result.band],
                }}
              >
                {JD_BAND_LABELS[result.band]}
              </div>
              <div style={{ fontSize: 13, color: "var(--ff-muted)", marginTop: 2 }}>
                {result.matchedCount} of {result.totalRequirements} requirements covered
                {result.jobTitle ? ` · ${result.jobTitle}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={clear}
              style={{
                marginLeft: "auto",
                alignSelf: "flex-start",
                background: "none",
                border: "none",
                color: "var(--ff-muted)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear
            </button>
          </div>

          {/* Fix helper (Pro, unlocked) or locked CTA */}
          {hydrated && isPro && hasGaps && (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ff-muted)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              Close the gaps without leaving this page: <strong style={{ color: "var(--ff-ink-2)" }}>Add</strong> a
              missing skill to your CV, or <strong style={{ color: "var(--ff-ink-2)" }}>Weave</strong> a
              keyword into one of your bullets. Nothing changes until you click —
              and rewrites only re-word what you already wrote, never inventing
              anything.
            </p>
          )}
          {hydrated && !isPro && hasGaps && <ProLockBanner />}

          {/* Post-apply note when a woven keyword stayed a paraphrase */}
          {weaveNote && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--ff-sunken)",
                border: "1px solid var(--ff-line)",
              }}
            >
              <p style={{ flex: 1, fontSize: 12.5, color: "var(--ff-muted)", lineHeight: 1.55, margin: 0 }}>
                {weaveNote}
              </p>
              <button
                type="button"
                onClick={() => setWeaveNote(null)}
                style={{
                  flexShrink: 0,
                  background: "none",
                  border: "none",
                  color: "var(--ff-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Categories with per-chip fixes */}
          {result.categories.map((cat) => (
            <CategoryBlock
              key={cat.category}
              cat={cat}
              fixable={fixable}
              weaveDisabled={weavableRoles.length === 0}
              activeWeaveTerm={weave?.term ?? null}
              onAdd={handleAdd}
              onWeave={(category, term) => {
                setWeaveNote(null);
                setWeave({ category, term });
              }}
            />
          ))}

          {/* Inline bullet weaver (truthful AI rewrite of one chosen bullet) */}
          {weave && fixable && weavableRoles.length > 0 && (
            <BulletWeaver
              key={weave.term}
              term={weave.term}
              roles={weavableRoles}
              onApply={handleApplyWeave}
              onClose={() => setWeave(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Locked-state CTA (renders only when isPro is false) ───────────────────
   isPro is force-true today, so this is dead at runtime; it is built for when
   the paid tier returns. Honest, no fake urgency, no countdown. */
const ProLockBanner = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 16px",
      borderRadius: 12,
      background: "var(--ff-sunken)",
      border: "1px dashed var(--ff-line-strong)",
    }}
  >
    <Icon name="lock" size={16} color="var(--ff-muted)" />
    <p style={{ fontSize: 13, color: "var(--ff-muted)", lineHeight: 1.55, margin: 0 }}>
      <strong style={{ color: "var(--ff-ink-2)" }}>One-click fixes are a Pro feature.</strong>{" "}
      With Pro you can add a missing skill to your CV in one tap, or weave a
      keyword into a bullet — without ever inventing experience. Pro is
      returning soon.
    </p>
  </div>
);

const miniBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid var(--ff-accent-ring)",
  background: "var(--ff-accent-soft)",
  color: "var(--ff-accent-dark)",
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/* ─── A missing term with its fix affordances ─────────────────────────────── */
const MissingFix = ({
  category,
  term,
  fixable,
  weaveDisabled,
  active,
  onAdd,
  onWeave,
}: {
  category: JdCategory;
  term: string;
  fixable: boolean;
  weaveDisabled: boolean;
  active: boolean;
  onAdd: (category: JdCategory, term: string) => void;
  onWeave: (category: JdCategory, term: string) => void;
}) => {
  const showAdd = fixable && (canAddSkill(category) || canAddCert(category));
  const showWeave = fixable && canWeave(category);
  const addTitle = canAddCert(category)
    ? `Add “${term}” to your certifications`
    : `Add “${term}” to your skills`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px 5px 11px",
        borderRadius: 999,
        fontSize: 12.5,
        fontFamily: "var(--font-body)",
        background: "var(--ff-card)",
        color: "var(--ff-ink-2)",
        border: active
          ? "1px solid var(--ff-accent)"
          : "1px dashed var(--ff-line-strong)",
      }}
    >
      <span>{term}</span>
      {!fixable ? (
        <Icon name="lock" size={11} color="var(--ff-faint)" />
      ) : (
        <span style={{ display: "inline-flex", gap: 4 }}>
          {showAdd && (
            <button
              type="button"
              title={addTitle}
              onClick={() => onAdd(category, term)}
              style={miniBtn}
            >
              <Icon name="plus" size={10} />
              Add
            </button>
          )}
          {showWeave && (
            <button
              type="button"
              title={
                weaveDisabled
                  ? "Add an experience bullet first"
                  : `Weave “${term}” into one of your bullets`
              }
              onClick={() => !weaveDisabled && onWeave(category, term)}
              disabled={weaveDisabled}
              style={{
                ...miniBtn,
                background: "transparent",
                opacity: weaveDisabled ? 0.5 : 1,
                cursor: weaveDisabled ? "not-allowed" : "pointer",
              }}
            >
              <Icon name="sparkle" size={10} />
              Weave
            </button>
          )}
        </span>
      )}
    </span>
  );
};

const Chip = ({ label }: { label: string }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 12.5,
      fontFamily: "var(--font-body)",
      background: "var(--ff-accent-soft)",
      color: "var(--ff-accent-dark)",
      border: "1px solid var(--ff-accent-ring)",
    }}
  >
    <Icon name="check" size={11} />
    {label}
  </span>
);

const CategoryBlock = ({
  cat,
  fixable,
  weaveDisabled,
  activeWeaveTerm,
  onAdd,
  onWeave,
}: {
  cat: JdCategoryResult;
  fixable: boolean;
  weaveDisabled: boolean;
  activeWeaveTerm: string | null;
  onAdd: (category: JdCategory, term: string) => void;
  onWeave: (category: JdCategory, term: string) => void;
}) => {
  const total = cat.matched.length + cat.missing.length;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
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
          {JD_CATEGORY_LABELS[cat.category]}
        </span>
        <span style={{ fontSize: 11, color: "var(--ff-faint)", fontFamily: "var(--font-mono)" }}>
          {cat.matched.length}/{total}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cat.missing.map((t) => (
          <MissingFix
            key={`m-${t}`}
            category={cat.category}
            term={t}
            fixable={fixable}
            weaveDisabled={weaveDisabled}
            active={activeWeaveTerm === t}
            onAdd={onAdd}
            onWeave={onWeave}
          />
        ))}
        {cat.matched.map((t) => (
          <Chip key={`y-${t}`} label={t} />
        ))}
      </div>
    </div>
  );
};

/* ─── Inline bullet weaver ──────────────────────────────────────────────────
   Pick a role + an existing non-empty bullet, ask the server for a truthful
   rewrite that surfaces the keyword (only { bullet, keyword, roleTitle } is
   sent), review, and apply. An empty result is an honest "can't do that
   truthfully", not an error. */
const fieldLabelText: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ff-muted)",
};

const longestNonEmpty = (bullets: string[]): number => {
  let best = -1;
  let bestLen = -1;
  bullets.forEach((b, i) => {
    if (b.trim() && b.length > bestLen) {
      best = i;
      bestLen = b.length;
    }
  });
  return best === -1 ? 0 : best;
};

const BulletWeaver = ({
  term,
  roles,
  onApply,
  onClose,
}: {
  term: string;
  roles: CvExperience[];
  onApply: (experienceId: string, bulletIndex: number, text: string) => void;
  onClose: () => void;
}) => {
  const { rewrite, variants, isLoading, error, clear } = useBulletRewrite();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const [bulletIndex, setBulletIndex] = useState(() =>
    longestNonEmpty(roles[0]?.bullets ?? []),
  );

  // On role switch: default to that role's longest bullet and drop stale
  // variants (they belonged to the previous bullet).
  useEffect(() => {
    if (role) setBulletIndex(longestNonEmpty(role.bullets));
    clear();
    // role and clear are stable for a given roleId; key the reset on roleId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const bulletOptions = role
    ? role.bullets
        .map((text, index) => ({ text, index }))
        .filter((o) => o.text.trim())
    : [];
  const selectedBullet = role?.bullets[bulletIndex] ?? "";

  const onGenerate = () => {
    if (!selectedBullet.trim() || isLoading) return;
    rewrite(selectedBullet, term, role?.role ?? "");
  };

  const refused =
    variants !== null && variants.length === 0 && !isLoading && !error;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        borderRadius: 12,
        background: "var(--ff-sunken)",
        border: "1px solid var(--ff-line-strong)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ff-ink)",
            }}
          >
            <Icon name="sparkle" size={13} />
            Weave “{term}” into a bullet
          </div>
          <div style={{ fontSize: 12, color: "var(--ff-muted)", marginTop: 3, lineHeight: 1.5, maxWidth: 460 }}>
            We only re-word what your bullet already says — if “{term}” can&apos;t
            be added truthfully, we&apos;ll tell you instead of inventing it.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--ff-muted)",
            fontSize: 12,
            cursor: "pointer",
            textDecoration: "underline",
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      </div>

      {/* Role selector (only when there is a choice) */}
      {roles.length > 1 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabelText}>Role</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              padding: "9px 10px",
              borderRadius: 8,
              border: "1px solid var(--ff-line)",
              background: "var(--ff-card)",
              color: "var(--ff-ink)",
            }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {(r.role || "Untitled role") + (r.company ? ` · ${r.company}` : "")}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Bullet picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={fieldLabelText}>Which bullet to improve?</span>
        {bulletOptions.map((opt) => {
          const selected = opt.index === bulletIndex;
          return (
            <button
              key={opt.index}
              type="button"
              onClick={() => {
                setBulletIndex(opt.index);
                clear();
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                textAlign: "left",
                padding: "9px 11px",
                borderRadius: 9,
                background: "var(--ff-card)",
                border: selected
                  ? "1px solid var(--ff-accent)"
                  : "1px solid var(--ff-line)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <span style={{ marginTop: 1, flexShrink: 0, color: selected ? "var(--ff-accent)" : "var(--ff-faint)" }}>
                <Icon name={selected ? "check" : "plus"} size={11} />
              </span>
              <span style={{ fontSize: 13, color: "var(--ff-ink-2)", lineHeight: 1.45 }}>
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isLoading || !selectedBullet.trim()}
        className="cv-btn-primary"
        style={{
          alignSelf: "flex-start",
          padding: "10px 16px",
          opacity: isLoading || !selectedBullet.trim() ? 0.6 : 1,
          cursor: isLoading || !selectedBullet.trim() ? "not-allowed" : "pointer",
        }}
      >
        <Icon name="sparkle" size={12} />
        {isLoading ? "Rewriting…" : variants !== null ? "Suggest again" : "Suggest a rewrite"}
      </button>

      {/* Error (rate-limit / other) */}
      {error && (
        <div style={{ padding: "10px 12px", borderRadius: 9, background: "#FBEFED", border: "1px solid #F2D2CE" }}>
          <p style={{ fontSize: 12.5, color: "var(--ff-red)", fontWeight: 500, margin: 0 }}>{error.message}</p>
          {error.code === "RATE_LIMITED" && error.supportUrl && (
            <a
              href={error.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--ff-accent-dark)", textDecoration: "underline" }}
            >
              Support MakeMyCV
            </a>
          )}
        </div>
      )}

      {/* Truthful refusal */}
      {refused && (
        <p style={{ fontSize: 12.5, color: "var(--ff-muted)", lineHeight: 1.55, margin: 0 }}>
          We couldn&apos;t add “{term}” to this bullet without inventing
          something that isn&apos;t there. Try a different bullet, or add it as
          a skill instead.
        </p>
      )}

      {/* Variants */}
      {variants && variants.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={fieldLabelText}>Pick a rewrite to apply</span>
          {variants.map((v, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--ff-card)",
                border: "1px solid var(--ff-line)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13, color: "var(--ff-ink-2)", lineHeight: 1.5 }}>{v}</span>
              <button
                type="button"
                onClick={() => role && onApply(role.id, bulletIndex, v)}
                className="cv-btn-primary"
                style={{ padding: "8px 14px", flexShrink: 0 }}
              >
                Use this
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
