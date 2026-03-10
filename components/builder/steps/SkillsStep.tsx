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
import type { CvSkill, SkillLevel } from "../../../lib/types/cv";

type SkillsForm = { skills: CvSkill[] };

const toSkillLevel = (value: string): SkillLevel => {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return "intermediate";
};

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
    formState: { errors, isDirty },
  } = useForm<SkillsForm>({
    resolver: zodResolver(skillsSchema),
    defaultValues: { skills },
  });

  const { fields, replace } = useFieldArray({
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
        const next = (value.skills ?? []).filter(
          (skill): skill is CvSkill => Boolean(skill && skill.id),
        );
        const nextSerialized = JSON.stringify(next);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("skills", next);
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
        return {
          ...existing,
          name: tag,
          level: toSkillLevel(existing.level ?? "intermediate"),
        };
      }
      return { id: createId(), name: tag, level: toSkillLevel("intermediate") };
    });
    replace(next);
  };

  const removeSkillByIndex = (indexToRemove: number) => {
    const updated = fields
      .filter((_, i) => i !== indexToRemove)
      .map((f) => ({ id: f.id, name: f.name, level: toSkillLevel(f.level ?? "intermediate") }));
    replace(updated);
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="cv-step-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="cv-step-heading">Skills</h2>
          <span className="cv-badge-required">Required</span>
        </div>
        <p className="cv-step-subtitle">
          Add key skills and adjust proficiency if needed. Aim for 6-10 skills that match the job description.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Quick add">
            <TagInput
              value={fields.map((field) => field.name)}
              onChange={handleTagsChange}
              placeholder="e.g. Project Management, SAP, AutoCAD"
            />
          </Field>

          <div className="flex flex-wrap gap-2 mt-3">
            {fields.map((field, index) => (
              <div key={field.id} className="cv-skill-chip">
                <span>{field.name}</span>
                <button
                  type="button"
                  onClick={() => removeSkillByIndex(index)}
                  aria-label={`Remove ${field.name}`}
                  className="cv-skill-chip-remove"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {errors.skills?.message && (
            <p style={{ fontSize: 12, color: "var(--status-error)" }}>{errors.skills?.message}</p>
          )}
        </div>

        <div className="cv-tip-box" style={{ marginTop: 16 }}>
          ATS tip: Keep skill names consistent with job descriptions.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />
    </form>
  );
};
