"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectsSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
import { MAX_BULLETS, splitPastedBulletText } from "../../../lib/utils/bullets";
import type { CvProject } from "../../../lib/types/cv";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

type ProjectsForm = { projects: CvProject[] };

export const ProjectsStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) => {
  const projects = useCvStore((state) => state.data.projects);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(projects));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    reset,
    formState: { isDirty },
  } = useForm<ProjectsForm>({
    resolver: zodResolver(projectsSchema),
    defaultValues: { projects },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "projects",
  });

  const [focusedBullet, setFocusedBullet] = useState<{
    itemIndex: number;
    bulletIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!isDirty) reset({ projects });
  }, [projects, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(projects);
  }, [projects]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.projects) {
        const next = (value.projects ?? []).filter(
          (project): project is CvProject => Boolean(project && project.id),
        );
        const nextSerialized = JSON.stringify(next);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("projects", next);
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
    const currentItem = getValues(`projects.${index}`);
    if (!currentItem) return;

    const currentBullets = currentItem.bullets || [];
    if (currentBullets.length >= MAX_BULLETS) return;

    update(index, {
      ...currentItem,
      bullets: [...currentBullets, ""],
    });
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const currentItem = getValues(`projects.${index}`);
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

    const currentItem = getValues(`projects.${index}`);
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
          <h2 className="font-display text-2xl">Projects</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Optional
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Highlight personal or professional projects that match the role.
        </p>

        <div className="mt-6">
          <Repeater
            title="Projects"
            action={
              <button
                type="button"
                onClick={() => append(createEmptyItems.project())}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
              >
                Add project
              </button>
            }
          >
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Project {index + 1}
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
                  <Field label="Project name">
                    <input className={inputClass} {...register(`projects.${index}.name`)} />
                  </Field>
                  <Field label="Link">
                    <input className={inputClass} {...register(`projects.${index}.link`)} />
                  </Field>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Highlights</p>
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p>
                      Tip: Use 3-5 bullets. Keep each 1-2 lines. Start with an action verb + result/metric.
                    </p>
                    <p className="mt-1">
                      Example: Built a search feature that cut average lookup time by 40%.
                    </p>
                    <p className="mt-1">
                      Example: Increased daily active users by 15% after launching onboarding improvements.
                    </p>
                  </div>
                  {(watch(`projects.${index}.bullets`) || []).map((_, bulletIndex) => (
                    <div key={bulletIndex} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          className={`${inputClass} flex-1`}
                          {...register(`projects.${index}.bullets.${bulletIndex}`)}
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
                      {(watch(`projects.${index}.bullets.${bulletIndex}`) || "").length > 180 && (
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

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Use project titles that clearly convey scope and tools.
        </div>
      </section>

      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
