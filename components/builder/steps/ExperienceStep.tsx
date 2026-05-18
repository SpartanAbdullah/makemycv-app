"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { experienceSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import { MAX_BULLETS, splitPastedBulletText } from "../../../lib/utils/bullets";
import { useAIImprove, hasUsedFreeAI } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";
import {
  sanitizeJobTitle,
  sanitizeCompanyName,
  sanitizeLocation,
  sanitizePlainText,
} from "../../../lib/sanitize";
import type { CvExperience } from "../../../lib/types/cv";

type ExperienceForm = { experience: CvExperience[] };

export const ExperienceStep = ({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) => {
  const experience = useCvStore((state) => state.data.experience);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(experience));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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

  const { fields, append, remove, update, move } = useFieldArray({
    control,
    name: "experience",
  });

  // Keep the currently-open card's index in sync when items move.
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

  /* AI bullet generation */
  const { improve, results: aiResults, isLoading: aiLoading, error: aiError, clearResults: aiClear } = useAIImprove();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTargetIndex, setAiTargetIndex] = useState<number>(0);
  const aiTriggerChecked = useRef(false);

  useEffect(() => {
    if (aiTriggerChecked.current) return;
    aiTriggerChecked.current = true;
    try {
      const trigger = sessionStorage.getItem("makemycv_ai_trigger");
      if (trigger === "bullets") {
        sessionStorage.removeItem("makemycv_ai_trigger");
        if (!hasUsedFreeAI("bullets") && fields.length > 0) {
          setAiTargetIndex(0);
          const entry = getValues("experience.0");
          if (entry) {
            setAiModalOpen(true);
            improve({
              type: "bullets",
              jobTitle: entry.role,
              company: entry.company,
              existingBullets: entry.bullets?.filter(Boolean),
            });
          }
        }
      }
    } catch { /* SSR guard */ }
  }, [fields.length, getValues, improve]);

  const handleGenerateBullets = (index: number) => {
    const entry = getValues(`experience.${index}`);
    if (!entry) return;
    setAiTargetIndex(index);
    setAiModalOpen(true);
    aiClear();
    improve({
      type: "bullets",
      jobTitle: entry.role,
      company: entry.company,
      existingBullets: entry.bullets?.filter(Boolean),
    });
  };

  const handleApplyBullets = (selected: string[]) => {
    const currentItem = getValues(`experience.${aiTargetIndex}`);
    if (!currentItem) return;
    const existing = (currentItem.bullets || []).filter(Boolean);
    const merged = [...existing, ...selected].slice(0, MAX_BULLETS);
    update(aiTargetIndex, { ...currentItem, bullets: merged });
    setAiModalOpen(false);
    aiClear();
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
    const availableSlots = Math.max(1, MAX_BULLETS - before.length - after.length);
    const next = [...before, ...split.slice(0, availableSlots), ...after];
    update(index, { ...currentItem, bullets: next.length ? next : [""] });
  };

  const handleAddRole = () => {
    append(createEmptyItems.experience());
    setOpenIndex(fields.length);
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="cv-step-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="cv-step-heading">Work Experience</h2>
          <span className="cv-badge-required">Required</span>
        </div>
        <p className="cv-step-subtitle">
          Add your most impactful roles first. Drag the handle to reorder. Use bullet points with results.
        </p>

        <div className="mt-6">
          <Repeater
            title="Roles"
            action={
              <button type="button" onClick={handleAddRole} className="cv-btn-ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Employment
              </button>
            }
          >
            {fields.map((field, index) => {
              const isOpen = openIndex === index;
              const isDragging = draggingIndex === index;
              const isDropTarget =
                dragOverIndex === index && draggingIndex !== null && draggingIndex !== index;
              const role = watch(`experience.${index}.role`) || "";
              const company = watch(`experience.${index}.company`) || "";
              const startDate = watch(`experience.${index}.startDate`) || "";
              const endDate = watch(`experience.${index}.endDate`) || "";
              const summaryLine = [role, company, [startDate, endDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | ");
              const canMoveUp = index > 0;
              const canMoveDown = index < fields.length - 1;

              return (
                <div
                  key={field.id}
                  className="cv-entry-card"
                  onDragOver={(e) => {
                    if (draggingIndex === null || draggingIndex === index) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIndex !== index) setDragOverIndex(index);
                  }}
                  onDragLeave={(e) => {
                    // Only clear when the pointer leaves the card entirely, not
                    // when it moves over a child element.
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
                  style={{
                    opacity: isDragging ? 0.4 : 1,
                    transform: isDropTarget ? "translateY(-1px)" : undefined,
                    boxShadow: isDropTarget
                      ? "0 0 0 2px var(--brand-primary)"
                      : undefined,
                    transition: "opacity 150ms, box-shadow 150ms",
                  }}
                >
                  <div className="flex w-full items-center px-2 py-3.5">
                    {/* Drag handle */}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Drag role ${index + 1} to reorder`}
                      title="Drag to reorder"
                      draggable
                      onDragStart={(e) => {
                        setDraggingIndex(index);
                        e.dataTransfer.effectAllowed = "move";
                        try {
                          e.dataTransfer.setData("text/plain", String(index));
                        } catch {
                          /* some browsers throw on unsupported types */
                        }
                      }}
                      onDragEnd={() => {
                        setDraggingIndex(null);
                        setDragOverIndex(null);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        marginRight: 4,
                        color: "var(--text-faint)",
                        cursor: "grab",
                        flexShrink: 0,
                        userSelect: "none",
                      }}
                      onMouseDown={(e) => {
                        (e.currentTarget as HTMLElement).style.cursor = "grabbing";
                      }}
                      onMouseUp={(e) => {
                        (e.currentTarget as HTMLElement).style.cursor = "grab";
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="9" cy="6" r="1.6" />
                        <circle cx="15" cy="6" r="1.6" />
                        <circle cx="9" cy="12" r="1.6" />
                        <circle cx="15" cy="12" r="1.6" />
                        <circle cx="9" cy="18" r="1.6" />
                        <circle cx="15" cy="18" r="1.6" />
                      </svg>
                    </span>

                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex flex-1 items-center justify-between px-2 text-left min-w-0"
                    >
                      <span
                        style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}
                        className="truncate"
                      >
                        {summaryLine || `Role ${index + 1}`}
                      </span>
                      <svg
                        className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        style={{ color: "var(--text-faint)" }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-soft)", padding: 20 }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => reorder(index, index - 1)}
                            disabled={!canMoveUp}
                            aria-label="Move role up"
                            title="Move up"
                            className="cv-btn-secondary"
                            style={{
                              fontSize: 12,
                              padding: "5px 9px",
                              opacity: canMoveUp ? 1 : 0.4,
                              cursor: canMoveUp ? "pointer" : "not-allowed",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 15l-6-6-6 6" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => reorder(index, index + 1)}
                            disabled={!canMoveDown}
                            aria-label="Move role down"
                            title="Move down"
                            className="cv-btn-secondary"
                            style={{
                              fontSize: 12,
                              padding: "5px 9px",
                              opacity: canMoveDown ? 1 : 0.4,
                              cursor: canMoveDown ? "pointer" : "not-allowed",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="cv-btn-danger">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <Field label="Job Title" error={errors.experience?.[index]?.role?.message}>
                          <input
                            className="cv-input"
                            placeholder="e.g. Operations Manager"
                            {...register(`experience.${index}.role`)}
                            onChange={(e) => {
                              e.target.value = sanitizeJobTitle(e.target.value);
                              register(`experience.${index}.role`).onChange(e);
                            }}
                          />
                        </Field>
                        <Field label="Employer / Company" error={errors.experience?.[index]?.company?.message}>
                          <input
                            className="cv-input"
                            placeholder="e.g. Interior360 General Trading LLC"
                            {...register(`experience.${index}.company`)}
                            onChange={(e) => {
                              e.target.value = sanitizeCompanyName(e.target.value);
                              register(`experience.${index}.company`).onChange(e);
                            }}
                          />
                        </Field>
                        <Field label="Start date" error={errors.experience?.[index]?.startDate?.message}>
                          <input className="cv-input" placeholder="e.g. Jan 2024" {...register(`experience.${index}.startDate`)} />
                        </Field>
                        <Field label="End date">
                          <input className="cv-input" placeholder="e.g. Mar 2026" {...register(`experience.${index}.endDate`)} />
                        </Field>
                        <Field label="City">
                          <input
                            className="cv-input"
                            placeholder="e.g. Dubai"
                            {...register(`experience.${index}.location`)}
                            onChange={(e) => {
                              e.target.value = sanitizeLocation(e.target.value);
                              register(`experience.${index}.location`).onChange(e);
                            }}
                          />
                        </Field>
                        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-body)" }}>
                          <input type="checkbox" {...register(`experience.${index}.isCurrent`)} />
                          I currently work here
                        </label>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>Highlights</p>
                          <button
                            type="button"
                            onClick={() => handleGenerateBullets(index)}
                            className="cv-btn-secondary"
                            style={{ fontSize: 12, padding: "5px 12px" }}
                          >
                            {"\u2728"} Generate Bullets
                          </button>
                        </div>
                        <div className="cv-tip-box">
                          Tip: Use 3-5 bullets. Keep each 1-2 lines. Start with an action verb + result/metric.
                        </div>
                        {(watch(`experience.${index}.bullets`) || []).map((_, bulletIndex) => (
                          <div key={bulletIndex} className="space-y-1">
                            <div className="flex items-start gap-2">
                              <textarea
                                rows={2}
                                placeholder="Describe your responsibilities and achievements..."
                                className="cv-input flex-1"
                                {...register(`experience.${index}.bullets.${bulletIndex}`)}
                                onFocus={() => setFocusedBullet({ itemIndex: index, bulletIndex })}
                                onBlur={(e) => {
                                  register(`experience.${index}.bullets.${bulletIndex}`).onBlur(e);
                                  const cleaned = sanitizePlainText(e.target.value);
                                  if (cleaned !== e.target.value) e.target.value = cleaned;
                                }}
                              />
                              <button type="button" onClick={() => removeBullet(index, bulletIndex)} className="cv-btn-danger">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                Remove
                              </button>
                            </div>
                            {(watch(`experience.${index}.bullets.${bulletIndex}`) || "").length > 180 && (
                              <p style={{ fontSize: 12, color: "var(--status-warning)" }}>
                                Consider splitting into 2 bullets for readability.
                              </p>
                            )}
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => addBullet(index)} className="cv-btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}>
                            Add bullet
                          </button>
                          <button
                            type="button"
                            onClick={() => splitFocusedBullet(index)}
                            disabled={!focusedBullet || focusedBullet.itemIndex !== index}
                            className="cv-btn-secondary"
                            style={{ fontSize: 12, padding: "6px 14px", opacity: (!focusedBullet || focusedBullet.itemIndex !== index) ? 0.5 : 1 }}
                          >
                            Split pasted text
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Repeater>
        </div>

        {errors.experience?.message && (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--status-error)" }}>{errors.experience?.message}</p>
        )}

        <div className="cv-tip-box" style={{ marginTop: 16 }}>
          ATS tip: Lead each bullet with an action verb (Led, Managed, Delivered) and quantify impact (%, AED, headcount). UAE recruiters scan for measurable results.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />

      <AIResultsModal
        isOpen={aiModalOpen}
        onClose={() => { setAiModalOpen(false); aiClear(); }}
        type="bullets"
        results={aiResults}
        isLoading={aiLoading}
        error={aiError}
        onApply={handleApplyBullets}
        onRetry={() => handleGenerateBullets(aiTargetIndex)}
      />
    </form>
  );
};
