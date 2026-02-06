"use client";

import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { experienceSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import type { CvExperience } from "../../../lib/types/cv";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

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

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<ExperienceForm>({
    resolver: zodResolver(experienceSchema),
    defaultValues: { experience },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "experience",
  });

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
    const current = watch(`experience.${index}.bullets`) || [];
    setValue(`experience.${index}.bullets`, [...current, ""]);
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const current = watch(`experience.${index}.bullets`) || [];
    const next = current.filter((_, i) => i !== bulletIndex);
    setValue(`experience.${index}.bullets`, next.length ? next : [""]);
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Work Experience</h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
            Required
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Add your most impactful roles first. Use bullet points with results.
        </p>

        <div className="mt-6">
          <Repeater
            title="Roles"
            action={
              <button
                type="button"
                onClick={() => append(createEmptyItems.experience())}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
              >
                Add role
              </button>
            }
          >
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Role {index + 1}
                  </h4>
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

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Company"
                    error={errors.experience?.[index]?.company?.message}
                  >
                    <input className={inputClass} {...register(`experience.${index}.company`)} />
                  </Field>
                  <Field
                    label="Role"
                    error={errors.experience?.[index]?.role?.message}
                  >
                    <input className={inputClass} {...register(`experience.${index}.role`)} />
                  </Field>
                  <Field label="Location">
                    <input className={inputClass} {...register(`experience.${index}.location`)} />
                  </Field>
                  <Field
                    label="Start date"
                    error={errors.experience?.[index]?.startDate?.message}
                  >
                    <input className={inputClass} {...register(`experience.${index}.startDate`)} />
                  </Field>
                  <Field label="End date">
                    <input className={inputClass} {...register(`experience.${index}.endDate`)} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" {...register(`experience.${index}.isCurrent`)} />
                    I currently work here
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Highlights</p>
                  {(watch(`experience.${index}.bullets`) || []).map((_, bulletIndex) => (
                    <div key={bulletIndex} className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        className={`${inputClass} flex-1`}
                        {...register(`experience.${index}.bullets.${bulletIndex}`)}
                      />
                      <button
                        type="button"
                        onClick={() => removeBullet(index, bulletIndex)}
                        className="text-xs text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addBullet(index)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
                  >
                    Add bullet
                  </button>
                </div>
              </div>
            ))}
          </Repeater>
        </div>

        {errors.experience?.message && (
          <p className="mt-3 text-xs text-red-500">{errors.experience?.message}</p>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Lead each bullet with an action verb and quantify impact.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />
    </form>
  );
};
