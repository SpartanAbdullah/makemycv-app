"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { skillsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { createId } from "../../../lib/utils/id";
import { NavigationButtons } from "../NavigationButtons";
import { useAIImprove, hasUsedFreeAI } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";
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

  const [inputValue, setInputValue] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  /* ── AI skills suggestion ── */
  const {
    improve,
    results: aiResults,
    isLoading: aiLoading,
    error: aiError,
    clearResults: aiClear,
  } = useAIImprove();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const aiTriggerChecked = useRef(false);

  const fireAISuggest = () => {
    const store = useCvStore.getState().data;
    setAiModalOpen(true);
    aiClear();
    improve({
      type: "skills",
      headline: store.personal.headline,
      experienceRoles: store.experience.map((r) => ({
        title: r.role,
        company: r.company,
        bullets: r.bullets.filter(Boolean),
      })),
      existingSkills: fields.map((f) => f.name),
    });
  };

  useEffect(() => {
    if (aiTriggerChecked.current) return;
    aiTriggerChecked.current = true;
    try {
      const trigger = sessionStorage.getItem("makemycv_ai_trigger");
      if (trigger === "skills") {
        sessionStorage.removeItem("makemycv_ai_trigger");
        if (!hasUsedFreeAI("skills")) fireAISuggest();
      }
    } catch {
      /* SSR guard */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplySkills = (selected: string[]) => {
    const existingNames = new Set(fields.map((f) => f.name.toLowerCase()));
    const newSkills: CvSkill[] = selected
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => ({
        id: createId(),
        name,
        level: toSkillLevel("intermediate"),
      }));
    const current = fields.map((f) => ({
      id: f.id,
      name: f.name,
      level: toSkillLevel(f.level ?? "intermediate"),
    }));
    replace([...current, ...newSkills]);
    setAiModalOpen(false);
    aiClear();
  };

  /* ── Form ↔ Zustand sync ── */
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

  /* ── Handlers ── */
  const handleAddSkill = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (fields.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setDuplicateWarning(true);
      return;
    }
    const newSkill: CvSkill = {
      id: createId(),
      name: trimmed,
      level: toSkillLevel("intermediate"),
    };
    replace([
      ...fields.map((f) => ({
        id: f.id,
        name: f.name,
        level: toSkillLevel(f.level ?? "intermediate"),
      })),
      newSkill,
    ]);
    setInputValue("");
    setDuplicateWarning(false);
  };

  const removeSkill = (index: number) => {
    const updated = fields
      .filter((_, i) => i !== index)
      .map((f) => ({
        id: f.id,
        name: f.name,
        level: toSkillLevel(f.level ?? "intermediate"),
      }));
    replace(updated);
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const items = fields.map((f) => ({
      id: f.id,
      name: f.name,
      level: toSkillLevel(f.level ?? "intermediate"),
    }));
    const [moved] = items.splice(draggedIndex, 1);
    items.splice(dropIndex, 0, moved);
    replace(items);
    setDraggedIndex(null);
  };

  const countColor =
    fields.length < 3
      ? "text-red-500"
      : fields.length < 6
        ? "text-amber-500"
        : "text-green-600";

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="cv-step-card">
        <div className="flex items-center justify-between">
          <h2 className="cv-step-heading">Skills</h2>
          <span className="cv-badge-required">Required</span>
        </div>
        <p className="cv-step-subtitle">
          Add key skills and adjust proficiency if needed. Aim for 6-10 skills
          that match the job description.
        </p>

        {/* Input row */}
        <div className="mt-6 mb-6 flex w-full items-center gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="e.g. Project Management, SAP, AutoCAD"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setDuplicateWarning(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputValue.trim() !== "") {
                e.preventDefault();
                handleAddSkill();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddSkill}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Add
          </button>
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <p className="-mt-4 mb-2 text-xs font-medium text-amber-600">
            {"\u26A0\uFE0F"} This skill is already in your list
          </p>
        )}

        {/* AI suggest button */}
        <button
          type="button"
          onClick={fireAISuggest}
          className="mb-4 w-full rounded-xl border-2 border-dashed border-indigo-300 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
        >
          {"\u2728"} Suggest Skills for My Profile
        </button>

        {/* Skills pills — draggable */}
        {fields.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No skills added yet. Type above or let AI suggest some.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fields.map((field, i) => (
              <div
                key={field.id}
                draggable
                onDragStart={() => setDraggedIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => setDraggedIndex(null)}
                className={`flex cursor-grab items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium select-none transition-all duration-150 active:cursor-grabbing ${
                  draggedIndex === i
                    ? "scale-95 border-2 border-dashed border-indigo-400 bg-indigo-100 opacity-40"
                    : "border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                }`}
              >
                <span className="mr-0.5 text-xs text-indigo-300">
                  {"\u283F"}
                </span>
                {field.name}
                <button
                  type="button"
                  onClick={() => removeSkill(i)}
                  className="ml-1 text-xs font-bold text-indigo-300 transition hover:text-red-500"
                  aria-label={`Remove ${field.name}`}
                >
                  {"\u00D7"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Skill count helper */}
        <p className="mt-3 text-xs text-gray-400">
          <span className={countColor}>{fields.length}</span>
          {" "}skill{fields.length !== 1 ? "s" : ""} added {"\u00B7"} Aim for
          6{"\u2013"}10 for best ATS results
        </p>

        {errors.skills?.message && (
          <p className="mt-2 text-xs text-red-500">{errors.skills?.message}</p>
        )}

        <div className="cv-tip-box mt-4">
          ATS tip: Keep skill names consistent with job descriptions.
        </div>
      </section>

      <NavigationButtons onBack={onBack} onNext={handleSubmit(onNext)} />

      <AIResultsModal
        isOpen={aiModalOpen}
        onClose={() => {
          setAiModalOpen(false);
          aiClear();
        }}
        type="skills"
        results={aiResults}
        isLoading={aiLoading}
        error={aiError}
        onApply={handleApplySkills}
        onRetry={fireAISuggest}
      />
    </form>
  );
};
