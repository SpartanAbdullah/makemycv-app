"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { educationSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { useUiStore } from "../../../lib/store/uiStore";
import { Field } from "../../forms/Field";
import { useBlurFeedback } from "../../forms/useBlurFeedback";
import { fieldValidators } from "../../../lib/validation/cvRequirements";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import {
  sanitizeCompanyName,
  sanitizeCompanyNameLive,
  sanitizeJobTitle,
  sanitizeJobTitleLive,
} from "../../../lib/sanitize";
import type { CvEducation } from "../../../lib/types/cv";
import { UAEDot } from "../UAEDot";
import { Icon } from "../Icon";

const ATTESTING_BODIES = [
  "MOFA \u2013 UAE Ministry of Foreign Affairs",
  "MOFAIC \u2013 Ministry of Foreign Affairs & Int\u2019l Cooperation",
  "HEC \u2013 Higher Education Commission (Pakistan)",
  "WES \u2013 World Education Services (Canada)",
  "NARIC \u2013 UK ENIC National Recognition",
  "NOOSR \u2013 Australia",
  "DATAFLOW \u2013 Healthcare / DHA / HAAD Verification",
  "Embassy Attestation \u2013 Home Country",
  "Notary / Legal Attestation",
] as const;

type EducationForm = { education: CvEducation[] };

