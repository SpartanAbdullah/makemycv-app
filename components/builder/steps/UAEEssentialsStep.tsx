"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useCvStore } from "../../../lib/store/cvStore";
import { Field } from "../../forms/Field";
import { FieldError } from "../../FieldError";
import { NavigationButtons } from "../NavigationButtons";
import { StepHeader } from "../StepHeader";
import { UAEDot } from "../UAEDot";
import { Icon } from "../Icon";
import {
  sanitizeLocation,
  sanitizeLocationLive,
  sanitizeName,
  sanitizeNameLive,
  sanitizeURL,
  validateLinkedIn,
  validateURL,
} from "../../../lib/sanitize";
import type { CvPersonal } from "../../../lib/types/cv";

const ICON_INPUT_PAD = 40;

/**
 * UAEEssentialsStep — UAE-recruiter signals (visa, availability, driving
 * licence) plus optional extras (LinkedIn, Website, Nationality, Country,
 * Date of birth). Sits between Contact and Summary in the builder flow.
 *
 * Shares the `personal` store slice with PersonalStep (only one step is
 * mounted at a time so there's no write race). Deliberately has NO zod
 * resolver: every field on this screen is optional, and binding the full
 * personalSchema meant an invalid firstName/email — fields that are not
 * even on this screen — silently killed the Continue button (audit UX-3).
 */
