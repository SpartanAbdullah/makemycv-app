"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { certificationsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { useUiStore } from "../../../lib/store/uiStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { Icon } from "../Icon";
import type { CvCertification } from "../../../lib/types/cv";

type CertificationsForm = { certifications: CvCertification[] };

export const CertificationsStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) => {
  const certifications = useCvStore((state) => state.data.certifications);
  const safeCertifications = certifications ?? [];
  const updateSection = useCvStore((state) => state.updateSection);
  const pushToast = useUiStore((s) => s.pushToast);
  const lastSerializedRef = useRef<string>(JSON.stringify(safeCertifications));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    reset,
    formState: { isDirty, errors },
  } = useForm<CertificationsForm>({
    resolver: zodResolver(certificationsSchema),
    defaultValues: { certifications: safeCertifications },
  });

  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: "certifications",
  });

  // First card opens by default — matching EducationStep's collapse pattern.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    if (!isDirty) reset({ certifications: safeCertifications });
  }, [safeCertifications, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(safeCertifications);
  }, [safeCertifications]);

  useEffect(() => {
    const subscription = watch((value) => {
      const next = (value.certifications ?? []).filter(
        (item): item is CvCertification => Boolean(item),
      );
      const nextSerialized = JSON.stringify(next);
      if (nextSerialized === lastSerializedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (nextSerialized !== lastSerializedRef.current) {
          lastSerializedRef.current = nextSerialized;
          updateSection("certifications", next);
        }
      }, 250);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [watch, updateSection]);

  const handleAddEntry = () => {
    append({
      id: crypto.randomUUID(),
      name: "",
      issuer: "",
      date: "",
    });
    setOpenIndex(fields.length);
  };

  // Deletion with undo (replaces a confirm dialog): capture the entry BEFORE
  // remove, then offer to re-insert it at its original position. The
  // debounced watch subscription persists both the removal and the restore.
  const handleRemoveEntry = (index: number) => {
    const removed = getValues(`certifications.${index}`);
    remove(index);
    if (!removed) return;
    pushToast("Certification removed", {
      actionLabel: "Undo",
      onAction: () => {
        insert(index, removed);
        setOpenIndex(index);
      },
    });
  };

  // On failed submit, open the first card that has a validation error so the
  // inline messages are actually reachable inside the collapsed list.
  const onInvalid = (formErrors: FieldErrors<CertificationsForm>) => {
    const entryErrors = formErrors.certifications;
    if (!entryErrors) return;
    const firstErrorIndex = Object.keys(entryErrors)
      .map(Number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b)[0];
    if (firstErrorIndex !== undefined) setOpenIndex(firstErrorIndex);
  };

  return (
    <form
      onSubmit={handleSubmit(onNext, onInvalid)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="certifications" />
      <section className="cv-step-card">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Empty-state value framing (audit UX-20) — helps users decide
              whether this optional step is worth their time. */}
          {fields.length === 0 && (
            <p
              style={{
                padding: "8px 0",
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--ff-muted)",
              }}
            >
              In the UAE, certifications like PMP, NEBOSH, CFA, CIPD and
              DHA/DOH carry real weight with recruiters. Add yours — or skip
              this step if you have none.
            </p>
          )}
          <button
            type="button"
            onClick={handleAddEntry}
            className="cv-btn-ghost"
          >
            <Icon name="plus" size={14} />
            Add certification
          </button>

          {fields.map((field, index) => {
            const isOpen = openIndex === index;
            const name = watch(`certifications.${index}.name`) || "";
            const issuer = watch(`certifications.${index}.issuer`) || "";
            const date = watch(`certifications.${index}.date`) || "";
            const summaryLine = [name, issuer, date].filter(Boolean).join(" | ");

            return (
              <div key={field.id} className="cv-entry-card">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="truncate">
                    {summaryLine || `Certification ${index + 1}`}
                  </span>
                  <svg
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    style={{ color: "var(--text-faint)" }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border-soft)", padding: 20 }}>
                    <div className="flex items-center justify-end" style={{ gap: 6 }}>
                      {/* No fields.length > 1 guard on purpose — certifications
                          is optional, so removing the last entry is legitimate. */}
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(index)}
                        className="cv-btn-danger"
                      >
                        <Icon name="trash" size={12} />
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 grid gap-4 md:grid-cols-2">
                      <Field
                        label="Name"
                        error={errors.certifications?.[index]?.name?.message}
                      >
                        <input className="cv-input" placeholder="e.g. PMP - Project Management Professional" {...register(`certifications.${index}.name`)} />
                      </Field>
                      <Field
                        label="Issuer"
                        error={errors.certifications?.[index]?.issuer?.message}
                      >
                        <input className="cv-input" placeholder="e.g. PMI" autoComplete="organization" spellCheck={false} {...register(`certifications.${index}.issuer`)} />
                      </Field>
                      <Field label="Date">
                        <input className="cv-input" placeholder="e.g. 2024" {...register(`certifications.${index}.date`)} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Form-level fallback (audit UX-3): Continue used to fail with no
          message at all — e.g. a certification with a name but no issuer. */}
      {errors.certifications && (
        <p style={{ fontSize: 12.5, color: "var(--ff-red)", fontWeight: 500 }}>
          Fix the highlighted certification fields above, or remove the empty
          entry, to continue.
        </p>
      )}
      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext, onInvalid)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
