"use client";

/**
 * Skills step — rebuilt 2026-08-25 around EVIDENCE rather than self-assessment.
 *
 * The old step answered "which skills am I good at": a blank input, a
 * suggestion tray, a self-rated proficiency field. Research across competitor
 * products, ATS vendor docs and ~4,400 archived Reddit posts found the question
 * that actually freezes people is different — "which of these matter for THIS
 * job, and can I defend it in the room" — and named three frictions:
 *
 *   1. NAMING      they know what they DID, not what it is CALLED
 *   2. ENTITLEMENT "am I allowed to claim this?" — no product gives the doubt
 *                  anywhere to live, so it resolves to claim-or-abandon
 *   3. RELEVANCE   which two or three actually decide the application
 *
 * What changed here, and why:
 *   * The blank box becomes a SEARCH that understands plain language. Typing
 *     "visa paperwork" returns "Amer (GDRFA Dubai)" and says why. (friction 1)
 *   * Arrival leads with what the CV ALREADY PROVES but the list is missing —
 *     the app speaks first, so a tired applicant is not asked to produce a word
 *     before seeing anything. (frictions 1 + 2)
 *   * Every chip carries its evidence state, and tapping it cites the user's
 *     own line. Copy describes the DOCUMENT, never the person. (friction 2)
 *   * Suggestions are split must-tier vs the rest. (friction 3)
 *   * Adding a LICENCE asks for confirmation first — the one category where a
 *     wrong claim is checkable, and a knockout question on UAE application
 *     forms.
 *
 * Retired deliberately:
 *   * The proficiency field. It was written as "intermediate" on every skill
 *     and rendered nowhere — dead data. No ATS normalises hard-skill levels,
 *     and recruiters read self-ratings as a red flag. CvSkill.level stays in
 *     the schema for saved CVs; this step no longer writes it.
 *   * The "Add as General/Technical" pre-toggle — a mode you had to set BEFORE
 *     typing, and could only undo by deleting the skill. Category is now
 *     derived from what the thing IS (categoryFor).
 *   * The 10-20 ATS counter. Term CHOICE beats term COUNT, and a count nudges
 *     padding. Replaced by a mirror of the first three skills, which is what a
 *     recruiter's two seconds actually contains.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { skillsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { createId } from "../../../lib/utils/id";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { useAIImprove } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";
import { sanitizeSkill, sanitizeSkillLive } from "../../../lib/sanitize";
import { ROLE_FAMILY_LABELS } from "../../../lib/data/roleFamily";
import {
  arrivalSuggestions,
  categoryFor,
  needsCredentialGuard,
  searchSkills,
  type SearchResult,
  type Suggestion,
} from "../../../lib/skills/suggest";
import { describeEvidence, type SkillStatus } from "../../../lib/skills/evidence";
import { Icon } from "../Icon";
import { AiDisclosure } from "../AiDisclosure";
import type { CvSkill } from "../../../lib/types/cv";

type SkillsForm = { skills: CvSkill[] };

/**
 * The ONE place a skill object is rebuilt.
 *
 * The old step repeated this shape in six handlers, each picking fields by
 * hand — so any field not listed was silently dropped on the next reorder.
 * Centralised so that class of bug cannot come back.
 */
const toCvSkill = (s: {
  id: string;
  name: string;
  category?: "technical" | "general";
}): CvSkill => ({
  id: s.id,
  name: s.name,
  ...(s.category ? { category: s.category } : {}),
});

const norm = (s: string) => s.trim().toLowerCase();

/* ── State presentation ──────────────────────────────────────────────────────
 * A 6px dot, never a colour-coded warning. "claimed" is deliberately neutral:
 * fourteen amber chips reads as fourteen accusations, and the state is not an
 * accusation — it is a fact about the document.
 */
const DOT: Record<SkillStatus, { bg: string; border: string }> = {
  evidenced: { bg: "var(--ff-accent)", border: "var(--ff-accent)" },
  claimed: { bg: "transparent", border: "var(--ff-line-strong)" },
  unlisted: { bg: "var(--ff-accent)", border: "var(--ff-accent)" },
  absent: { bg: "transparent", border: "var(--ff-line-strong)" },
};

