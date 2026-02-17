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

    update(index, {
      ...currentItem,
      bullets: [...currentBullets, ""],
    });
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const currentItem = getValues(`experience.${index}`);
    if (!currentItem) return;

    const currentBullets = currentItem.bullets || [];
    const next = currentBullets.filter((_, i) => i !== bulletIndex);

    update(index, {
      ...currentItem,
      bullets: next.length ? next : [""],
    });
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

    update(index, {
      ...currentItem,
      bullets: next.length ? next : [""],
    });
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
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p>
                      Tip: Use 3-5 bullets. Keep each 1-2 lines. Start with an action verb + result/metric.
                    </p>
                    <p className="mt-1">
                      Example: Improved release speed by 30% by automating CI test runs.
                    </p>
                    <p className="mt-1">
                      Example: Reduced support tickets by 22% after redesigning onboarding flow.
                    </p>
                  </div>
                  {(watch(`experience.${index}.bullets`) || []).map((_, bulletIndex) => (
                    <div key={bulletIndex} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          className={`${inputClass} flex-1`}
                          {...register(`experience.${index}.bullets.${bulletIndex}`)}
                          onFocus={() => setFocusedBullet({ itemIndex: index, bulletIndex })}
                        />
                        <button
                          type="button"
                          onClick={() => removeBullet(index, bulletIndex)}
                          className="text-xs text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                      {(watch(`experience.${index}.bullets.${bulletIndex}`) || "").length > 180 && (
                        <p className="text-xs text-amber-600">
                          Consider splitting into 2 bullets for readability.
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addBullet(index)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
                    >
                      Add bullet
                    </button>
                    <button
                      type="button"
                      onClick={() => splitFocusedBullet(index)}
                      disabled={!focusedBullet || focusedBullet.itemIndex !== index}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Split pasted text
                    </button>
                  </div>
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
