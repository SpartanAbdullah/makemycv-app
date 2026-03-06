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
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
              >
                Add entry
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
                            className="text-xs text-red-500"
                          >
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
          ATS tip: Include graduation dates or expected completion.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />
    </form>
  );
};
