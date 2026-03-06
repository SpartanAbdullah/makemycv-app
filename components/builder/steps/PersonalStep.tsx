"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { NavigationButtons } from "../NavigationButtons";
import type { CvPersonal } from "../../../lib/types/cv";

const inputClass =
  "cv-input w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all";

const labelClass =
  "block mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500";

export const PersonalStep = ({
  onNext,
}: {
  onNext: () => void;
}) => {
  const personal = useCvStore((state) => state.data.personal);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(personal));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMore, setShowMore] = useState(false);

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
      {/* Heading */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Please enter your{" "}
          <span className="text-[#2563eb]">contact</span> info
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Add your phone number and email so recruiters can reach you.
        </p>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>FIRST NAME (MANDATORY)</label>
          <input
            className={inputClass}
            placeholder="e.g. Muhammad"
            {...register("firstName")}
          />
          {errors.firstName?.message && (
            <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>LAST NAME (MANDATORY)</label>
          <input
            className={inputClass}
            placeholder="e.g. Abdullah"
            {...register("lastName")}
          />
          {errors.lastName?.message && (
            <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>CITY</label>
          <input
            className={inputClass}
            placeholder="e.g. Dubai"
            {...register("location")}
          />
        </div>

        <div>
          <label className={labelClass}>HEADLINE / JOB TITLE</label>
          <input
            className={inputClass}
            placeholder="e.g. Project Manager"
            {...register("headline")}
          />
          {errors.headline?.message && (
            <p className="mt-1 text-xs text-red-500">{errors.headline.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>PHONE (MANDATORY)</label>
          <input
            className={inputClass}
            placeholder="+971 50 000 0000"
            {...register("phone")}
          />
        </div>

        <div>
          <label className={labelClass}>EMAIL (MANDATORY)</label>
          <input
            className={inputClass}
            type="email"
            placeholder="your@email.com"
            {...register("email")}
          />
          {errors.email?.message && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Add more details */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#2563eb] hover:text-blue-700 transition-colors"
        >
          <span
            className={`inline-block transition-transform ${
              showMore ? "rotate-45" : ""
            }`}
          >
            +
          </span>
          {showMore ? "Hide extra details" : "Add more details"}
        </button>

        {showMore && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>LINKEDIN</label>
              <input
                className={inputClass}
                placeholder="linkedin.com/in/yourname"
                {...register("linkedin")}
              />
            </div>
            <div>
              <label className={labelClass}>WEBSITE</label>
              <input
                className={inputClass}
                placeholder="yourwebsite.com"
                {...register("website")}
              />
            </div>
            <div>
              <label className={labelClass}>NATIONALITY</label>
              <input
                className={inputClass}
                placeholder="e.g. Emirati, Pakistani"
                {...register("nationality")}
              />
            </div>
            <div>
              <label className={labelClass}>COUNTRY</label>
              <input
                className={inputClass}
                placeholder="e.g. United Arab Emirates"
                {...register("country")}
              />
            </div>
            <div>
              <label className={labelClass}>DATE OF BIRTH</label>
              <input
                className={inputClass}
                placeholder="DD/MM/YYYY"
                {...register("dateOfBirth")}
              />
            </div>
            <div>
              <label className={labelClass}>DRIVING LICENSE</label>
              <input
                className={inputClass}
                placeholder="e.g. UAE Light Vehicle"
                {...register("drivingLicense")}
              />
            </div>
          </div>
        )}
      </div>

      {/* ATS tip */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
        ATS tip: Match the contact details you use on job applications.
      </div>

      {/* Navigation */}
      <NavigationButtons
        onNext={handleSubmit(onNext)}
        nextLabel="Next to Experience &rarr;"
      />
    </form>
  );
};
