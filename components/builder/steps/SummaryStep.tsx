"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { summarySchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { FieldError } from "../../FieldError";
import { sanitizePlainText, validateSummaryLength } from "../../../lib/sanitize";
import { useAIImprove } from "../../../hooks/useAIImprove";
import { AIResultsModal } from "../../AIResultsModal";
import { Icon } from "../Icon";
import { TodaysTipCard } from "../TodaysTipCard";
import { AiDisclosure } from "../AiDisclosure";
import { summaryStartersFor } from "../../../lib/data/summaryStarters";
import { ROLE_FAMILY_LABELS } from "../../../lib/data/roleFamily";

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
  const domain = useCvStore((state) => state.data.settings.domain);
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
  const fireAISummary = () => {
    const store = useCvStore.getState().data;
    setAiModalOpen(true);
    aiClear();
    improve({
      type: "summary",
      domain: store.settings.domain,
      headline: store.personal.headline,
      experienceRoles: store.experience.map((r) => ({
        title: r.role,
        company: r.company,
        bullets: r.bullets.filter(Boolean),
      })),
      existingSummary: store.personal.summary,
    });
  };

  const handleApplySummary = (selected: string[]) => {
    if (selected[0]) {
      setValue("summary", selected[0], { shouldDirty: true });
    }
    setAiModalOpen(false);
    aiClear();
  };

  // Instant, offline starter — only offered when the box is empty (no clobber).
  const applyStarter = (text: string) => {
    setValue("summary", text, { shouldDirty: true });
    setSummaryWarning(validateSummaryLength(text));
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
      <StepHeader stepId="summary" />

      {/* Full-width textarea on top, tip card stacked below. The previous
          side-by-side layout squeezed the textarea into ~58% of the form
          column at >=900px which felt cramped \u2014 the summary needs room to
          breathe (30-120 words). */}
      <div className="ff-summary-grid">
        <section className="cv-step-card">
          <Field label="Professional summary" error={errors.summary?.message}>
            <textarea
              rows={10}
              className="cv-input cv-textarea"
              style={{ minHeight: 260, lineHeight: 1.6, fontSize: 14.5 }}
              placeholder={"e.g. Operations Manager with 8 years of experience in logistics and procurement in the UAE. I lead teams of 10+, manage vendors, and cut costs. Looking for a senior role in Dubai."}
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
            // Focus Flow tokens (contrast-safe at 12px) \u2014 same ladder and
            // 12px mono treatment as the SkillsStep count helper.
            const countColor =
              wordCount === 0
                ? "var(--ff-muted)"
                : wordCount < 30
                  ? "var(--ff-red)"
                  : wordCount > 120
                    ? "var(--ff-warn)"
                    : "var(--ff-accent-dark)";
            return (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: countColor,
                }}
              >
                {wordCount} words {"\u00B7"} Recommended: 30{"\u2013"}120
              </p>
            );
          })()}
          <FieldError message={summaryWarning} type="warning" />

          {/* Instant starter summaries — domain-tailored, no AI, no quota.
              Shown only while the box is empty so we never overwrite work. */}
          {!(watch("summary") ?? "").trim() && (() => {
            const starters = summaryStartersFor(domain);
            if (starters.length === 0) return null;
            return (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ff-muted)",
                    marginBottom: 8,
                  }}
                >
                  {domain
                    ? `Starter summaries for ${ROLE_FAMILY_LABELS[domain]}`
                    : "Starter summaries"}{" "}
                  · tap to use
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {starters.map((text, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyStarter(text)}
                      className="ff-hit-target"
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "var(--ff-card)",
                        border: "1px dashed var(--ff-line-strong)",
                        color: "var(--ff-ink-2)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        fontFamily: "var(--font-body)",
                        cursor: "pointer",
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="mt-4 flex flex-col items-end">
            {/* Same accent-outline identity as every other AI-generate CTA
                (Experience top/per-role, Skills) — was a shrunken secondary. */}
            <button
              type="button"
              onClick={fireAISummary}
              className="cv-btn-accent-outline"
            >
              <Icon name="sparkle" size={13} />
              Write my summary with AI
            </button>
            <AiDisclosure />
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
        /* Stacked at every viewport — textarea up top with full column
           width, tip card below. (Was a 1.4fr | 1fr side-by-side at
           >=900px which squeezed the textarea.) */
        .ff-summary-grid {
          display: flex;
          flex-direction: column;
          gap: 18px;
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
