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

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "experience",
  });

  const [focusedBullet, setFocusedBullet] = useState<{
    itemIndex: number;
    bulletIndex: number;
  } | null>(null);

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
          Add your most impactful roles first. Use bullet points with results.
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
              const role = watch(`experience.${index}.role`) || "";
              const company = watch(`experience.${index}.company`) || "";
              const startDate = watch(`experience.${index}.startDate`) || "";
              const endDate = watch(`experience.${index}.endDate`) || "";
              const summaryLine = [role, company, [startDate, endDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | ");

              return (
                <div key={field.id} className="cv-entry-card">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="truncate">
                      {summaryLine || `Role ${index + 1}`}
                    </span>
                    <svg
                      className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      style={{ color: "var(--text-faint)" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-soft)", padding: 20 }}>
                      <div className="flex justify-end">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="cv-btn-danger">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <Field label="Job Title" error={errors.experience?.[index]?.role?.message}>
                          <input className="cv-input" placeholder="e.g. Operations Manager" {...register(`experience.${index}.role`)} />
                        </Field>
                        <Field label="Employer / Company" error={errors.experience?.[index]?.company?.message}>
                          <input className="cv-input" placeholder="e.g. Interior360 General Trading LLC" {...register(`experience.${index}.company`)} />
                        </Field>
                        <Field label="Start date" error={errors.experience?.[index]?.startDate?.message}>
                          <input className="cv-input" placeholder="e.g. Jan 2024" {...register(`experience.${index}.startDate`)} />
                        </Field>
                        <Field label="End date">
                          <input className="cv-input" placeholder="e.g. Mar 2026" {...register(`experience.${index}.endDate`)} />
                        </Field>
                        <Field label="City">
                          <input className="cv-input" placeholder="e.g. Dubai" {...register(`experience.${index}.location`)} />
                        </Field>
                        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-body)" }}>
                          <input type="checkbox" {...register(`experience.${index}.isCurrent`)} />
                          I currently work here
                        </label>
                      </div>

                      <div className="mt-4 space-y-3">
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-heading)" }}>Highlights</p>
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
    </form>
  );
};