const StateDot = ({ status }: { status: SkillStatus }) => (
  <span
    aria-hidden="true"
    style={{
      width: 6,
      height: 6,
      borderRadius: "50%",
      flexShrink: 0,
      background: DOT[status].bg,
      border: `1.5px solid ${DOT[status].border}`,
      boxSizing: "content-box",
    }}
  />
);

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ff-muted)",
  marginBottom: 8,
};

export const SkillsStep = ({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) => {
  const data = useCvStore((state) => state.data);
  const domain = useCvStore((state) => state.data.settings.domain);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(data.skills));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [openChipId, setOpenChipId] = useState<string | null>(null);
  const [pendingCredential, setPendingCredential] = useState<Suggestion | null>(null);
  const [alsoCommonOpen, setAlsoCommonOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const {
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<SkillsForm>({
    resolver: zodResolver(skillsSchema),
    defaultValues: { skills: data.skills },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "skills",
    keyName: "fieldKey",
  });

  /* ── Form ↔ store sync (unchanged mechanics) ── */
  useEffect(() => {
    if (!isDirty) reset({ skills: data.skills });
  }, [data.skills, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(data.skills);
  }, [data.skills]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (!value.skills) return;
      const next = (value.skills ?? []).filter(
        (skill): skill is CvSkill => Boolean(skill && skill.id),
      );
      const nextSerialized = JSON.stringify(next);
      if (nextSerialized === lastSerializedRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (nextSerialized !== lastSerializedRef.current) {
          lastSerializedRef.current = nextSerialized;
          updateSection("skills", next);
        }
      }, 250);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  /* ── Suggestions ──────────────────────────────────────────────────────────
   * Computed against a LIVE CV: the store's data with the form's current skill
   * list spliced in. The store write is debounced 250ms, so reading skills from
   * it would leave a just-added skill still showing as a suggestion.
   */
  const liveCv = useMemo(
    () => ({ ...data, skills: fields.map(toCvSkill) }),
    [data, fields],
  );

  const arrival = useMemo(
    () => arrivalSuggestions(liveCv, domain),
    [liveCv, domain],
  );

  const results = useMemo(
    () => (query.trim().length >= 2 ? searchSkills(query, liveCv, domain, 8) : []),
    [query, liveCv, domain],
  );

  /* ── Writes ── */
  const writeSkills = (next: CvSkill[]) => replace(next);

  const addSkill = (
    name: string,
    opts: { category?: "technical" | "general" } = {},
  ) => {
    const trimmed = sanitizeSkill(name).trim();
    if (!trimmed) return false;
    if (fields.some((f) => norm(f.name) === norm(trimmed))) {
      setDuplicateOf(trimmed);
      return false;
    }
    writeSkills([
      ...fields.map(toCvSkill),
      { id: createId(), name: trimmed, ...(opts.category ? { category: opts.category } : {}) },
    ]);
    setDuplicateOf(null);
    return true;
  };

  /** Route an add through the licence guard when the entry is a credential. */
  const addSuggestion = (s: Suggestion) => {
    if (needsCredentialGuard(s)) {
      setPendingCredential(s);
      return;
    }
    if (addSkill(s.name, { category: categoryFor(s) })) setQuery("");
  };

  const confirmCredential = () => {
    if (!pendingCredential) return;
    addSkill(pendingCredential.name, { category: categoryFor(pendingCredential) });
    setPendingCredential(null);
    setQuery("");
  };

  const removeSkill = (id: string) => {
    writeSkills(fields.filter((f) => f.id !== id).map(toCvSkill));
    if (openChipId === id) setOpenChipId(null);
  };

  const moveSkill = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const items = fields.map(toCvSkill);
    const [moved] = items.splice(index, 1);
    items.splice(target, 0, moved);
    writeSkills(items);
  };

  /* ── AI suggest (retained, demoted from hero to footer) ── */
  const {
    improve,
    results: aiResults,
    isLoading: aiLoading,
    error: aiError,
    clearResults: aiClear,
  } = useAIImprove();

  const fireAISuggest = () => {
    const store = useCvStore.getState().data;
    setAiModalOpen(true);
    aiClear();
    improve({
      type: "skills",
      domain: store.settings.domain,
      headline: store.personal.headline,
      experienceRoles: store.experience.map((r) => ({
        title: r.role,
        company: r.company,
        bullets: r.bullets.filter(Boolean),
      })),
      existingSkills: fields.map((f) => f.name),
    });
  };

  const handleApplySkills = (selected: string[]) => {
    const existing = new Set(fields.map((f) => norm(f.name)));
    const additions = selected
      .filter((name) => !existing.has(norm(name)))
      .map((name) => ({ id: createId(), name }));
    writeSkills([...fields.map(toCvSkill), ...additions]);
    setAiModalOpen(false);
    aiClear();
  };

  const domainLabel = domain && domain !== "generic" ? ROLE_FAMILY_LABELS[domain] : null;
  const firstThree = fields.slice(0, 3).map((f) => f.name);

  /* ── Suggestion chip ── */
  const SuggestionChip = ({ s }: { s: Suggestion }) => (
    <button
      type="button"
      onClick={() => addSuggestion(s)}
      className="ff-hit-target"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        background: s.tier === "must" ? "var(--ff-accent-soft)" : "var(--ff-card)",
        border:
          s.tier === "must"
            ? "1px solid var(--ff-accent)"
            : "1px dashed var(--ff-line-strong)",
        color: s.tier === "must" ? "var(--ff-accent)" : "var(--ff-ink-2)",
        fontSize: 13,
        fontFamily: "var(--font-body)",
        fontWeight: s.tier === "must" ? 600 : 500,
        cursor: "pointer",
      }}
    >
      <Icon name={s.tier === "must" ? "star" : "plus"} size={11} />
      {s.name}
    </button>
  );

  return (
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="skills" />
      <section className="cv-step-card">
        {/* ── Search: the hero. Accepts plain language, not just the CV word. ── */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ff-muted)",
                  display: "inline-flex",
                  pointerEvents: "none",
                }}
              >
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                className="cv-input"
                style={{ width: "100%", paddingLeft: 34 }}
                placeholder="Search a skill — or describe what you do"
                aria-label="Search skills, or describe what you do"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => {
                  setQuery(sanitizeSkillLive(e.target.value));
                  setDuplicateOf(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = results.find((r) => !r.alreadyHave);
                    if (first) addSuggestion(first);
                    else if (addSkill(query)) setQuery("");
                  }
                  if (e.key === "Escape") setQuery("");
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (addSkill(query)) setQuery("");
              }}
              className="cv-btn-primary cv-btn--input-h"
              disabled={query.trim().length === 0}
            >
              Add
            </button>
          </div>

          <p style={{ marginTop: 6, fontSize: 11.5, color: "var(--ff-faint)" }}>
            Not sure of the word? Try what you actually do — &ldquo;visa paperwork&rdquo;,
            &ldquo;angry customers&rdquo;, &ldquo;filling shelves&rdquo;.
          </p>

          {duplicateOf && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--ff-warn)", fontWeight: 500 }}>
              {duplicateOf} is already on your list.
            </p>
          )}

          {/* Results */}
          {query.trim().length >= 2 && (
            <div
              role="listbox"
              aria-label="Skill suggestions"
              style={{
                marginTop: 10,
                border: "1px solid var(--ff-line)",
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--ff-card)",
              }}
            >
              {results.length === 0 && (
                <p style={{ padding: "14px 14px", fontSize: 13, color: "var(--ff-muted)", margin: 0 }}>
                  Nothing in our list matches that — you can still add it as you wrote it.
                </p>
              )}

              {results.map((r: SearchResult) => {
                if (r.alreadyHave) {
                  return (
                    <p
                      key={r.name}
                      style={{
                        margin: 0,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--ff-muted)",
                        borderBottom: "1px solid var(--ff-line)",
                      }}
                    >
                      You already have <strong style={{ fontWeight: 600 }}>{r.name}</strong>.
                    </p>
                  );
                }
                return (
                  <button
                    key={r.name}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => addSuggestion(r)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "11px 14px",
                      minHeight: 44,
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--ff-line)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--ff-ink)",
                      }}
                    >
                      {r.tier === "must" && (
                        <Icon name="star" size={11} aria-hidden="true" />
                      )}
                      {r.name}
                    </span>
                    {r.viaPhrase && (
                      <span
                        style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--ff-muted)" }}
                      >
                        the usual CV term for &ldquo;{r.viaPhrase}&rdquo;
                      </span>
                    )}
                    {r.status === "unlisted" && r.evidence && (
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 12,
                          color: "var(--ff-accent-dark)",
                          fontWeight: 500,
                        }}
                      >
                        Already in your CV — {describeEvidence(r.evidence)}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Always available: add exactly what they typed. */}
              <button
                type="button"
                onClick={() => {
                  if (addSkill(query)) setQuery("");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  minHeight: 44,
                  background: "var(--ff-sunken)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--ff-ink-2)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Add &ldquo;{query.trim()}&rdquo; as written
              </button>
            </div>
          )}
        </div>

        {/* ── Licence guard ─────────────────────────────────────────────────
            The one category where a wrong claim is checkable against a
            register, and a knockout question on UAE application forms. */}
        {pendingCredential && (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              background: "var(--ff-warn-soft)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ff-ink)" }}>
              {pendingCredential.name}
            </p>
            <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--ff-ink-2)" }}>
              This is a licence or certification. Only add it if you hold it, or it is
              genuinely in process — employers verify these.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={confirmCredential}
                className="cv-btn-primary cv-btn--sm"
              >
                I hold it
              </button>
              <button
                type="button"
                onClick={() => setPendingCredential(null)}
                className="cv-btn-secondary cv-btn--sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Arrival: what the CV already proves ───────────────────────────
            The app speaks first. Highest-value thing we can show — the user
            already wrote the proof and only lacked the word. */}
        {arrival.alreadyShown.length > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "var(--ff-accent-soft)",
            }}
          >
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ff-accent-dark)",
              }}
            >
              <Icon name="lightbulb" size={13} aria-hidden="true" />
              Already in your CV — not on your list
            </p>
            <p style={{ margin: "3px 0 10px", fontSize: 12, color: "var(--ff-ink-2)" }}>
              You have written the proof for these. They just need naming.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {arrival.alreadyShown.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--ff-card)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ff-ink)" }}>
                      {s.name}
                    </span>
                    {s.evidence && (
                      <span style={{ display: "block", fontSize: 12, color: "var(--ff-muted)" }}>
                        Shown in {describeEvidence(s.evidence)}
                        {norm(s.evidence.matchedTerm) !== norm(s.name) && (
                          <> — you wrote it as &ldquo;{s.evidence.matchedTerm}&rdquo;</>
                        )}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => addSuggestion(s)}
                    className="cv-btn-primary cv-btn--sm"
                    style={{ flexShrink: 0 }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── The user's list ── */}
        <div style={{ marginTop: 18 }}>
          <p style={SECTION_LABEL}>Your skills{fields.length > 0 ? ` · ${fields.length}` : ""}</p>
          {fields.length === 0 ? (
            <p style={{ padding: "18px 0", textAlign: "center", fontSize: 13, color: "var(--ff-faint)" }}>
              Nothing yet. Search above, or tap a suggestion below.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {fields.map((field, i) => {
                const state = arrival.listed.get(field.id);
                const status: SkillStatus = state?.status ?? "absent";
                const open = openChipId === field.id;
                return (
                  <span
                    key={field.fieldKey}
                    className="cv-skill-chip"
                    style={{
                      background: status === "evidenced" ? "var(--ff-accent-soft)" : "var(--ff-card)",
                      borderColor:
                        status === "evidenced" ? "rgba(14,124,74,0.18)" : "var(--ff-line-strong)",
                      color: status === "evidenced" ? "var(--ff-accent-dark)" : "var(--ff-ink-2)",
                    }}
                  >
                    {arrival.evidenceUsable && <StateDot status={status} />}
                    <button
                      type="button"
                      onClick={() => setOpenChipId(open ? null : field.id)}
                      aria-expanded={open}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {field.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSkill(field.id)}
                      className="cv-skill-chip-remove"
                      aria-label={`Remove ${field.name}`}
                    >
                      {"×"}
                    </button>
                    {open && (
                      <span
                        style={{
                          flexBasis: "100%",
                          display: "block",
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: "1px solid var(--ff-line)",
                          fontSize: 12,
                          fontWeight: 400,
                          color: "var(--ff-muted)",
                        }}
                      >
                        {/* Copy describes the DOCUMENT, never the person. */}
                        {state?.evidence
                          ? `Shown in ${describeEvidence(state.evidence)}.`
                          : arrival.evidenceUsable
                            ? "This word doesn't appear anywhere else in your CV."
                            : ""}
                        <span style={{ display: "inline-flex", gap: 4, marginLeft: 8 }}>
                          <button
                            type="button"
                            onClick={() => moveSkill(i, -1)}
                            disabled={i === 0}
                            className="cv-skill-chip-remove"
                            aria-label={`Move ${field.name} earlier`}
                            style={{ opacity: i === 0 ? 0.35 : 1 }}
                          >
                            {"‹"}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSkill(i, 1)}
                            disabled={i === fields.length - 1}
                            className="cv-skill-chip-remove"
                            aria-label={`Move ${field.name} later`}
                            style={{ opacity: i === fields.length - 1 ? 0.35 : 1 }}
                          >
                            {"›"}
                          </button>
                        </span>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Must-tier suggestions ── */}
        {arrival.usuallyAsked.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={SECTION_LABEL}>
              {domainLabel ? `Usually asked for in ${domainLabel}` : "Commonly asked for"} · tap to add
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {arrival.usuallyAsked.map((s) => (
                <SuggestionChip key={s.name} s={s} />
              ))}
            </div>
          </div>
        )}

        {/* ── Everything else, folded away ── */}
        {arrival.alsoCommon.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setAlsoCommonOpen((v) => !v)}
              aria-expanded={alsoCommonOpen}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 44,
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 12,
                color: "var(--ff-muted)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              <Icon name={alsoCommonOpen ? "chevron-down" : "chevron-right"} size={12} />
              Also common · {arrival.alsoCommon.length} more
            </button>
            {alsoCommonOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {arrival.alsoCommon.map((s) => (
                  <SuggestionChip key={`${s.source}-${s.name}`} s={s} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AI, demoted from hero to footer ── */}
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={fireAISuggest}
            className="cv-btn-accent-outline"
            style={{ width: "100%" }}
          >
            <Icon name="sparkle" size={13} />
            Suggest more with AI
          </button>
          <AiDisclosure align="left" />
        </div>

        {/* ── What the recruiter's two seconds actually contains ── */}
        {firstThree.length > 0 && (
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--ff-muted)" }}>
            Recruiters skim the top. Yours start:{" "}
            <span style={{ color: "var(--ff-ink-2)", fontWeight: 500 }}>
              {firstThree.join(" · ")}
            </span>
          </p>
        )}

        {errors.skills?.message && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--ff-red)" }}>
            {errors.skills?.message}
          </p>
        )}
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />

      <AIResultsModal
        isOpen={aiModalOpen}
        onClose={() => {
          setAiModalOpen(false);
          aiClear();
        }}
        type="skills"
        results={aiResults}
        isLoading={aiLoading}
        error={aiError}
        onApply={handleApplySkills}
        onRetry={fireAISuggest}
      />
    </form>
  );
};
