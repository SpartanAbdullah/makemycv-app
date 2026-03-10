"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { educationSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import type { CvEducation } from "../../../lib/types/cv";

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
  const lastSerializedRef = useRef<string>(JSON.stringify(education));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: { education },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "education",
  });

  useEffect(() => {
    if (!isDirty) reset({ education });
  }, [education, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(education);
  }, [education]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.education) {
        const next = (value.education ?? []).filter(
          (e): e is CvEducation => Boolean(e && e.id && e.school && e.degree),
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

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="cv-step-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="cv-step-heading">Education</h2>
          <span className="cv-badge-required">Required</span>
        </div>
        <p className="cv-step-subtitle">
          Add your most recent education first.
        </p>

        <div className="mt-6">
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
                      <div className="flex justify-end">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="cv-btn-danger">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <Field label="Degree / Qualification" error={errors.education?.[index]?.degree?.message}>
                          <input className="cv-input" placeholder="e.g. Bachelor of Business Administration" {...register(`education.${index}.degree`)} />
                        </Field>
                        <Field label="School / University" error={errors.education?.[index]?.school?.message}>
                          <input className="cv-input" placeholder="e.g. American University of Sharjah" {...register(`education.${index}.school`)} />
                        </Field>
                        <Field label="Field of study">
                          <input className="cv-input" placeholder="e.g. Finance" {...register(`education.${index}.field`)} />
                        </Field>
                        <Field label="Start year" error={errors.education?.[index]?.startDate?.message}>
                          <input className="cv-input" placeholder="e.g. 2018" {...register(`education.${index}.startDate`)} />
                        </Field>
                        <Field label="End year">
                          <input className="cv-input" placeholder="e.g. 2022" {...register(`education.${index}.endDate`)} />
                        </Field>
                        <Field label="Notes">
                          <input className="cv-input" placeholder="e.g. Sharjah" {...register(`education.${index}.notes`)} />
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
          ATS tip: Include graduation dates. If your degree was earned outside the UAE, note whether it has been attested by MOFA or the relevant emirate authority.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />
    </form>
  );
};
