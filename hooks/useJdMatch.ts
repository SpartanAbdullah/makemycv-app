"use client";

import { useState, useCallback } from "react";
import { matchRequirementsToCv } from "../lib/jdMatch/match";
import type { JdMatchResult, JdRequirements } from "../lib/jdMatch/types";
import type { CvData } from "../lib/types/cv";

// Same error shape as useAIImprove so the UI can reuse the rate-limit pattern.
export type JdMatchError = {
  code: "RATE_LIMITED" | "OTHER";
  message: string;
  supportUrl?: string;
  retryAfter?: number;
};

/**
 * JD Match hook (Phase A). Sends ONLY the JD text to the server for
 * extraction, then runs the deterministic matcher against the CV locally —
 * the CV never leaves the browser.
 */
export function useJdMatch() {
  const [result, setResult] = useState<JdMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<JdMatchError | null>(null);

  const run = useCallback(async (jobText: string, cv: CvData) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/jd-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobText }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            requirements?: JdRequirements;
            error?: string;
            message?: string;
            supportUrl?: string;
            retryAfter?: number;
          }
        | null;

      if (res.status === 429) {
        setError({
          code: "RATE_LIMITED",
          message:
            data?.message ??
            "You've used your JD Match checks for now. They reset gradually.",
          supportUrl: data?.supportUrl,
          retryAfter: data?.retryAfter,
        });
        return;
      }

      if (!res.ok || !data?.requirements) {
        setError({
          code: "OTHER",
          message: data?.error ?? "Something went wrong analysing the job.",
        });
        return;
      }

      // Local match — CV stays in the browser.
      setResult(matchRequirementsToCv(data.requirements, cv));
    } catch {
      setError({ code: "OTHER", message: "Something went wrong analysing the job." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { run, result, isLoading, error, clear };
}