export const EducationStep = ({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) => {
  const education = useCvStore((state) => state.data.education);
  const updateSection = useCvStore((state) => state.updateSection);
  const pushToast = useUiStore((s) => s.pushToast);
  const lastSerializedRef = useRef<string>(JSON.stringify(education));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // First card opens by default — matching ExperienceStep — so a first-time
  // user lands on a typeable form, not a collapsed "Education 1" mystery
  // card (audit UX-12). This is a REQUIRED step.
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  // Blur-time validity feedback for required entry fields (guided feedback).
  const { fieldState, blurField, changeField } = useBlurFeedback();

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: { education },
  });

  const { fields, append, remove, move, insert } = useFieldArray({
    control,
    name: "education",
  });

  // Deletion with undo (replaces a confirm dialog): capture the entry BEFORE
  // remove, then offer to re-insert it at its original position. The
  // debounced watch subscription persists both the removal and the restore.
  const handleRemoveEntry = (index: number) => {
    const removed = getValues(`education.${index}`);
    remove(index);
    if (!removed) return;
    pushToast("Education entry removed", {
      actionLabel: "Undo",
      onAction: () => {
        insert(index, removed);
        setOpenIndex(index);
      },
    });
  };

  useEffect(() => {
    if (!isDirty) reset({ education });
  }, [education, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(education);
  }, [education]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.education) {
        // id-only filter, matching every other step. The old
        // `e.school && e.degree` condition silently DROPPED half-entered
        // entries from the store — type a university name, tap Back, and
        // it was gone (audit UX-6). Completion is gated separately by
        // educationSchema in lib/utils/stepValidation.ts.
        const next = (value.education ?? []).filter(
          (e): e is CvEducation => Boolean(e && e.id),
        );
        const nextSerialized = JSON.stringify(next);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("education", next);
          }
        }, 250);
      }
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  const handleAddEntry = () => {
    append(createEmptyItems.education());
    setOpenIndex(fields.length);
  };

  // On failed submit, open the first card that has a validation error so the
  // inline messages are actually reachable inside the collapsed list.
  const onInvalid = (formErrors: FieldErrors<EducationForm>) => {
    const entryErrors = formErrors.education;
    if (!entryErrors) return;
    const firstErrorIndex = Object.keys(entryErrors)
      .map(Number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b)[0];
    if (firstErrorIndex !== undefined) setOpenIndex(firstErrorIndex);
  };

  return (
    <form
      onSubmit={handleSubmit(onNext, onInvalid)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="education" />

      <section className="cv-step-card">
        <div>
          <Repeater
            title="Education entries"
            action={
              <button type="button" onClick={handleAddEntry} className="cv-btn-ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Entry
              </button>
            }
          >
            {fields.map((field, index) => {
              const isOpen = openIndex === index;
              const degree = watch(`education.${index}.degree`) || "";
              const school = watch(`education.${index}.school`) || "";
              const startDate = watch(`education.${index}.startDate`) || "";
              const endDate = watch(`education.${index}.endDate`) || "";
              const summaryLine = [degree, school, [startDate, endDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | ");

              return (
                <div key={field.id} className="cv-entry-card">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="truncate">
                      {summaryLine || `Education ${index + 1}`}
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
                      <div className="flex items-center justify-end" style={{ gap: 6 }}>
                        {/* Reorder — education order (most-recent-first) is one
                            of the app's own ATS tips, but had no affordance
                            here (audit UX-13). */}
                        {fields.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                move(index, index - 1);
                                setOpenIndex(index - 1);
                              }}
                              disabled={index === 0}
                              className="cv-btn-ghost"
                              aria-label="Move entry up"
                              title="Move up"
                              style={{ padding: "8px 10px", opacity: index === 0 ? 0.4 : 1 }}
                            >
                              <Icon name="chevron-up" size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                move(index, index + 1);
                                setOpenIndex(index + 1);
                              }}
                              disabled={index === fields.length - 1}
                              className="cv-btn-ghost"
                              aria-label="Move entry down"
                              title="Move down"
                              style={{ padding: "8px 10px", opacity: index === fields.length - 1 ? 0.4 : 1 }}
                            >
                              <Icon name="chevron-down" size={12} />
                            </button>
                          </>
                        )}
                        {fields.length > 1 && (
                          <button type="button" onClick={() => handleRemoveEntry(index)} className="cv-btn-danger">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <Field
                          label="Degree / Qualification"
                          error={errors.education?.[index]?.degree?.message}
                          feedback={{
                            state: fieldState(`degree-${index}`),
                            message:
                              "Degree is still empty — you can come back anytime",
                          }}
                        >
                          <input
                            className="cv-input"
                            placeholder="e.g. Bachelor of Business Administration"
                            {...register(`education.${index}.degree`)}
                            onChange={(e) => {
                              e.target.value = sanitizeJobTitleLive(e.target.value);
                              register(`education.${index}.degree`).onChange(e);
                              changeField(`degree-${index}`, fieldValidators.entryText(e.target.value));
                            }}
                            onBlur={(e) => {
                              e.target.value = sanitizeJobTitle(e.target.value);
                              register(`education.${index}.degree`).onChange(e);
                              register(`education.${index}.degree`).onBlur(e);
                              blurField(`degree-${index}`, fieldValidators.entryText(e.target.value));
                            }}
                          />
                        </Field>
                        <Field
                          label="School / University"
                          error={errors.education?.[index]?.school?.message}
                          feedback={{
                            state: fieldState(`school-${index}`),
                            message:
                              "School is still empty — you can come back anytime",
                          }}
                        >
                          <input
                            className="cv-input"
                            placeholder="e.g. American University of Sharjah"
                            {...register(`education.${index}.school`)}
                            onChange={(e) => {
                              e.target.value = sanitizeCompanyNameLive(e.target.value);
                              register(`education.${index}.school`).onChange(e);
                              changeField(`school-${index}`, fieldValidators.entryText(e.target.value));
                            }}
                            onBlur={(e) => {
                              e.target.value = sanitizeCompanyName(e.target.value);
                              register(`education.${index}.school`).onChange(e);
                              register(`education.${index}.school`).onBlur(e);
                              blurField(`school-${index}`, fieldValidators.entryText(e.target.value));
                            }}
                          />
                        </Field>
                        <Field label="Field of study">
                          <input
                            className="cv-input"
                            placeholder="e.g. Finance"
                            {...register(`education.${index}.field`)}
                            onChange={(e) => {
                              e.target.value = sanitizeJobTitleLive(e.target.value);
                              register(`education.${index}.field`).onChange(e);
                            }}
                            onBlur={(e) => {
                              e.target.value = sanitizeJobTitle(e.target.value);
                              register(`education.${index}.field`).onChange(e);
                              register(`education.${index}.field`).onBlur(e);
                            }}
                          />
                        </Field>
                        <Field
                          label="Start year"
                          error={errors.education?.[index]?.startDate?.message}
                          feedback={{
                            state: fieldState(`startDate-${index}`),
                            message:
                              "Start year is still empty — you can come back anytime",
                          }}
                        >
                          <input
                            className="cv-input"
                            placeholder="e.g. 2018"
                            {...register(`education.${index}.startDate`)}
                            onChange={(e) => {
                              register(`education.${index}.startDate`).onChange(e);
                              changeField(`startDate-${index}`, fieldValidators.entryText(e.target.value));
                            }}
                            onBlur={(e) => {
                              register(`education.${index}.startDate`).onBlur(e);
                              blurField(`startDate-${index}`, fieldValidators.entryText(e.target.value));
                            }}
                          />
                        </Field>
                        <Field label="End year">
                          <input className="cv-input" placeholder="e.g. 2022" {...register(`education.${index}.endDate`)} />
                        </Field>
                        <Field label="Notes">
                          <input className="cv-input" placeholder="e.g. Graduated with distinction / GPA 3.8" {...register(`education.${index}.notes`)} />
                        </Field>
                      </div>

                      {/* Attested toggle */}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span className="cv-label" style={{ marginBottom: 0 }}>Degree Attested?</span>
                            <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>Required for UAE government &amp; semi-government roles</p>
                          </div>
                          <div
                            role="checkbox"
                            aria-checked={watch(`education.${index}.attested`) ?? false}
                            tabIndex={0}
                            onClick={() => setValue(`education.${index}.attested`, !(watch(`education.${index}.attested`) ?? false), { shouldDirty: true })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setValue(`education.${index}.attested`, !(watch(`education.${index}.attested`) ?? false), { shouldDirty: true });
                              }
                            }}
                            style={{
                              position: "relative",
                              width: 40,
                              height: 24,
                              borderRadius: 12,
                              cursor: "pointer",
                              transition: "background var(--transition-fast)",
                              flexShrink: 0,
                              background: watch(`education.${index}.attested`) ? "var(--brand-primary)" : "var(--border-medium)",
                            }}
                          >
                            <span style={{
                              position: "absolute",
                              top: 4,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "white",
                              boxShadow: "var(--shadow-xs)",
                              transition: "transform var(--transition-fast)",
                              transform: watch(`education.${index}.attested`) ? "translateX(20px)" : "translateX(4px)",
                            }} />
                          </div>
                        </div>

                        {watch(`education.${index}.attested`) && (
                          <div style={{ marginTop: 12 }}>
                            <label className="cv-label">Attesting Body</label>
                            <select
                              value={watch(`education.${index}.attestingBody`) ?? ""}
                              onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                  setValue(`education.${index}.attestingBody`, "", { shouldDirty: true });
                                } else {
                                  setValue(`education.${index}.attestingBody`, e.target.value, { shouldDirty: true });
                                }
                              }}
                              className="cv-select"
                            >
                              <option value="">Select attesting body...</option>
                              {ATTESTING_BODIES.map((body) => (
                                <option key={body} value={body}>{body}</option>
                              ))}
                              <option value="__custom__">+ Add custom...</option>
                            </select>

                            {(watch(`education.${index}.attestingBody`) !== undefined &&
                              watch(`education.${index}.attestingBody`) !== "" &&
                              !(ATTESTING_BODIES as readonly string[]).includes(watch(`education.${index}.attestingBody`) ?? "")) && (
                              <input
                                type="text"
                                value={watch(`education.${index}.attestingBody`) ?? ""}
                                onChange={(e) => setValue(`education.${index}.attestingBody`, e.target.value, { shouldDirty: true })}
                                placeholder="Type attesting body name..."
                                className="cv-input"
                                style={{ marginTop: 8 }}
                                autoFocus
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Repeater>
        </div>

        {errors.education?.message && (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--status-error)" }}>{errors.education?.message}</p>
        )}

        <div className="cv-tip-box" style={{ marginTop: 16 }}>
          <Icon name="sparkle" size={11} style={{ verticalAlign: "-2px" }} /> Include graduation dates. If your degree was earned outside the UAE, note whether it has been attested by MOFA or the relevant emirate authority.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext, onInvalid)} nextLabel="Continue to Skills" />
    </form>
  );
};
