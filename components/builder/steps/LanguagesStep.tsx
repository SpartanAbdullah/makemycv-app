"use client";

import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { languagesSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import type { CvLanguage } from "../../../lib/types/cv";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

type LanguagesForm = { languages: CvLanguage[] };

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
        const nextSerialized = JSON.stringify(value.languages);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("languages", value.languages);
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
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Languages</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Optional
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Add languages and proficiency levels.
        </p>

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() =>
              append({ id: crypto.randomUUID(), name: "", level: "intermediate" })
            }
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
          >
            Add language
          </button>

          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <Field label="Language">
                <input className={inputClass} {...register(`languages.${index}.name`)} />
              </Field>
              <Field label="Level">
                <select className={inputClass} {...register(`languages.${index}.level`)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-xs text-red-500 self-end"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Use standard proficiency labels.
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
