"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { summarySchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { useAIImprove, hasUsedFreeAI } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";

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
    setValue,
    formState: { errors, isDirty },
  } = useForm<SummaryForm>({
    resolver: zodResolver(summarySchema),
    defaultValues: { summary },
  });

  /* AI summary writer */
  const { improve, results: aiResults, isLoading: aiLoading, error: aiError, clearResults: aiClear } = useAIImprove();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const aiTriggerChecked = useRef(false);

  const fireAISummary = () => {
    const store = useCvStore.getState().data;
    setAiModalOpen(true);
    aiClear();
    improve({
      type: "summary",
      headline: store.personal.headline,
      experienceRoles: store.experience.map((r) => ({
        title: r.role,
        company: r.company,
        bullets: r.bullets.filter(Boolean),
      })),
      existingSummary: store.personal.summary,
    });
  };

  useEffect(() => {
    if (aiTriggerChecked.current) return;
    aiTriggerChecked.current = true;
    try {
      const trigger = sessionStorage.getItem("makemycv_ai_trigger");
      if (trigger === "summary") {
        sessionStorage.removeItem("makemycv_ai_trigger");
        if (!hasUsedFreeAI("summary")) fireAISummary();
      }
    } catch { /* SSR guard */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplySummary = (selected: string[]) => {
    if (selected[0]) {
      setValue("summary", selected[0], { shouldDirty: true });
    }
    setAiModalOpen(false);
    aiClear();
  };

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
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={fireAISummary}
              className="cv-btn-secondary"
              style={{ fontSize: 12, padding: "5px 12px" }}
            >
              {"\u2728"} Write My Summary with AI
            </button>
          </div>
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

      <AIResultsModal
        isOpen={aiModalOpen}
        onClose={() => { setAiModalOpen(false); aiClear(); }}
        type="summary"
        results={aiResults}
        isLoading={aiLoading}
        error={aiError}
        onApply={handleApplySummary}
        onRetry={fireAISummary}
      />
    </form>
  );
};
