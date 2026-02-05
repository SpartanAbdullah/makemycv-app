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
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

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
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(certifications));
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
    defaultValues: { certifications },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "certifications",
  });

  useEffect(() => {
    if (!isDirty) reset({ certifications });
  }, [certifications, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(certifications);
  }, [certifications]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.certifications) {
        const nextSerialized = JSON.stringify(value.certifications);
        if (nextSerialized === lastSerializedRef.current) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (nextSerialized !== lastSerializedRef.current) {
            lastSerializedRef.current = nextSerialized;
            updateSection("certifications", value.certifications);
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
          <h2 className="font-display text-2xl">Certifications</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
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
                  className="text-xs text-red-500"
                >
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input className={inputClass} {...register(`certifications.${index}.name`)} />
                </Field>
                <Field label="Issuer">
                  <input className={inputClass} {...register(`certifications.${index}.issuer`)} />
                </Field>
                <Field label="Date">
                  <input className={inputClass} {...register(`certifications.${index}.date`)} />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Prioritize certs earned within the last 3-5 years.
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
