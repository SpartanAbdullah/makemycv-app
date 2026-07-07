"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { experienceSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { useUiStore } from "../../../lib/store/uiStore";
import { Field } from "../../forms/Field";
import { AutoGrowTextarea } from "../../forms/AutoGrowTextarea";
import { useBlurFeedback } from "../../forms/useBlurFeedback";
import { fieldValidators } from "../../../lib/validation/cvRequirements";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { Icon } from "../Icon";
import { BulletRow } from "../BulletRow";
import { CardIconBtn } from "./shared";
import { AiDisclosure } from "../AiDisclosure";
import { UAEDot } from "../UAEDot";
import { MAX_BULLETS, splitPastedBulletText } from "../../../lib/utils/bullets";
import { suggestionsForRole } from "../../../lib/data/ideaSuggestions";
import { inferRoleFamily } from "../../../lib/data/roleFamily";
import { canTailorByDomain } from "../../../lib/utils/entitlements";
import { useAIImprove } from "../../../hooks/useAIImprove";
import {
  sanitizeJobTitle,
  sanitizeJobTitleLive,
  sanitizeCompanyName,
  sanitizeCompanyNameLive,
  sanitizeLocation,
  sanitizeLocationLive,
  sanitizePlainText,
} from "../../../lib/sanitize";
import type { CvExperience } from "../../../lib/types/cv";

type ExperienceForm = { experience: CvExperience[] };

