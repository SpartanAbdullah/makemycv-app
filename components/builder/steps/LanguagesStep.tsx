"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { languagesSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { LANGUAGE_LEVELS } from "../../../lib/language";
import { sanitizeLanguageName } from "../../../lib/sanitize";
import { UAEDot } from "../UAEDot";
import { Icon } from "../Icon";
import type { CvLanguage, LanguageLevel } from "../../../lib/types/cv";

type LanguagesForm = { languages: CvLanguage[] };

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-left flex justify-between items-center hover:border-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white transition"
      >
        <span className={displayLabel ? "text-gray-800" : "text-gray-400"}>
          {displayLabel || "Select proficiency level"}
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
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
                    ? "bg-indigo-50 text-indigo-700"
                    : "hover:bg-indigo-50"
                }`}
              >
                <div>
                  <p
                    className={`text-sm ${
                      isSelected ? "font-semibold text-indigo-700" : "font-medium text-gray-800"
                    }`}
                  >
                    {level.label}
                  </p>
                  <p className="text-xs text-gray-400">{level.description}</p>
                </div>
                {isSelected && (
                  <span className="text-indigo-600 text-sm font-bold ml-2 shrink-0">
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
  const lastSerializedRef = useRef<string>(JSON.stringify(languages));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { isDirty },
  } = useForm<LanguagesForm>({
    resolver: zodResolver(languagesSchema),
    defaultValues: { languages },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "languages",
  });

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
      <div className="cv-step-badge">
        <UAEDot size={13} />
        STEP 06 · LANGUAGES
      </div>
      <div>
        <h1 className="cv-step-heading" style={{ fontSize: 34, marginTop: 8 }}>
          Which languages do you speak?
        </h1>
        <p className="cv-step-subtitle">
          Arabic and English are reliably searched. Use clear labels — Native,
          Fluent, Professional — not numeric bands.
        </p>
      </div>

      <section className="cv-step-card">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              <Field label="Language">
                <input
                  className="cv-input"
                  placeholder="e.g. Arabic"
                  {...register(`languages.${index}.name`)}
                  onChange={(e) => {
                    e.target.value = sanitizeLanguageName(e.target.value);
                    register(`languages.${index}.name`).onChange(e);
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
                onClick={() => remove(index)}
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

      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
