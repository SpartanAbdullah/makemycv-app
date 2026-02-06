"use client";

import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectsSchema } from "../../../lib/schemas/cvSchemas";
import { createEmptyItems, useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { Repeater } from "../../forms/Repeater";
import { NavigationButtons } from "../NavigationButtons";
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
    setValue,
    reset,
    formState: { isDirty },
  } = useForm<ProjectsForm>({
    resolver: zodResolver(projectsSchema),
    defaultValues: { projects },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "projects",
  });

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
    const current = watch(`projects.${index}.bullets`) || [];
    setValue(`projects.${index}.bullets`, [...current, ""]);
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const current = watch(`projects.${index}.bullets`) || [];
    const next = current.filter((_, i) => i !== bulletIndex);
    setValue(`projects.${index}.bullets`, next.length ? next : [""]);
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
                  {(watch(`projects.${index}.bullets`) || []).map((_, bulletIndex) => (
                    <div key={bulletIndex} className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        className={`${inputClass} flex-1`}
                        {...register(`projects.${index}.bullets.${bulletIndex}`)}
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
