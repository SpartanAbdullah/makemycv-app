"use client";

import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { certificationsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
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
    formState: { isDirty },
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
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <section className="cv-step-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="cv-step-heading">Certifications</h2>
          <span className="cv-badge-optional">Optional</span>
        </div>
        <p className="cv-step-subtitle">
          Add recent certifications that support your target role.
        </p>

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() =>
              append({ id: crypto.randomUUID(), name: "", issuer: "", date: "" })
            }
            className="cv-btn-ghost"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input className="cv-input" placeholder="e.g. PMP - Project Management Professional" {...register(`certifications.${index}.name`)} />
                </Field>
                <Field label="Issuer">
                  <input className="cv-input" placeholder="e.g. PMI" {...register(`certifications.${index}.issuer`)} />
                </Field>
                <Field label="Date">
                  <input className="cv-input" placeholder="e.g. 2024" {...register(`certifications.${index}.date`)} />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="cv-tip-box" style={{ marginTop: 16 }}>
          ATS tip: Prioritize certs earned within the last 3-5 years. UAE employers value PMP, NEBOSH, CFA, CPA, and CIPD certifications.
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
