"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { summarySchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";

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
      <section className="cv-step-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="cv-step-heading">Tell Us About Yourself</h2>
          <span className="cv-badge-optional">Optional</span>
        </div>
        <p className="cv-step-subtitle">
          Write a short professional summary that highlights your strengths and career goals. This appears at the top of your CV.
        </p>

        <div className="mt-6">
          <Field label="Summary" error={errors.summary?.message}>
            <textarea
              rows={6}
              className="cv-input cv-textarea"
              placeholder={"e.g. Results-driven Operations Manager with 8+ years of experience in logistics, procurement, and team leadership across the UAE. Skilled in ERP systems, vendor negotiations, and cost optimisation. Seeking a senior role in Dubai's construction or trading sector."}
              {...register("summary")}
            />
          </Field>
        </div>

        <div className="cv-tip-box" style={{ marginTop: 16 }}>
          ATS tip: Aim for 2-3 short sentences. Include keywords from the job description — recruiters in the UAE often use automated screening.
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
