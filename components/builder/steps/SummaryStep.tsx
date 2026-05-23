"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { summarySchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { FieldError } from "../../FieldError";
import { sanitizePlainText, validateSummaryLength } from "../../../lib/sanitize";
import { useAIImprove, hasUsedFreeAI } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";
import { Icon } from "../Icon";
import { TodaysTipCard } from "../TodaysTipCard";

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

  const [summaryWarning, setSummaryWarning] = useState<string | null>(null);

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
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >

      <div className="ff-summary-grid">
        <section className="cv-step-card">
          <Field label="Professional summary" error={errors.summary?.message}>
            <textarea
              rows={6}
              className="cv-input cv-textarea"
              placeholder={"e.g. Results-driven Operations Manager with 8+ years of experience in logistics, procurement, and team leadership across the UAE. Skilled in ERP systems, vendor negotiations, and cost optimisation. Seeking a senior role in Dubai's construction or trading sector."}
              {...register("summary")}
              onBlur={(e) => {
                register("summary").onBlur(e);
                const cleaned = sanitizePlainText(e.target.value);
                if (cleaned !== e.target.value) {
                  setValue("summary", cleaned, { shouldDirty: true });
                }
                setSummaryWarning(validateSummaryLength(cleaned));
              }}
            />
          </Field>
          {(() => {
            const currentSummary = watch("summary") ?? "";
            const wordCount = currentSummary.split(/\s+/).filter(Boolean).length;
            const countColor =
              wordCount === 0
                ? "text-gray-400"
                : wordCount < 30
                  ? "text-red-500"
                  : wordCount > 120
                    ? "text-amber-500"
                    : "text-green-600";
            return (
              <p className={`mt-1 text-xs ${countColor}`}>
                {wordCount} words {"\u00B7"} Recommended: 30{"\u2013"}120
              </p>
            );
          })()}
          <FieldError message={summaryWarning} type="warning" />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={fireAISummary}
              className="cv-btn-secondary"
              style={{ fontSize: 12, padding: "5px 12px" }}
            >
              <Icon name="sparkle" size={13} />
              Write my summary with AI
            </button>
          </div>
        </section>
        <TodaysTipCard stepId="summary" />
      </div>

      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />

      <style>{`
        .ff-summary-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 900px) {
          .ff-summary-grid { grid-template-columns: 1.4fr 1fr; align-items: start; }
        }
      `}</style>

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