export const UAEEssentialsStep = ({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) => {
  const personal = useCvStore((state) => state.data.personal);
  const updateSection = useCvStore((state) => state.updateSection);
  const lastSerializedRef = useRef<string>(JSON.stringify(personal));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string | null>
  >({});

  const setFieldError = (field: string, error: string | null) =>
    setFieldErrors((prev) => ({ ...prev, [field]: error }));

  // Local "has content" tint (B7) for the two fields whose <Field> wraps
  // TWO children (input + FieldError) — the Field-level default tint only
  // reaches single-child fields. Same contract: seed from the stored
  // value, update on blur, border-only via .cv-input-filled. A URL
  // warning suppresses the tint (explicit feedback always wins).
  const [extrasFilled, setExtrasFilled] = useState(() => ({
    linkedin: (personal.linkedin ?? "").trim() !== "",
    website: (personal.website ?? "").trim() !== "",
  }));

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { isDirty },
  } = useForm<CvPersonal>({
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
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader stepId="uaeEssentials" />

      {/* UAE Essentials block */}
      <section
        style={{
          padding: 22,
          background: "var(--ff-accent-soft)",
          border: "1px solid rgba(14,124,74,0.30)",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <UAEDot size={13} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ff-accent-dark)",
            }}
          >
            UAE essentials
          </span>
          {/* No invented point values here — the engine doesn't score these
              fields directly (same class of claim as the removed "+4 pts"). */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ff-accent)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              marginLeft: "auto",
              textTransform: "uppercase",
            }}
          >
            Recruiter signal
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
          className="ff-uae-grid"
        >
          <Field label="Visa status">
            <select className="cv-select" {...register("visaStatus")}>
              <option value="">Select status…</option>
              <option value="UAE National">UAE National</option>
              <option value="GCC National">GCC National</option>
              <option value="Family sponsorship">Family sponsorship</option>
              <option value="Employment visa">Employment visa</option>
              <option value="Golden Visa">Golden Visa</option>
              <option value="Green Visa">Green Visa</option>
              <option value="Freelance permit">Freelance permit</option>
              <option value="Investor visa">Investor visa</option>
              <option value="Visit visa">Visit visa</option>
              <option value="Cancelled / transferable">
                Cancelled / transferable
              </option>
            </select>
          </Field>
          <Field label="Availability / notice period">
            <select className="cv-select" {...register("availability")}>
              <option value="">Select availability…</option>
              <option value="Immediate">Immediate</option>
              <option value="2 weeks notice">2 weeks notice</option>
              <option value="30 days notice">30 days notice</option>
              <option value="60 days notice">60 days notice</option>
              <option value="90 days notice">90 days notice</option>
            </select>
          </Field>
          <Field label="UAE driving licence">
            <select className="cv-select" {...register("drivingLicense")}>
              <option value="">Select…</option>
              <option value="Light Vehicle">Light Vehicle</option>
              <option value="Heavy Vehicle">Heavy Vehicle</option>
              <option value="Motorcycle">Motorcycle</option>
              <option value="International licence">
                International licence
              </option>
              <option value="None">None</option>
            </select>
          </Field>
          {/* Promoted from "Extras" (audit UX-9): nationality is a hard
              pre-screen field in most UAE postings — it belongs with the
              recruiter signals and counts toward step completion. */}
          <Field label="Nationality">
            <input
              className="cv-input"
              placeholder="e.g. Emirati, Pakistani, Indian"
              spellCheck={false}
              {...register("nationality")}
              onChange={(e) => {
                e.target.value = sanitizeNameLive(e.target.value);
                register("nationality").onChange(e);
              }}
              onBlur={(e) => {
                e.target.value = sanitizeName(e.target.value);
                register("nationality").onChange(e);
                register("nationality").onBlur(e);
              }}
            />
          </Field>
        </div>
      </section>

      {/* Extras */}
      <section
        style={{
          padding: 22,
          background: "var(--ff-card)",
          border: "1px solid var(--ff-line)",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <Icon name="plus" size={13} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ff-ink)",
            }}
          >
            Extras
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ff-muted)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              marginLeft: "auto",
              textTransform: "uppercase",
            }}
          >
            Optional
          </span>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ff-muted)",
            marginBottom: 14,
            lineHeight: 1.55,
          }}
        >
          Online presence and a few personal details. Skip any that don&apos;t
          apply.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
          className="ff-core-fields"
        >
          <Field label="LinkedIn" optional leftIcon="linkedin">
            <input
              className={
                extrasFilled.linkedin ? "cv-input cv-input-filled" : "cv-input"
              }
              placeholder="linkedin.com/in/yourname"
              type="url"
              inputMode="url"
              autoComplete="url"
              style={{ paddingLeft: ICON_INPUT_PAD }}
              {...register("linkedin")}
              onBlur={(e) => {
                register("linkedin").onBlur(e);
                const url = sanitizeURL(e.target.value);
                if (url !== e.target.value)
                  setValue("linkedin", url, { shouldDirty: true });
                const warning = validateLinkedIn(url);
                setFieldError("linkedin", warning);
                setExtrasFilled((prev) => ({
                  ...prev,
                  linkedin: !warning && url.trim() !== "",
                }));
              }}
            />
            <FieldError
              message={fieldErrors.linkedin ?? null}
              type="warning"
            />
          </Field>
          <Field label="Website" optional leftIcon="globe">
            <input
              className={
                extrasFilled.website ? "cv-input cv-input-filled" : "cv-input"
              }
              placeholder="www.yourportfolio.com"
              type="url"
              inputMode="url"
              autoComplete="url"
              style={{ paddingLeft: ICON_INPUT_PAD }}
              {...register("website")}
              onBlur={(e) => {
                register("website").onBlur(e);
                const url = sanitizeURL(e.target.value);
                if (url !== e.target.value)
                  setValue("website", url, { shouldDirty: true });
                const warning = validateURL(url);
                setFieldError("website", warning);
                setExtrasFilled((prev) => ({
                  ...prev,
                  website: !warning && url.trim() !== "",
                }));
              }}
            />
            <FieldError
              message={fieldErrors.website ?? null}
              type="warning"
            />
          </Field>
          <Field label="Country" optional>
            <input
              className="cv-input"
              placeholder="e.g. United Arab Emirates"
              autoComplete="country-name"
              spellCheck={false}
              {...register("country")}
              onChange={(e) => {
                e.target.value = sanitizeLocationLive(e.target.value);
                register("country").onChange(e);
              }}
              onBlur={(e) => {
                e.target.value = sanitizeLocation(e.target.value);
                register("country").onChange(e);
                register("country").onBlur(e);
              }}
            />
          </Field>
          <Field label="Date of birth" optional>
            <input
              className="cv-input"
              placeholder="e.g. 15/03/1990"
              autoComplete="bday"
              {...register("dateOfBirth")}
            />
          </Field>
        </div>
      </section>

      <NavigationButtons
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        showSkip
        onSkip={onSkip}
      />

      <style>{`
        @media (max-width: 900px) {
          .ff-core-fields { grid-template-columns: 1fr !important; }
          .ff-uae-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
};
