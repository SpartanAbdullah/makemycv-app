"use client";

import { useState } from "react";

interface TipJarProps {
  variant?: "full" | "compact";
  context?: string;
  onDismiss?: () => void;
}

const PRESETS = [3, 5, 10, 25];

const PAYPAL_HANDLE =
  process.env.NEXT_PUBLIC_PAYPAL_ME_HANDLE || "makemycv";

function getEmojiFeedback(amount: number): { emoji: string; message: string } {
  if (amount < 1) {
    return {
      emoji: "\u{1F622}",
      message: "Every bit counts, but the PayPal minimum is $1.",
    };
  }
  if (amount <= 2) {
    return { emoji: "\u{1F642}", message: "Thanks — that helps." };
  }
  if (amount <= 6) {
    return { emoji: "\u{1F60A}", message: "Really appreciate this." };
  }
  if (amount <= 14) {
    return { emoji: "\u{1F929}", message: "Wow — thank you!" };
  }
  if (amount <= 49) {
    return { emoji: "\u{1F979}", message: "You're incredibly kind." };
  }
  return { emoji: "\u{1F680}", message: "You're a legend. Genuinely." };
}

export const TipJar = ({
  variant = "full",
  context,
  onDismiss,
}: TipJarProps) => {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState<string>("");

  const amount =
    selectedPreset ??
    (customAmount ? Math.max(0, Math.floor(Number(customAmount))) : 0);
  const { emoji, message } = getEmojiFeedback(amount);
  const disabled = amount < 1;
  const isCompact = variant === "compact";

  const handlePresetClick = (preset: number) => {
    setSelectedPreset(preset);
    setCustomAmount("");
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    setSelectedPreset(null);
  };

  const handleTipClick = () => {
    if (disabled) return;
    const url = `https://paypal.me/${PAYPAL_HANDLE}/${amount}USD`;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      localStorage.setItem("mmcv_tipped_at", new Date().toISOString());
    } catch {
      // localStorage unavailable (private mode, quota) — silent fail is fine
    }
    if (onDismiss) {
      setTimeout(onDismiss, 500);
    }
  };

  return (
    <div
      data-context={context}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card-blue card-lift ${
        isCompact ? "p-6" : "p-6 md:p-8"
      }`}
    >
      {/* Accent bar (full variant only) */}
      {!isCompact && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background:
              "linear-gradient(90deg, #2563eb 0%, #4f46e5 50%, #2563eb 100%)",
          }}
        />
      )}

      <div className="flex items-baseline justify-between gap-3">
        <h3
          className={`font-display font-bold text-slate-900 ${
            isCompact ? "text-xl" : "text-2xl md:text-3xl"
          }`}
        >
          {isCompact ? "Did this help?" : "Support a free tool"}
        </h3>
        {!isCompact && (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#2563eb]">
            Tip Jar
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-brand-muted">
        MakeMyCV is free. Tips help cover hosting and AI costs &mdash; nothing
        more.
      </p>

      {/* Preset tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {PRESETS.map((preset) => {
          const isSelected = selectedPreset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "btn-primary rounded-xl px-4 py-3 text-center text-base font-bold text-white ring-2 ring-blue-400 ring-offset-2"
                  : "rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-base font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-[#2563eb]"
              }
            >
              ${preset}
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div className="mt-4">
        <label
          htmlFor="tipjar-custom-amount"
          className="block text-xs font-medium text-slate-600"
        >
          Or enter your own amount
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            $
          </span>
          <input
            id="tipjar-custom-amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-base text-slate-800 outline-none transition-colors focus:border-[#2563eb]"
          />
        </div>
      </div>

      {/* Emoji + message */}
      <div className="mt-6 text-center transition-all duration-200">
        <div className={isCompact ? "text-5xl leading-none" : "text-6xl leading-none"}>
          {emoji}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleTipClick}
        disabled={disabled}
        className={`mt-6 block w-full rounded-xl text-center font-bold text-white transition-all ${
          isCompact ? "px-6 py-3 text-base" : "px-6 py-4 text-lg"
        } ${disabled ? "cursor-not-allowed bg-slate-300" : "btn-primary"}`}
      >
        {disabled
          ? "Pick an amount to continue"
          : `Tip $${amount} via PayPal`}
      </button>

      {/* Reassurance */}
      <p className="mt-3 text-center text-xs text-slate-500">
        Secure via PayPal. No PayPal account needed &mdash; credit card works
        too.
      </p>
    </div>
  );
};

export default TipJar;
