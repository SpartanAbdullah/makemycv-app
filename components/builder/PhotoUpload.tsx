"use client";

import { useRef, useState } from "react";
import {
  resizeAndCropToSquare,
  validateImageFile,
} from "../../lib/utils/imageUtils";
import { Switch } from "../forms/Switch";
import type { PhotoShape } from "../../lib/types/cv";

interface PhotoUploadProps {
  photo?: string;
  showPhoto?: boolean;
  photoShape?: PhotoShape;
  onPhotoChange: (base64: string | undefined) => void;
  onToggleChange: (show: boolean) => void;
  onShapeChange: (shape: PhotoShape) => void;
  /** Optional fallback initials shown in the placeholder when no photo is set. */
  initials?: string;
}

/**
 * Profile photo card — Focus Flow variant.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ [photo 68px]   Profile photo  (optional)              │
 *   │                Change · Remove                        │
 *   │                JPG, PNG, WebP — max 5MB               │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Show photo on CV                          [toggle]    │
 *   │ Photo shape                          [Round · Square] │
 *   └──────────────────────────────────────────────────────┘
 */
export function PhotoUpload({
  photo,
  showPhoto = false,
  photoShape = "round",
  onPhotoChange,
  onToggleChange,
  onShapeChange,
  initials,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setIsProcessing(true);
    try {
      const base64 = await resizeAndCropToSquare(file, 200);
      onPhotoChange(base64);
      if (!showPhoto) onToggleChange(true);
    } catch {
      setError("Could not process image. Please try another file.");
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onPhotoChange(undefined);
    onToggleChange(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const radius = photoShape === "round" ? "50%" : "14px";
  const trimmedInitials = (initials ?? "").trim().slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        padding: 18,
        background: "var(--ff-card)",
        border: "1px solid var(--ff-line)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={photo ? "Change profile photo" : "Upload profile photo"}
          style={{
            width: 68,
            height: 68,
            borderRadius: radius,
            overflow: "hidden",
            background: trimmedInitials
              ? "var(--ff-accent-soft)"
              : "var(--ff-sunken)",
            border: photo
              ? "1px solid var(--ff-line)"
              : "1px dashed var(--ff-line-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
            transition: "border-color 120ms, background 120ms",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt="Profile preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : isProcessing ? (
            <span
              style={{
                width: 16,
                height: 16,
                border: "2px solid var(--ff-line-strong)",
                borderTopColor: "var(--ff-accent)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          ) : trimmedInitials ? (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--ff-accent-dark)",
                letterSpacing: "-0.02em",
              }}
            >
              {trimmedInitials}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--ff-faint)",
                letterSpacing: "0.12em",
              }}
            >
              PHOTO
            </span>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              color: "var(--ff-ink)",
              fontWeight: 600,
            }}
          >
            Profile photo
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                color: "var(--ff-faint)",
                fontWeight: 500,
                marginLeft: 6,
              }}
            >
              optional
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 8,
              fontFamily: "var(--font-body)",
              fontSize: 12.5,
              fontWeight: 600,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
              style={{
                color: "var(--ff-accent-dark)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: isProcessing ? "wait" : "pointer",
                fontWeight: 600,
              }}
            >
              {photo ? "Change photo" : "Upload photo"}
            </button>
            {photo && (
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  color: "var(--ff-red)",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Remove
              </button>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "var(--ff-muted)",
              marginTop: 8,
              lineHeight: 1.45,
            }}
          >
            JPG, PNG or WebP · max 5MB
            <br />
            Auto-cropped to square.
            <br />
            Photos are common on UAE CVs. Switch off for international or
            blind-hiring employers.
          </div>
        </div>
      </div>

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "var(--ff-red)",
            marginTop: -6,
          }}
        >
          {error}
        </p>
      )}

      {/* Show on CV toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          borderTop: "1px solid var(--ff-line)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--ff-ink-2)",
          }}
        >
          Show photo on CV
        </span>
        <Switch
          checked={showPhoto}
          onChange={onToggleChange}
          ariaLabel="Show photo on CV"
        />
      </div>

      {/* Photo shape segmented */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--ff-ink-2)",
          }}
        >
          Photo shape
        </span>
        <div
          style={{
            display: "flex",
            gap: 3,
            padding: 3,
            background: "var(--ff-paper)",
            border: "1px solid var(--ff-line)",
            borderRadius: 8,
          }}
        >
          <ShapeBtn
            active={photoShape === "round"}
            onClick={() => onShapeChange("round")}
            label="Round"
            shape="round"
          />
          <ShapeBtn
            active={photoShape === "square"}
            onClick={() => onShapeChange("square")}
            label="Square"
            shape="square"
          />
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

const ShapeBtn = ({
  active,
  onClick,
  label,
  shape,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shape: "round" | "square";
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={{
      fontFamily: "var(--font-body)",
      fontSize: 11.5,
      padding: "4px 12px",
      borderRadius: 5,
      background: active ? "var(--ff-ink)" : "transparent",
      color: active ? "white" : "var(--ff-muted)",
      fontWeight: active ? 600 : 500,
      border: "none",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      transition: "background 120ms, color 120ms",
    }}
  >
    <span
      aria-hidden
      style={{
        width: 9,
        height: 9,
        borderRadius: shape === "round" ? "50%" : "2px",
        background: active ? "white" : "var(--ff-muted)",
        display: "inline-block",
      }}
    />
    {label}
  </button>
);
