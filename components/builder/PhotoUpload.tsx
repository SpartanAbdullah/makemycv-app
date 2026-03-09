"use client";

import { useRef, useState } from "react";
import {
  resizeAndCropToSquare,
  validateImageFile,
} from "../../lib/utils/imageUtils";

interface PhotoUploadProps {
  photo?: string;
  showPhoto?: boolean;
  onPhotoChange: (base64: string | undefined) => void;
  onToggleChange: (show: boolean) => void;
}

export function PhotoUpload({
  photo,
  showPhoto = false,
  onPhotoChange,
  onToggleChange,
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

  return (
    <div className="flex flex-col gap-3">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Profile Photo (Optional)
      </label>

      <div className="flex items-start gap-4">
        {/* Photo preview or placeholder */}
        <div
          className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Upload photo"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt="Profile photo preview"
              className="w-full h-full object-cover"
            />
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-[9px] text-slate-400">Processing...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center px-1">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-slate-400"
              >
                <path
                  d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[9px] text-slate-400 leading-tight">
                Click to upload
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            className="text-sm font-semibold text-[#2563eb] hover:text-blue-700 transition-colors text-left disabled:opacity-50"
          >
            {photo ? "Change photo" : "Upload photo"}
          </button>

          {photo && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                role="checkbox"
                aria-checked={showPhoto}
                tabIndex={0}
                onClick={() => onToggleChange(!showPhoto)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleChange(!showPhoto);
                  }
                }}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                  showPhoto ? "bg-[#2563eb]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    showPhoto ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-xs text-slate-600 font-medium">
                Show photo on CV
              </span>
            </label>
          )}

          {photo && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-400 hover:text-red-600 transition-colors text-left w-fit"
            >
              Remove photo
            </button>
          )}

          <p className="text-[10px] text-slate-400 leading-snug">
            JPG, PNG or WebP &middot; Max 5MB
            <br />
            Auto-cropped to square.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <p className="text-[10px] text-slate-400 leading-snug bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <strong>UAE tip:</strong> Photos are accepted by most UAE employers.
        Toggle off for applications to international companies with blind hiring
        policies.
      </p>

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
