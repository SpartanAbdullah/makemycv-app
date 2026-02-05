"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { NavigationButtons } from "../NavigationButtons";
import type { CvPersonal } from "../../../lib/types/cv";

const inputClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

export const PersonalStep = ({
  onNext,
}: {
  onNext: () => void;
}) => {
  const personal = useCvStore((state) => state.data.personal);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(personal));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<CvPersonal>({
    resolver: zodResolver(personalSchema),
    defaultValues: personal,
  });

  useEffect(() => {
    if (!isDirty) reset(personal);
  }, [personal, reset, isDirty]);

  useEffect(() => {
    lastSerializedRef.current = JSON.stringify(personal);
  }, [personal]);

  useEffect(() => {
    const subscription = watch((value) => {
      const nextSerialized = JSON.stringify(value);
      if (nextSerialized === lastSerializedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (nextSerialized !== lastSerializedRef.current) {
          lastSerializedRef.current = nextSerialized;
          updateSection("personal", value as CvPersonal);
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
          <h2 className="font-display text-2xl">Personal Info</h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
            Required
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Let's start with the basics that power the header of your CV.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            <input className={inputClass} {...register("firstName")} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <input className={inputClass} {...register("lastName")} />
          </Field>
          <Field label="Headline" hint="Example: Product Designer" error={errors.headline?.message}>
            <input className={inputClass} {...register("headline")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input className={inputClass} type="email" {...register("email")} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} {...register("phone")} />
          </Field>
          <Field label="Location">
            <input className={inputClass} {...register("location")} />
          </Field>
          <Field label="Website">
            <input className={inputClass} {...register("website")} />
          </Field>
          <Field label="LinkedIn">
            <input className={inputClass} {...register("linkedin")} />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          ATS tip: Match the contact details you use on job applications.
        </div>
      </section>

      <NavigationButtons onNext={handleSubmit(onNext)} nextLabel="Continue" />
    </form>
  );
};

