"use client";

import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { certificationsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { UAEDot } from "../UAEDot";
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
  const lastSerializedRef = useRef<string>(JSON.stringify(safeCertifications));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { isDirty, errors },
  } = useForm<CertificationsForm>({
    resolver: zodResolver(certificationsSchema),
    defaultValues: { certifications: safeCertifications },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "certifications",
  });

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

  return (
    <form
      onSubmit={handleSubmit(onNext)}
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
            onClick={() =>
              append({
                id: crypto.randomUUID(),
                name: "",
                issuer: "",
                date: "",
              })
            }
            className="cv-btn-ghost"
          >
            <Icon name="plus" size={14} />
            Add certification
          </button>

          {fields.map((field, index) => (
            <div key={field.id} className="cv-entry-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>
                  Certification {index + 1}
                </h4>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="cv-btn-danger"
                >
                  <Icon name="trash" size={12} />
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                  <input className="cv-input" placeholder="e.g. PMI" {...register(`certifications.${index}.issuer`)} />
                </Field>
                <Field label="Date">
                  <input className="cv-input" placeholder="e.g. 2024" {...register(`certifications.${index}.date`)} />
                </Field>
              </div>
            </div>
          ))}
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
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />
    </form>
  );
};
