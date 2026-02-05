"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { summarySchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

type SummaryForm = { summary: string };

export const SummaryStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) => {
  const summary = useCvStore((state) => state.data.personal.summary);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(
    JSON.stringify({ ...useCvStore.getState().data.personal, summary })
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<SummaryForm>({
    resolver: zodResolver(summarySchema),
    defaultValues: { summary },
  });

  useEffect(() => {
    if (!isDirty) reset({ summary });
  }, [summary, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify({
      ...useCvStore.getState().data.personal,
      summary,
    });
  }, [summary]);

  useEffect(() => {
    const subscription = watch((value) => {
      const nextPersonal = {
        ...useCvStore.getState().data.personal,
        summary: value.summary || "",
      };
      const nextSerialized = JSON.stringify(nextPersonal);
      if (nextSerialized === lastSerializedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (nextSerialized !== lastSerializedRef.current) {
          lastSerializedRef.current = nextSerialized;
          updateSection("personal", nextPersonal);
        }
      }, 250);
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
          <h2 className="font-display text-2xl">Professional Summary</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Optional
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Share a quick intro that highlights your strengths and goals.
        </p>

        <div className="mt-6">
          <Field label="Summary" error={errors.summary?.message}>
            <textarea
              rows={6}
              className={inputClass}
              placeholder="Example: Product designer with 5+ years in fintech..."
              {...register("summary")}
            />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Aim for 2-3 short sentences and include relevant keywords.
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
