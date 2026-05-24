"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalSchema } from "../../../lib/schemas/cvSchemas";
import { useCvStore } from "../../../lib/store/cvStore";
import { PhotoUpload } from "../PhotoUpload";
import { TodaysTipCard } from "../TodaysTipCard";
import { UAEDot } from "../UAEDot";
import { Icon } from "../Icon";
import { useImport } from "../BuilderShell";
import { Field } from "../../forms/Field";
import { FieldError } from "../../FieldError";
import {
  sanitizeName,
  sanitizeNameLive,
  sanitizeEmail,
  sanitizePhone,
  sanitizePhoneLive,
  sanitizeJobTitle,
  sanitizeJobTitleLive,
  sanitizeLocation,
  sanitizeLocationLive,
  sanitizeURL,
  validateEmail,
  validateLinkedIn,
  validateURL,
} from "../../../lib/sanitize";
import type { CvPersonal, PhotoShape } from "../../../lib/types/cv";

const ICON_INPUT_PAD = 40;

export const PersonalStep = ({ onNext }: { onNext: () => void }) => {
  const personal = useCvStore((state) => state.data.personal);
  const photoShape = useCvStore(
    (state) => state.data.settings.photoShape ?? "round",
  );
  const updateSection = useCvStore((state) => state.updateSection);
  const settings = useCvStore((state) => state.data.settings);
  const { handleImport } = useImport();
  const lastSerializedRef = useRef<string>(JSON.stringify(personal));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string | null>
  >({});

  const setFieldError = (field: string, error: string | null) =>
    setFieldErrors((prev) => ({ ...prev, [field]: error }));

  const setPhotoShape = (shape: PhotoShape) => {
    updateSection("settings", { ...settings, photoShape: shape });
  };

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
    setValue,
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

  const initials = `${personal.firstName?.charAt(0) ?? ""}${
    personal.lastName?.charAt(0) ?? ""
  }`;

  return (
    <form
      onSubmit={handleSubmit(onNext)}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >

      {/* Import row — PDF/DOCX is the only working source, so it takes the
          full-width primary slot. LinkedIn paste-import was a dead placeholder
          (see git history for removal). */}
      <ImportButton
        icon="upload"
        label="Import existing CV (PDF / DOCX)"
        onClick={() => handleImport("pdf")}
      />

      {/* OR divider */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          margin: "8px 0 4px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "var(--ff-line)",
          }}
        />
        <span
          style={{
            position: "relative",
            background: "var(--ff-paper)",
            padding: "0 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ff-faint)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Or fill by hand
        </span>
      </div>

      {/*
        Mobile-only reorder: on viewports below `md` (Tailwind 768px), the
        identity fields render ABOVE the photo + tip card so the primary task
        (filling your name + contact) is what the user sees first. On md+ the
        original DOM order is restored, so the desktop layout is unchanged.

        `flex-col-reverse` reverses the visual order of the two children below
        without touching the DOM order; `md:flex-col` flips back at md and up.
        Pure Tailwind, zero JS, SSR-safe.
      */}
      <div
        className="flex flex-col-reverse md:flex-col"
        style={{ gap: 22 }}
      >
        {/* Photo + Today's Tip side-by-side (renders SECOND on mobile) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 12,
          }}
          className="ff-photo-tip-grid"
        >
          <PhotoUpload
            photo={personal.photo}
            showPhoto={personal.showPhoto}
            photoShape={photoShape}
            onPhotoChange={handlePhotoChange}
            onToggleChange={handleToggleChange}
            onShapeChange={setPhotoShape}
            initials={initials}
          />
          <TodaysTipCard stepId="personal" />
        </div>

        {/* Core fields grid (renders FIRST on mobile) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
          className="ff-core-fields"
        >
        <Field
          label="First name"
          required
          error={errors.firstName?.message}
        >
          <input
            className="cv-input"
            placeholder="e.g. Muhammad"
            {...register("firstName")}
            onChange={(e) => {
              e.target.value = sanitizeNameLive(e.target.value);
              register("firstName").onChange(e);
            }}
            onBlur={(e) => {
              e.target.value = sanitizeName(e.target.value);
              register("firstName").onChange(e);
              register("firstName").onBlur(e);
            }}
          />
        </Field>
        <Field
          label="Last name"
          required
          error={errors.lastName?.message}
        >
          <input
            className="cv-input"
            placeholder="e.g. Al-Rashidi"
            {...register("lastName")}
            onChange={(e) => {
              e.target.value = sanitizeNameLive(e.target.value);
              register("lastName").onChange(e);
            }}
            onBlur={(e) => {
              e.target.value = sanitizeName(e.target.value);
              register("lastName").onChange(e);
              register("lastName").onBlur(e);
            }}
          />
        </Field>
        <Field
          label="Headline"
          hint="Mirrors the role you want, not the one you held."
          error={errors.headline?.message}
        >
          <input
            className="cv-input"
            placeholder="e.g. Senior Operations Manager"
            {...register("headline")}
            onChange={(e) => {
              e.target.value = sanitizeJobTitleLive(e.target.value);
              register("headline").onChange(e);
            }}
            onBlur={(e) => {
              e.target.value = sanitizeJobTitle(e.target.value);
              register("headline").onChange(e);
              register("headline").onBlur(e);
            }}
          />
        </Field>
        <Field label="City" leftIcon="pin">
          <input
            className="cv-input"
            placeholder="e.g. Dubai, UAE"
            style={{ paddingLeft: ICON_INPUT_PAD }}
            {...register("location")}
            onChange={(e) => {
              e.target.value = sanitizeLocationLive(e.target.value);
              register("location").onChange(e);
            }}
            onBlur={(e) => {
              e.target.value = sanitizeLocation(e.target.value);
              register("location").onChange(e);
              register("location").onBlur(e);
            }}
          />
        </Field>
        <Field label="Phone" leftIcon="phone" required>
          <input
            className="cv-input"
            placeholder="+971 50 123 4567"
            style={{ paddingLeft: ICON_INPUT_PAD }}
            {...register("phone")}
            onChange={(e) => {
              e.target.value = sanitizePhoneLive(e.target.value);
              register("phone").onChange(e);
            }}
            onBlur={(e) => {
              e.target.value = sanitizePhone(e.target.value);
              register("phone").onChange(e);
              register("phone").onBlur(e);
            }}
          />
        </Field>
        <Field
          label="Email"
          leftIcon="mail"
          required
          error={errors.email?.message}
        >
          <input
            className="cv-input"
            placeholder="yourname@email.com"
            style={{ paddingLeft: ICON_INPUT_PAD }}
            {...register("email")}
            onChange={(e) => {
              e.target.value = sanitizeEmail(e.target.value);
              register("email").onChange(e);
            }}
            onBlur={(e) => {
              register("email").onBlur(e);
              setFieldError("email", validateEmail(e.target.value));
            }}
          />
          <FieldError message={fieldErrors.email ?? null} />
        </Field>
        </div>
      </div>

      {/* UAE Essentials block */}
      <section
        style={{
          padding: 18,
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
            marginBottom: 12,
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
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ff-accent)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              marginLeft: "auto",
            }}
          >
            +8 pts
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
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
          <Field label="Availability">
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
        </div>
      </section>

      {/* More details expander */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ff-accent-dark)",
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
            <Icon name="plus" size={13} />
          </span>
          {showMore ? "Hide extra details" : "Add more details"}
        </button>

        {showMore && (
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
            className="ff-core-fields"
          >
            <Field
              label="LinkedIn"
              optional
              leftIcon="linkedin"
            >
              <input
                className="cv-input"
                placeholder="linkedin.com/in/yourname"
                style={{ paddingLeft: ICON_INPUT_PAD }}
                {...register("linkedin")}
                onBlur={(e) => {
                  register("linkedin").onBlur(e);
                  const url = sanitizeURL(e.target.value);
                  if (url !== e.target.value)
                    setValue("linkedin", url, { shouldDirty: true });
                  setFieldError("linkedin", validateLinkedIn(url));
                }}
              />
              <FieldError
                message={fieldErrors.linkedin ?? null}
                type="warning"
              />
            </Field>
            <Field label="Website" optional leftIcon="globe">
              <input
                className="cv-input"
                placeholder="www.yourportfolio.com"
                style={{ paddingLeft: ICON_INPUT_PAD }}
                {...register("website")}
                onBlur={(e) => {
                  register("website").onBlur(e);
                  const url = sanitizeURL(e.target.value);
                  if (url !== e.target.value)
                    setValue("website", url, { shouldDirty: true });
                  setFieldError("website", validateURL(url));
                }}
              />
              <FieldError
                message={fieldErrors.website ?? null}
                type="warning"
              />
            </Field>
            <Field label="Nationality" optional>
              <input
                className="cv-input"
                placeholder="e.g. Emirati, Pakistani, Indian"
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
            <Field label="Country" optional>
              <input
                className="cv-input"
                placeholder="e.g. United Arab Emirates"
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
                {...register("dateOfBirth")}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 4,
        }}
      >
        <button
          type="submit"
          className="cv-btn-primary"
          style={{ padding: "12px 26px" }}
        >
          Continue
          <Icon name="chevron-right" size={14} strokeWidth={2.5} />
        </button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ff-photo-tip-grid { grid-template-columns: 1fr !important; }
          .ff-core-fields { grid-template-columns: 1fr !important; }
          .ff-uae-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
};

/* ─── Helpers ─── */
const ImportButton = ({
  icon,
  label,
  onClick,
}: {
  icon: "upload" | "linkedin";
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: "100%",
      fontFamily: "var(--font-body)",
      fontSize: 13,
      color: "var(--ff-ink)",
      background: "var(--ff-card)",
      border: "1px dashed var(--ff-line-strong)",
      padding: "13px 16px",
      borderRadius: 12,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      cursor: "pointer",
      fontWeight: 500,
      transition: "border-color 120ms, background 120ms, color 120ms",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = "var(--ff-accent)";
      e.currentTarget.style.color = "var(--ff-accent-dark)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = "var(--ff-line-strong)";
      e.currentTarget.style.color = "var(--ff-ink)";
    }}
  >
    <Icon name={icon} size={14} />
    {label}
  </button>
);
