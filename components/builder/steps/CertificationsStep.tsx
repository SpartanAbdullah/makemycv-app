"use client";

import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { certificationsSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import type { CvCertification } from "../../../lib/types/cv";

const inputClass =
  "cv-input rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

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
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Certifications</h2>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            Optional
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Add recent certifications that support your target role.
        </p>

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() =>
              append({ id: crypto.randomUUID(), name: "", issuer: "", date: "" })
            }
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
          >
            Add certification
          </button>

          {fields.map((field, index) => (
            <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">
                  Certification {index + 1}
                </h4>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-200"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input className={inputClass} placeholder="e.g. PMP - Project Management Professional" {...register(`certifications.${index}.name`)} />
                </Field>
                <Field label="Issuer">
                  <input className={inputClass} placeholder="e.g. PMI" {...register(`certifications.${index}.issuer`)} />
                </Field>
                <Field label="Date">
                  <input className={inputClass} placeholder="e.g. 2024" {...register(`certifications.${index}.date`)} />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
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
