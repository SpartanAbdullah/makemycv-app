"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { skillsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { createId } from "../../../lib/utils/id";
import { NavigationButtons } from "../NavigationButtons";
import { useAIImprove } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";
import { sanitizeSkill, sanitizeSkillLive } from "../../../lib/sanitize";
import { Icon } from "../Icon";
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
        fireAISuggest();
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
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <section className="cv-step-card">
        {/* Input row */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            className="cv-input"
            style={{ flex: 1 }}
            placeholder="e.g. Project Management, SAP, AutoCAD"
            value={inputValue}
            onChange={(e) => {
              setInputValue(sanitizeSkillLive(e.target.value));
              setDuplicateWarning(false);
            }}
            onBlur={(e) => {
              setInputValue(sanitizeSkill(e.target.value));
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
            className="cv-btn-primary"
            style={{ padding: "13px 22px" }}
          >
            Add
          </button>
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--ff-warn)", fontWeight: 500 }}>
            This skill is already in your list.
          </p>
        )}

        {/* AI suggest button */}
        <button
          type="button"
          onClick={fireAISuggest}
          className="cv-btn-accent-outline"
          style={{ width: "100%", padding: "11px", marginTop: 12, marginBottom: 14 }}
        >
          <Icon name="sparkle" size={13} />
          Suggest skills for my profile
        </button>

        {/* Skills pills — draggable */}
        {fields.length === 0 ? (
          <p
            style={{
              padding: "24px 0",
              textAlign: "center",
              fontSize: 13,
              color: "var(--ff-faint)",
            }}
          >
            No skills added yet. Type above or let AI suggest some.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {fields.map((field, i) => (
              <div
                key={field.id}
                draggable
                onDragStart={() => setDraggedIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => setDraggedIndex(null)}
                className="cv-skill-chip"
                style={{
                  cursor: "grab",
                  opacity: draggedIndex === i ? 0.4 : 1,
                  borderStyle: draggedIndex === i ? "dashed" : "solid",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--ff-accent)" }}>
                  {"\u283F"}
                </span>
                {field.name}
                <button
                  type="button"
                  onClick={() => removeSkill(i)}
                  className="cv-skill-chip-remove"
                  aria-label={`Remove ${field.name}`}
                >
                  {"\u00D7"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Skill count helper */}
        <p
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--ff-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span className={countColor} style={{ fontWeight: 600 }}>
            {fields.length}
          </span>{" "}
          skill{fields.length !== 1 ? "s" : ""} {"\u00B7"} aim for 10{"\u2013"}20
          for best ATS results
        </p>

        {errors.skills?.message && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--ff-red)" }}>
            {errors.skills?.message}
          </p>
        )}
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
