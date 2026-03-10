"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { NavigationButtons } from "../NavigationButtons";
import { PhotoUpload } from "../PhotoUpload";
import type { CvPersonal } from "../../../lib/types/cv";

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

  const handlePhotoChange = (base64: string | undefined) => {
    const current = useCvStore.getState().data.personal;
    updateSection("personal", { ...current, photo: base64 } as CvPersonal);
  };

  const handleToggleChange = (show: boolean) => {
    const current = useCvStore.getState().data.personal;
    updateSection("personal", { ...current, showPhoto: show } as CvPersonal);
  };

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
        <h1 className="cv-step-heading">
          Please enter your{" "}
          <span className="accent">contact</span> info
        </h1>
        <p className="cv-step-subtitle">
          Add your phone number and email so recruiters can reach you.
        </p>
      </div>

      {/* Photo upload */}
      <div style={{ paddingBottom: 24, borderBottom: "1px solid var(--border-soft)", marginBottom: 8 }}>
        <PhotoUpload
          photo={personal.photo}
          showPhoto={personal.showPhoto}
          onPhotoChange={handlePhotoChange}
          onToggleChange={handleToggleChange}
        />
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="cv-label">FIRST NAME (MANDATORY)</label>
          <input
            className="cv-input"
            placeholder="e.g. Muhammad"
            {...register("firstName")}
          />
          {errors.firstName?.message && (
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--status-error)" }}>{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label className="cv-label">LAST NAME (MANDATORY)</label>
          <input
            className="cv-input"
            placeholder="e.g. Al-Rashidi"
            {...register("lastName")}
          />
          {errors.lastName?.message && (
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--status-error)" }}>{errors.lastName.message}</p>
          )}
        </div>

        <div>
          <label className="cv-label">CITY</label>
          <input
            className="cv-input"
            placeholder="e.g. Dubai, UAE"
            {...register("location")}
          />
        </div>

        <div>
          <label className="cv-label">HEADLINE / JOB TITLE</label>
          <input
            className="cv-input"
            placeholder="e.g. Senior Operations Manager"
            {...register("headline")}
          />
          {errors.headline?.message && (
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--status-error)" }}>{errors.headline.message}</p>
          )}
        </div>

        <div>
          <label className="cv-label">PHONE (MANDATORY)</label>
          <input
            className="cv-input"
            placeholder="+971 50 123 4567"
            {...register("phone")}
          />
        </div>

        <div>
          <label className="cv-label">EMAIL (MANDATORY)</label>
          <input
            className="cv-input"
            type="email"
            placeholder="yourname@email.com"
            {...register("email")}
          />
          {errors.email?.message && (
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--status-error)" }}>{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Add more details */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--brand-primary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "color var(--transition-fast)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transition: "transform var(--transition-fast)",
              transform: showMore ? "rotate(45deg)" : "none",
            }}
          >
            +
          </span>
          {showMore ? "Hide extra details" : "Add more details"}
        </button>

        {showMore && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="cv-label">LINKEDIN</label>
              <input
                className="cv-input"
                placeholder="linkedin.com/in/yourname"
                {...register("linkedin")}
              />
            </div>
            <div>
              <label className="cv-label">WEBSITE</label>
              <input
                className="cv-input"
                placeholder="www.yourportfolio.com"
                {...register("website")}
              />
            </div>
            <div>
              <label className="cv-label">NATIONALITY</label>
              <input
                className="cv-input"
                placeholder="e.g. Emirati, Pakistani, Indian"
                {...register("nationality")}
              />
            </div>
            <div>
              <label className="cv-label">COUNTRY</label>
              <input
                className="cv-input"
                placeholder="e.g. United Arab Emirates"
                {...register("country")}
              />
            </div>
            <div>
              <label className="cv-label">DATE OF BIRTH</label>
              <input
                className="cv-input"
                placeholder="e.g. 15/03/1990"
                {...register("dateOfBirth")}
              />
            </div>
            <div>
              <label className="cv-label">DRIVING LICENSE</label>
              <input
                className="cv-input"
                placeholder="e.g. UAE Light Vehicle License"
                {...register("drivingLicense")}
              />
            </div>
          </div>
        )}
      </div>

      {/* ATS tip */}
      <div className="cv-tip-box">
        ATS tip: Match the contact details you use on job applications.
      </div>

      {/* Navigation */}
      <NavigationButtons
        onNext={handleSubmit(onNext)}
      />
    </form>
  );
};
