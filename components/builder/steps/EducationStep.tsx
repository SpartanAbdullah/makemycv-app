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

const inputClass =
  "cv-input rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

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
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Education</h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
            Required
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Add your most recent education first.
        </p>

        <div className="mt-6">
          <Repeater
            title="Education entries"
            action={
              <button
                type="button"
                onClick={handleAddEntry}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-semibold hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-blue-50 active:bg-blue-100 transition-all duration-200 cursor-pointer group"
              >
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                <div key={field.id} className="rounded-2xl border border-slate-200">
                  {/* Accordion header */}
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-700 truncate">
                      {summaryLine || `Education ${index + 1}`}
                    </span>
                    <svg
                      className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Accordion body */}
                  {isOpen && (
                    <div className="border-t border-slate-100 p-4">
                      <div className="flex justify-end">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-200"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        <Field
                          label="Degree / Qualification"
                          error={errors.education?.[index]?.degree?.message}
                        >
                          <input className={inputClass} placeholder="e.g. Bachelor of Business Administration" {...register(`education.${index}.degree`)} />
                        </Field>
                        <Field
                          label="School / University"
                          error={errors.education?.[index]?.school?.message}
                        >
                          <input className={inputClass} placeholder="e.g. American University of Sharjah" {...register(`education.${index}.school`)} />
                        </Field>
                        <Field label="Field of study">
                          <input className={inputClass} placeholder="e.g. Finance" {...register(`education.${index}.field`)} />
                        </Field>
                        <Field
                          label="Start year"
                          error={errors.education?.[index]?.startDate?.message}
                        >
                          <input className={inputClass} placeholder="e.g. 2018" {...register(`education.${index}.startDate`)} />
                        </Field>
                        <Field label="End year">
                          <input className={inputClass} placeholder="e.g. 2022" {...register(`education.${index}.endDate`)} />
                        </Field>
                        <Field label="Notes">
                          <input className={inputClass} placeholder="e.g. Sharjah" {...register(`education.${index}.notes`)} />
                        </Field>
                      </div>

                      {/* Attested toggle */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-slate-600">Degree Attested?</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">Required for UAE government &amp; semi-government roles</p>
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
                            className={`relative w-10 h-6 rounded-full cursor-pointer transition-colors duration-200 flex-shrink-0 ${watch(`education.${index}.attested`) ? "bg-[#2563eb]" : "bg-slate-200"}`}
                          >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${watch(`education.${index}.attested`) ? "translate-x-5" : "translate-x-1"}`} />
                          </div>
                        </div>

                        {watch(`education.${index}.attested`) && (
                          <div className="mt-3">
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Attesting Body</label>
                            <select
                              value={watch(`education.${index}.attestingBody`) ?? ""}
                              onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                  setValue(`education.${index}.attestingBody`, "", { shouldDirty: true });
                                } else {
                                  setValue(`education.${index}.attestingBody`, e.target.value, { shouldDirty: true });
                                }
                              }}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all"
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
                                className="w-full mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all"
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
          <p className="mt-3 text-xs text-red-500">{errors.education?.message}</p>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Include graduation dates. If your degree was earned outside the UAE, note whether it has been attested by MOFA or the relevant emirate authority.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />
    </form>
  );
};
