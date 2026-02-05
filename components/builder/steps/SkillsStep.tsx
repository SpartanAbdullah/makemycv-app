"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { skillsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { createId } from "../../../lib/utils/id";
import { Field } from "../../forms/Field";
import { TagInput } from "../../forms/TagInput";
import { NavigationButtons } from "../NavigationButtons";
import type { CvSkill } from "../../../lib/types/cv";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

type SkillsForm = { skills: CvSkill[] };

export const SkillsStep = ({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) => {
  const skills = useCvStore((state) => state.data.skills);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(skills));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    handleSubmit,
    control,
    watch,
    reset,
    register,
    formState: { errors, isDirty },
  } = useForm<SkillsForm>({
    resolver: zodResolver(skillsSchema),
    defaultValues: { skills },
  });

  const { fields, replace, remove } = useFieldArray({
    control,
    name: "skills",
    keyName: "fieldKey",
  });

  useEffect(() => {
    if (!isDirty) reset({ skills });
  }, [skills, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(skills);
  }, [skills]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.skills) {
        const nextSerialized = JSON.stringify(value.skills);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("skills", value.skills);
          }
        }, 250);
      }
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  const skillsByName = useMemo(() => {
    const map = new Map<string, CvSkill[]>();
    fields.forEach((skill) => {
      const list = map.get(skill.name) ?? [];
      list.push(skill);
      map.set(skill.name, list);
    });
    return map;
  }, [fields]);

  const handleTagsChange = (tags: string[]) => {
    const usedIds = new Set<string>();
    const next = tags.map((tag) => {
      const matches = skillsByName.get(tag) ?? [];
      const existing = matches.find((skill) => !usedIds.has(skill.id));
      if (existing) {
        usedIds.add(existing.id);
        return { ...existing, name: tag };
      }
      return { id: createId(), name: tag, level: "intermediate" };
    });
    replace(next);
  };

  const removeSkill = (id: string) => {
    const index = fields.findIndex((skill) => skill.id === id);
    if (index !== -1) remove(index);
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Skills</h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
            Required
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Add key skills and adjust proficiency if needed.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Quick add">
            <TagInput
              value={fields.map((field) => field.name)}
              onChange={handleTagsChange}
              placeholder="Type a skill and press Enter"
            />
          </Field>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                <input
                  className={inputClass}
                  {...register(`skills.${index}.name`)}
                />
                <select
                  className={inputClass}
                  {...register(`skills.${index}.level`)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSkill(field.id)}
                  className="text-xs text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {errors.skills?.message && (
            <p className="text-xs text-red-500">{errors.skills?.message}</p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Keep skill names consistent with job descriptions.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />
    </form>
  );
};
