"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { languagesSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { useUiStore } from "../../../lib/store/uiStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { LANGUAGE_LEVELS } from "../../../lib/language";
import { sanitizeLanguageName, sanitizeLanguageNameLive } from "../../../lib/sanitize";
import { UAEDot } from "../UAEDot";
import { Icon } from "../Icon";
import type { CvLanguage, LanguageLevel } from "../../../lib/types/cv";

type LanguagesForm = { languages: CvLanguage[] };

/* ── Suggested-language chips (UAE-relevant) ───────────────────────────── */

const COMMON_LANGUAGES = [
  "English",
  "Arabic",
  "Urdu",
  "Hindi",
  "Tagalog",
  "Malayalam",
  "Tamil",
  "French",
  "Russian",
];

const SuggestionChips = ({
  current,
  onAdd,
}: {
  current: string[];
  onAdd: (name: string) => void;
}) => {
  const taken = new Set(current.map((n) => n.trim().toLowerCase()));
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "var(--ff-muted)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Quick add
      </div>
      {/* Chip metrics match the SkillsStep suggestion chips (13px, 7px 12px,
          ff-hit-target 44px zone) — same-purpose tap-to-add controls should
          feel identical. We keep the isAdded state SkillsStep doesn't have. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {COMMON_LANGUAGES.map((lang) => {
          const isAdded = taken.has(lang.toLowerCase());
          return (
            <button
              key={lang}
              type="button"
              className="ff-hit-target"
              onClick={() => {
                if (!isAdded) onAdd(lang);
              }}
              disabled={isAdded}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                padding: "7px 12px",
                borderRadius: 999,
                border: isAdded
                  ? "1px solid var(--ff-accent-soft)"
                  : "1px solid var(--ff-line)",
                background: isAdded ? "var(--ff-accent-soft)" : "var(--ff-card)",
                color: isAdded ? "var(--ff-accent-dark)" : "var(--ff-ink)",
                cursor: isAdded ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "border-color 120ms, background 120ms",
                opacity: isAdded ? 0.75 : 1,
              }}
            >
              {isAdded ? (
                <Icon name="check" size={11} />
              ) : (
                <Icon name="plus" size={11} />
              )}
              {lang}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ── Custom proficiency dropdown ── */

const LevelDropdown = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: LanguageLevel) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("click", handleClickOutside, true);
    }
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, [open, handleClickOutside]);

  const selected = LANGUAGE_LEVELS.find((l) => l.value === value);
  // Map legacy values to display labels
  const displayLabel =
    selected?.label ??
    (value === "beginner"
      ? "Elementary"
      : value === "intermediate"
        ? "Conversational"
        : value === "advanced"
          ? "Professional Working"
          : "");

  return (
    <div ref={ref} className="relative">
      {/* .cv-input keeps the trigger pixel-identical to the sibling Language
          input (padding, font, border, hover/focus) — now and if the shared
          class ever changes. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cv-input flex items-center justify-between text-left cursor-pointer"
      >
        <span className={displayLabel ? "text-[var(--ff-ink)]" : "text-[var(--ff-faint)]"}>
          {displayLabel || "Select proficiency level"}
        </span>
        <svg
          className={`h-4 w-4 text-[var(--ff-faint)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-[var(--ff-line)] bg-white shadow-lg overflow-hidden">
          {LANGUAGE_LEVELS.map((level) => {
            const isSelected = level.value === value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => {
                  onChange(level.value);
                  setOpen(false);
                }}
                className={`w-full px-4 py-3 text-left cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? "bg-[var(--ff-accent-soft)] text-[var(--ff-accent-dark)]"
                    : "hover:bg-[var(--ff-accent-soft)]"
                }`}
              >
                <div>
                  <p
                    className={`text-sm ${
                      isSelected ? "font-semibold text-[var(--ff-accent-dark)]" : "font-medium text-gray-800"
                    }`}
                  >
                    {level.label}
                  </p>
                  <p className="text-xs text-gray-400">{level.description}</p>
                </div>
                {isSelected && (
                  <span className="text-[var(--ff-accent)] text-sm font-bold ml-2 shrink-0">
                    {"\u2713"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Languages step ── */

export const LanguagesStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) => {
  const languages = useCvStore((state) => state.data.languages);
  const updateSection = useCvStore((state) => state.updateSection);
  const pushToast = useUiStore((s) => s.pushToast);
  const lastSerializedRef = useRef<string>(JSON.stringify(languages));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    reset,
    setValue,
    formState: { isDirty, errors },
  } = useForm<LanguagesForm>({
    resolver: zodResolver(languagesSchema),
    defaultValues: { languages },
  });

  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: "languages",
  });

  // Deletion with undo (replaces a confirm dialog): capture the row BEFORE
  // remove, then offer to re-insert it at its original position. The
  // debounced watch subscription persists both the removal and the restore.
  const handleRemoveLanguage = (index: number) => {
    const removed = getValues(`languages.${index}`);
    remove(index);
    if (!removed) return;
    pushToast("Language removed", {
      actionLabel: "Undo",
      onAction: () => insert(index, removed),
    });
  };

  useEffect(() => {
    if (!isDirty) reset({ languages });
  }, [languages, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(languages);
  }, [languages]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.languages) {
        const next = (value.languages ?? []).filter(
          (language): language is CvLanguage => Boolean(language && language.id),
        );
        const nextSerialized = JSON.stringify(next);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("languages", next);
          }
        }, 250);
      }
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  return (
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="languages" />
      <section className="cv-step-card">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Suggested languages — common in the UAE labour market */}
          <SuggestionChips
            current={fields.map((f) => f.name)}
            onAdd={(name) =>
              append({
                id: crypto.randomUUID(),
                name,
                level: "conversational",
              })
            }
          />

          <button
            type="button"
            onClick={() =>
              append({
                id: crypto.randomUUID(),
                name: "",
                level: "conversational",
              })
            }
            className="cv-btn-ghost"
          >
            <Icon name="plus" size={14} />
            Add language
          </button>

          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <Field
                label="Language"
                error={errors.languages?.[index]?.name?.message}
              >
                <input
                  className="cv-input"
                  placeholder="e.g. Arabic"
                  {...register(`languages.${index}.name`)}
                  onChange={(e) => {
                    e.target.value = sanitizeLanguageNameLive(e.target.value);
                    register(`languages.${index}.name`).onChange(e);
                  }}
                  onBlur={(e) => {
                    e.target.value = sanitizeLanguageName(e.target.value);
                    register(`languages.${index}.name`).onChange(e);
                    register(`languages.${index}.name`).onBlur(e);
                  }}
                />
              </Field>
              <Field label="Level">
                <LevelDropdown
                  value={watch(`languages.${index}.level`) ?? ""}
                  onChange={(val) =>
                    setValue(`languages.${index}.level`, val, { shouldDirty: true })
                  }
                />
              </Field>
              <button
                type="button"
                onClick={() => handleRemoveLanguage(index)}
                className="cv-btn-danger"
                style={{ alignSelf: "center", marginTop: 26 }}
              >
                <Icon name="trash" size={12} />
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Form-level fallback (audit UX-3): Continue used to fail with no
          message at all when a row was invalid. */}
      {errors.languages && (
        <p style={{ fontSize: 12.5, color: "var(--ff-red)", fontWeight: 500 }}>
          Fix the highlighted language entries above, or remove the empty row,
          to continue.
        </p>
      )}
      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
