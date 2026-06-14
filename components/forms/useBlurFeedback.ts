"use client";

import { useCallback, useState } from "react";

/**
 * Per-field blur feedback state for the guided-feedback system (2026-06).
 *
 * Contract (from the acceptance criteria):
 *  - Validity is judged on BLUR, never per keystroke: blurField() is the
 *    only call that can set "valid" (green check) or "invalid" (red).
 *  - While typing, changeField() may only SOFTEN the displayed state back
 *    to neutral — green clears when the value stops being valid (e.g. the
 *    user empties the field), red clears as soon as the value becomes
 *    valid. Red never APPEARS mid-typing.
 *
 * Validity itself comes from lib/validation/cvRequirements.ts — this hook
 * only stores what to display.
 */

export type FeedbackState = "valid" | "invalid" | "neutral";

export function useBlurFeedback() {
  const [states, setStates] = useState<Record<string, FeedbackState>>({});

  const blurField = useCallback((key: string, isValid: boolean) => {
    setStates((s) => ({ ...s, [key]: isValid ? "valid" : "invalid" }));
  }, []);

  const changeField = useCallback((key: string, isValid: boolean) => {
    setStates((s) => {
      const cur = s[key];
      if (!cur || cur === "neutral") return s;
      if (cur === "valid" && !isValid) return { ...s, [key]: "neutral" };
      if (cur === "invalid" && isValid) return { ...s, [key]: "neutral" };
      return s;
    });
  }, []);

  const fieldState = useCallback(
    (key: string): FeedbackState => states[key] ?? "neutral",
    [states],
  );

  return { fieldState, blurField, changeField };
}