export const ExperienceStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
}) => {
  const experience = useCvStore((state) => state.data.experience);
  const updateSection = useCvStore((state) => state.updateSection);
  const pushToast = useUiStore((s) => s.pushToast);
  const lastSerializedRef = useRef<string>(JSON.stringify(experience));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<ExperienceForm>({
    resolver: zodResolver(experienceSchema),
    defaultValues: { experience },
  });

  const { fields, append, remove, update, move, insert } = useFieldArray({
    control,
    name: "experience",
  });

  // Deletion with undo (replaces a confirm dialog): capture the entry BEFORE
  // remove, then offer to re-insert it at its original position. The
  // debounced watch subscription persists both the removal and the restore.
  const handleRemoveRole = (index: number) => {
    const removed = getValues(`experience.${index}`);
    remove(index);
    if (!removed) return;
    pushToast("Role removed", {
      actionLabel: "Undo",
      onAction: () => {
        insert(index, removed);
        setOpenIndex(index);
      },
    });
  };

  const adjustOpenIndexForMove = (from: number, to: number) => {
    setOpenIndex((prev) => {
      if (prev === null) return prev;
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    if (to < 0 || to >= fields.length) return;
    move(from, to);
    adjustOpenIndexForMove(from, to);
  };

  const [focusedBullet, setFocusedBullet] = useState<{
    itemIndex: number;
    bulletIndex: number;
  } | null>(null);

  /* ── Inline AI suggestions, per role index ── */
  const {
    improve,
    results: aiResults,
    isLoading: aiLoading,
    error: aiError,
    clearResults: aiClear,
  } = useAIImprove();
  const [aiActiveIndex, setAiActiveIndex] = useState<number | null>(null);
  // Which role's static UAE idea panel is expanded (zero-AI suggestions).
  const [ideasOpenIndex, setIdeasOpenIndex] = useState<number | null>(null);
  // Suggestions queue per role. Accepting merges into bullets[]; rejecting
  // drops the suggestion from the queue.
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({});
  // Blur-time validity feedback for required entry fields (guided feedback).
  const { fieldState, blurField, changeField } = useBlurFeedback();
  // When the hook returns results, route them into the active role's queue.
  useEffect(() => {
    if (aiActiveIndex === null) return;
    if (aiLoading) return;
    if (aiResults.length === 0) return;
    setSuggestions((prev) => ({
      ...prev,
      [aiActiveIndex]: [...(prev[aiActiveIndex] ?? []), ...aiResults],
    }));
    aiClear();
    setAiActiveIndex(null);
  }, [aiResults, aiLoading, aiActiveIndex, aiClear]);

  const handleGenerateBullets = (index: number) => {
    const entry = getValues(`experience.${index}`);
    if (!entry) return;
    setAiActiveIndex(index);
    aiClear();
    improve({
      type: "bullets",
      // Per-entry: a past role's bullets should reflect THAT role's domain,
      // not the person's global target domain.
      domain: canTailorByDomain() ? inferRoleFamily(entry.role).family : undefined,
      jobTitle: entry.role,
      company: entry.company,
      existingBullets: entry.bullets?.filter(Boolean),
    });
  };

  const acceptSuggestion = (index: number, suggestion: string) => {
    const entry = getValues(`experience.${index}`);
    if (!entry) return;
    const existing = (entry.bullets || []).filter(Boolean);
    if (existing.length >= MAX_BULLETS) return;
    update(index, { ...entry, bullets: [...existing, suggestion] });
    setSuggestions((prev) => ({
      ...prev,
      [index]: (prev[index] ?? []).filter((s) => s !== suggestion),
    }));
  };

  const rejectSuggestion = (index: number, suggestion: string) => {
    setSuggestions((prev) => ({
      ...prev,
      [index]: (prev[index] ?? []).filter((s) => s !== suggestion),
    }));
  };

  // Insert a static UAE idea bullet. If the last bullet is empty, fill it in
  // place (so the user isn't left with a dangling blank); otherwise append.
  const insertIdeaBullet = (index: number, text: string) => {
    const entry = getValues(`experience.${index}`);
    if (!entry) return;
    const current = entry.bullets ?? [];
    const filled = current.filter(Boolean);
    if (filled.length >= MAX_BULLETS) return;
    const lastIsEmpty = current.length > 0 && !current[current.length - 1]?.trim();
    const next = lastIsEmpty
      ? [...current.slice(0, -1), text]
      : [...current, text];
    update(index, { ...entry, bullets: next });
  };

  useEffect(() => {
    if (!isDirty) reset({ experience });
  }, [experience, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(experience);
  }, [experience]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.experience) {
        const next = (value.experience ?? []).filter(
          (role): role is CvExperience => Boolean(role && role.id),
        );
        const nextSerialized = JSON.stringify(next);
        if (nextSerialized === lastSerializedRef.current) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("experience", next);
          }
        }, 250);
      }
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  const addBullet = (index: number) => {
    const currentItem = getValues(`experience.${index}`);
    if (!currentItem) return;
    const currentBullets = currentItem.bullets || [];
    if (currentBullets.length >= MAX_BULLETS) return;
    update(index, { ...currentItem, bullets: [...currentBullets, ""] });
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const currentItem = getValues(`experience.${index}`);
    if (!currentItem) return;
    const currentBullets = currentItem.bullets || [];
    const next = currentBullets.filter((_, i) => i !== bulletIndex);
    update(index, { ...currentItem, bullets: next.length ? next : [""] });
  };

  const splitFocusedBullet = (index: number) => {
    if (!focusedBullet || focusedBullet.itemIndex !== index) return;
    const currentItem = getValues(`experience.${index}`);
    if (!currentItem) return;
    const currentBullets = currentItem.bullets || [];
    const rawValue = currentBullets[focusedBullet.bulletIndex] || "";
    const split = splitPastedBulletText(rawValue, MAX_BULLETS);
    if (split.length <= 1) return;
    const before = currentBullets.slice(0, focusedBullet.bulletIndex);
    const after = currentBullets.slice(focusedBullet.bulletIndex + 1);
    const availableSlots = Math.max(
      1,
      MAX_BULLETS - before.length - after.length,
    );
    const next = [
      ...before,
      ...split.slice(0, availableSlots),
      ...after,
    ];
    update(index, { ...currentItem, bullets: next.length ? next : [""] });
  };

  const handleAddRole = () => {
    append(createEmptyItems.experience());
    setOpenIndex(fields.length);
  };

  // Generates suggestions for the FIRST role only — the label must say so.
  // Looping every role would burn the user's whole daily AI quota (10/24h).
  const suggestBulletsWithAI = () => {
    if (fields.length === 0) return;
    handleGenerateBullets(0);
  };

  // Failed submit with errors inside a collapsed card is invisible — open
  // the first entry that has a validation error so the user can see it.
  const openFirstErroredEntry = (formErrors: FieldErrors<ExperienceForm>) => {
    const firstErrored = Object.keys(formErrors.experience ?? {})
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b)[0];
    if (typeof firstErrored === "number") setOpenIndex(firstErrored);
  };

  return (
    <form
      onSubmit={handleSubmit(onNext, openFirstErroredEntry)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="experience" />
      {/* AI bullet suggestions — first (most recent) role */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <button
          type="button"
          onClick={suggestBulletsWithAI}
          disabled={aiLoading || fields.length === 0}
          className="cv-btn-accent-outline"
        >
          <Icon name="sparkle" size={13} />
          {aiLoading ? "Generating…" : "Suggest bullets with AI"}
        </button>
        <AiDisclosure />
      </div>

      {/* Roles list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fields.map((field, index) => {
          const isOpen = openIndex === index;
          const isDragging = draggingIndex === index;
          const isDropTarget =
            dragOverIndex === index &&
            draggingIndex !== null &&
            draggingIndex !== index;
          const role = watch(`experience.${index}.role`) || "";
          const company = watch(`experience.${index}.company`) || "";
          const startDate = watch(`experience.${index}.startDate`) || "";
          const endDate = watch(`experience.${index}.endDate`) || "";
          const isCurrent =
            watch(`experience.${index}.isCurrent`) || false;
          const location = watch(`experience.${index}.location`) || "";
          const summarySubLine = [
            company,
            location,
            [startDate, isCurrent ? "Present" : endDate]
              .filter(Boolean)
              .join(" – "),
          ]
            .filter(Boolean)
            .join(" · ");
          const canMoveUp = index > 0;
          const canMoveDown = index < fields.length - 1;
          const bullets = watch(`experience.${index}.bullets`) || [""];
          const filledBullets = bullets.filter(Boolean).length;
          const roleSuggestions = suggestions[index] ?? [];
          // Compulsory fields (schema-required): once filled, the card
          // auto-folds when focus leaves it (see ExpandRoleCard onBlur).
          const entryComplete = Boolean(
            role.trim() && company.trim() && startDate.trim(),
          );

          return (
            <ExpandRoleCard
              key={field.id}
              isOpen={isOpen}
              isDragging={isDragging}
              isDropTarget={isDropTarget}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(e) => {
                if (draggingIndex === null || draggingIndex === index) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIndex !== index) setDragOverIndex(index);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverIndex === index) setDragOverIndex(null);
              }}
              onDrop={(e) => {
                if (draggingIndex === null) return;
                e.preventDefault();
                const from = draggingIndex;
                reorder(from, index);
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
              title={role || `Role ${index + 1}`}
              subline={summarySubLine}
              isCurrent={isCurrent}
              complete={entryComplete}
              onAutoCollapse={() => setOpenIndex(null)}
            >
              {isOpen && (
                <div style={{ padding: 20, borderTop: "1px solid var(--ff-line)" }}>
                  {/* Actions row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      <CardIconBtn
                        onClick={() => reorder(index, index - 1)}
                        disabled={!canMoveUp}
                        label="Move up"
                      >
                        <Icon name="chevron-up" size={12} />
                      </CardIconBtn>
                      <CardIconBtn
                        onClick={() => reorder(index, index + 1)}
                        disabled={!canMoveDown}
                        label="Move down"
                      >
                        <Icon name="chevron-down" size={12} />
                      </CardIconBtn>
                    </div>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(index)}
                        className="cv-btn-danger"
                      >
                        <Icon name="trash" size={12} />
                        Remove role
                      </button>
                    )}
                  </div>

                  {/* Fields grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                      marginBottom: 16,
                    }}
                    className="ff-exp-fields"
                  >
                    <Field
                      label="Job title"
                      error={errors.experience?.[index]?.role?.message}
                      feedback={{
                        state: fieldState(`role-${index}`),
                        message:
                          "Job title is still empty — you can come back anytime",
                      }}
                    >
                      <input
                        className="cv-input"
                        placeholder="e.g. Operations Manager"
                        autoComplete="organization-title"
                        {...register(`experience.${index}.role`)}
                        onChange={(e) => {
                          e.target.value = sanitizeJobTitleLive(e.target.value);
                          register(`experience.${index}.role`).onChange(e);
                          changeField(`role-${index}`, fieldValidators.entryText(e.target.value));
                        }}
                        onBlur={(e) => {
                          e.target.value = sanitizeJobTitle(e.target.value);
                          register(`experience.${index}.role`).onChange(e);
                          register(`experience.${index}.role`).onBlur(e);
                          blurField(`role-${index}`, fieldValidators.entryText(e.target.value));
                        }}
                      />
                    </Field>
                    <Field
                      label="Company"
                      error={errors.experience?.[index]?.company?.message}
                      feedback={{
                        state: fieldState(`company-${index}`),
                        message:
                          "Company is still empty — you can come back anytime",
                      }}
                    >
                      <input
                        className="cv-input"
                        placeholder="e.g. Emaar Properties"
                        autoComplete="organization"
                        spellCheck={false}
                        {...register(`experience.${index}.company`)}
                        onChange={(e) => {
                          e.target.value = sanitizeCompanyNameLive(e.target.value);
                          register(`experience.${index}.company`).onChange(e);
                          changeField(`company-${index}`, fieldValidators.entryText(e.target.value));
                        }}
                        onBlur={(e) => {
                          e.target.value = sanitizeCompanyName(e.target.value);
                          register(`experience.${index}.company`).onChange(e);
                          register(`experience.${index}.company`).onBlur(e);
                          blurField(`company-${index}`, fieldValidators.entryText(e.target.value));
                        }}
                      />
                    </Field>
                    <Field
                      label="Start"
                      error={errors.experience?.[index]?.startDate?.message}
                      feedback={{
                        state: fieldState(`startDate-${index}`),
                        message:
                          "Start date is still empty — you can come back anytime",
                      }}
                    >
                      <input
                        className="cv-input"
                        placeholder="e.g. Jan 2024"
                        {...register(`experience.${index}.startDate`)}
                        onChange={(e) => {
                          register(`experience.${index}.startDate`).onChange(e);
                          changeField(`startDate-${index}`, fieldValidators.entryText(e.target.value));
                        }}
                        onBlur={(e) => {
                          register(`experience.${index}.startDate`).onBlur(e);
                          blurField(`startDate-${index}`, fieldValidators.entryText(e.target.value));
                        }}
                      />
                    </Field>
                    <Field label="End">
                      <input
                        className="cv-input"
                        placeholder={isCurrent ? "Present" : "e.g. Mar 2026"}
                        disabled={isCurrent}
                        {...register(`experience.${index}.endDate`)}
                      />
                    </Field>
                    <Field label="City">
                      <input
                        className="cv-input"
                        placeholder="e.g. Dubai"
                        autoComplete="address-level2"
                        {...register(`experience.${index}.location`)}
                        onChange={(e) => {
                          e.target.value = sanitizeLocationLive(e.target.value);
                          register(`experience.${index}.location`).onChange(e);
                        }}
                        onBlur={(e) => {
                          e.target.value = sanitizeLocation(e.target.value);
                          register(`experience.${index}.location`).onChange(e);
                          register(`experience.${index}.location`).onBlur(e);
                        }}
                      />
                    </Field>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        color: "var(--ff-ink-2)",
                        marginTop: 28,
                      }}
                    >
                      <input
                        type="checkbox"
                        {...register(`experience.${index}.isCurrent`)}
                        style={{ accentColor: "var(--ff-accent)" }}
                      />
                      I currently work here
                    </label>
                  </div>

                  {/* Achievements header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--ff-ink)",
                      }}
                    >
                      Achievements
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--ff-muted)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {filledBullets} of {MAX_BULLETS}
                    </div>
                  </div>

                  <div className="cv-tip-box" style={{ marginBottom: 10 }}>
                    Start each line with an action verb and quantify the impact
                    (% , AED, headcount, project count).
                  </div>

                  {/* Bullets list */}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {bullets.map((_, bulletIndex) => (
                      <BulletRow
                        key={bulletIndex}
                        showMarker
                      >
                        <AutoGrowTextarea
                          placeholder="What did you achieve? Start with a verb, add a number."
                          aria-label={`Achievement ${bulletIndex + 1}`}
                          className="cv-input cv-textarea"
                          minHeight={56}
                          {...register(
                            `experience.${index}.bullets.${bulletIndex}`,
                          )}
                          onFocus={() =>
                            setFocusedBullet({
                              itemIndex: index,
                              bulletIndex,
                            })
                          }
                          onBlur={(e) => {
                            register(
                              `experience.${index}.bullets.${bulletIndex}`,
                            ).onBlur(e);
                            const cleaned = sanitizePlainText(e.target.value);
                            if (cleaned !== e.target.value)
                              e.target.value = cleaned;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeBullet(index, bulletIndex)}
                          className="cv-btn-danger"
                          aria-label="Remove bullet"
                          style={{ alignSelf: "center" }}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </BulletRow>
                    ))}

                    {/* AI suggestions */}
                    {roleSuggestions.map((s) => (
                      <SuggestionBullet
                        key={s}
                        text={s}
                        onAccept={() => acceptSuggestion(index, s)}
                        onReject={() => rejectSuggestion(index, s)}
                      />
                    ))}

                    {/* Loading state for active AI generation on this role */}
                    {aiLoading && aiActiveIndex === index && (
                      <SuggestionLoading />
                    )}

                    {/* Inline AI error — same affordances as the modal flow
                        (audit UX-15): rate-limited shows the support link,
                        other errors get a retry. */}
                    {aiError && aiActiveIndex === index && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "#FBEFED",
                          border: "1px solid #F2D2CE",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--ff-red)",
                            fontWeight: 500,
                          }}
                        >
                          {aiError.message}
                        </p>
                        <div
                          style={{
                            marginTop: 6,
                            display: "flex",
                            gap: 14,
                            alignItems: "center",
                          }}
                        >
                          {aiError.code === "RATE_LIMITED" ? (
                            aiError.supportUrl && (
                              <a
                                href={aiError.supportUrl}
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
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerateBullets(index)}
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
                      </div>
                    )}
                  </div>

                  {/* Add / Generate buttons */}
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => addBullet(index)}
                      className="cv-btn-ghost"
                      disabled={filledBullets >= MAX_BULLETS}
                      style={{ width: "auto", padding: "10px 14px" }}
                    >
                      <Icon name="plus" size={14} />
                      Add bullet
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateBullets(index)}
                      disabled={aiLoading && aiActiveIndex === index}
                      className="cv-btn-accent-outline"
                      style={{ flex: 1 }}
                    >
                      <Icon name="sparkle" size={13} />
                      {aiLoading && aiActiveIndex === index
                        ? "Generating…"
                        : "Generate more with AI"}
                    </button>
                  </div>

                  {/* UAE Idea Suggestions — instant, no AI quota used.
                      Click a ready-made, UAE-flavored bullet to insert it,
                      then fill in the blank (AED/%/headcount). */}
                  <IdeaPanel
                    open={ideasOpenIndex === index}
                    onToggle={() =>
                      setIdeasOpenIndex(ideasOpenIndex === index ? null : index)
                    }
                    role={role}
                    disabled={filledBullets >= MAX_BULLETS}
                    onInsert={(text) => insertIdeaBullet(index, text)}
                    existingBullets={bullets.filter(Boolean)}
                  />

                  {focusedBullet?.itemIndex === index && (
                    <button
                      type="button"
                      onClick={() => splitFocusedBullet(index)}
                      style={{
                        marginTop: 10,
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        color: "var(--ff-muted)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      Split pasted text into bullets
                    </button>
                  )}
                </div>
              )}
            </ExpandRoleCard>
          );
        })}
      </div>

      {/* Add another role */}
      <button
        type="button"
        onClick={handleAddRole}
        className="cv-btn-ghost"
        style={{ padding: "13px" }}
      >
        <Icon name="plus" size={14} />
        Add another role
      </button>

      {errors.experience?.message && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ff-red)",
            fontWeight: 500,
          }}
        >
          {errors.experience?.message}
        </p>
      )}

      {/* Fresh-grad escape (audit UX-2): this used to be the only content
          step with no skip — a graduate with no formal experience hit a
          hard validation wall with zero guidance. */}
      <p
        style={{
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--ff-muted)",
        }}
      >
        No formal work experience yet? Internships, volunteer work, and
        university projects all count — add them as roles. Or skip for now
        and come back later.
      </p>
      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext, openFirstErroredEntry)}
        nextLabel="Continue to Education"
        showSkip={Boolean(onSkip)}
        onSkip={onSkip}
      />

      <style>{`
        @media (max-width: 720px) {
          .ff-exp-fields { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
};

/* ─── Role card (header + expand body) ───────────────────── */
const ExpandRoleCard = ({
  isOpen,
  isDragging,
  isDropTarget,
  onClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  title,
  subline,
  isCurrent,
  complete,
  onAutoCollapse,
  children,
}: {
  isOpen: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  title: string;
  subline: string;
  isCurrent: boolean;
  complete: boolean;
  onAutoCollapse: () => void;
  children: React.ReactNode;
}) => (
  <div
    className="cv-entry-card"
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    onBlur={(e) => {
      // Auto-fold a completed entry when focus leaves the card (the user
      // clicked/tabbed elsewhere). Guarded so it never collapses mid-edit.
      if (!isOpen || !complete) return;
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      onAutoCollapse();
    }}
    style={{
      opacity: isDragging ? 0.5 : 1,
      transform: isDropTarget ? "translateY(-1px)" : undefined,
      boxShadow: isDropTarget
        ? "0 0 0 2px var(--ff-accent)"
        : undefined,
      transition: "opacity 150ms, box-shadow 150ms, transform 150ms",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
      }}
    >
      <span
        role="button"
        tabIndex={-1}
        aria-label="Drag to reorder"
        draggable
        onDragStart={(e) => {
          onDragStart();
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={onDragEnd}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          color: "var(--ff-faint)",
          cursor: "grab",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <Icon name="drag" size={14} />
      </span>

      <button
        type="button"
        onClick={onClick}
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: isOpen ? 19 : 15,
              fontWeight: 600,
              color: "var(--ff-ink)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
          {subline && (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
                color: "var(--ff-muted)",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subline}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          {isCurrent && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ff-accent)",
                background: "var(--ff-accent-soft)",
                padding: "4px 10px",
                borderRadius: 999,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              ● Current
            </span>
          )}
          <span
            style={{
              transition: "transform 150ms",
              transform: isOpen ? "rotate(180deg)" : "none",
              color: "var(--ff-muted)",
              display: "inline-flex",
            }}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </div>
      </button>
    </div>
    {children}
  </div>
);

const SuggestionBullet = ({
  text,
  onAccept,
  onReject,
}: {
  text: string;
  onAccept: () => void;
  onReject: () => void;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "12px 14px",
      background: "#F4FAF6",
      border: "1px dashed rgba(14,124,74,0.55)",
      borderRadius: 10,
      animation: "tip-enter 250ms ease both",
    }}
  >
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 6,
        background: "var(--ff-accent)",
        color: "white",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      <Icon name="sparkle" size={11} />
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ff-accent-dark)",
          letterSpacing: "0.1em",
          marginBottom: 4,
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        AI suggestion
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--ff-ink)",
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        onClick={onAccept}
        aria-label="Accept suggestion"
        title="Accept"
        className="ff-hit-target"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "var(--ff-accent)",
          border: "none",
          color: "white",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Icon name="check" size={13} strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onReject}
        aria-label="Reject suggestion"
        title="Reject"
        className="ff-hit-target"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "var(--ff-card)",
          border: "1px solid var(--ff-line)",
          color: "var(--ff-muted)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          fontSize: 14,
          padding: 0,
        }}
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  </div>
);

/* ─── UAE Idea Suggestions panel (static, zero-AI) ───────────
   Replicates the cvtoolspro "Idea Suggestion" affordance with a
   UAE-flavored phrase library. Collapsed by default to avoid clutter;
   when open, lists role-matched bullets with a one-tap insert. */
const IdeaPanel = ({
  open,
  onToggle,
  role,
  disabled,
  onInsert,
  existingBullets,
}: {
  open: boolean;
  onToggle: () => void;
  role: string;
  disabled: boolean;
  onInsert: (text: string) => void;
  existingBullets: string[];
}) => {
  const match = suggestionsForRole(role, existingBullets);
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ff-ink)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
        aria-expanded={open}
      >
        <Icon name="lightbulb" size={14} />
        {open ? "Hide idea bullets" : "Need ideas? See ready-made bullets"}
        <span
          style={{
            transition: "transform 150ms",
            transform: open ? "rotate(180deg)" : "none",
            display: "inline-flex",
            color: "var(--ff-muted)",
          }}
        >
          <Icon name="chevron-down" size={12} />
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 10,
            padding: 14,
            background: "var(--ff-sunken)",
            border: "1px solid var(--ff-line)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ff-muted)",
              marginBottom: 10,
            }}
          >
            {match.label} · tap to add, then fill the blank
          </div>

          {match.bullets.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ff-muted)" }}>
              You&apos;ve used all the ready-made ideas for this role — try
              &quot;Generate more&quot; for fresh AI bullets.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {match.bullets.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => onInsert(idea)}
                  disabled={disabled}
                  className="ff-hit-target"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    textAlign: "left",
                    padding: "10px 12px",
                    background: "var(--ff-card)",
                    border: "1px solid var(--ff-line)",
                    borderRadius: 10,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    width: "100%",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      background: "var(--ff-accent-soft)",
                      color: "var(--ff-accent-dark)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <Icon name="plus" size={11} />
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13.5,
                      color: "var(--ff-ink-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    {idea}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SuggestionLoading = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 14px",
      background: "#F4FAF6",
      border: "1px dashed rgba(14,124,74,0.40)",
      borderRadius: 10,
    }}
  >
    <span
      style={{
        width: 14,
        height: 14,
        border: "2px solid var(--ff-line-strong)",
        borderTopColor: "var(--ff-accent)",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
    <span
      style={{
        fontFamily: "var(--font-body)",
        fontSize: 13,
        color: "var(--ff-accent-dark)",
        fontWeight: 500,
      }}
    >
      Claude is writing UAE-specific bullets…
    </span>
  </div>
);

