"use client";

import { useState, useCallback } from "react";
import type { JdRequirements } from "../lib/jdMatch/types";

// Same error shape as useAIImprove so the UI can reuse the rate-limit pattern.
export type JdMatchError = {
  code: "RATE_LIMITED" | "OTHER";
  message: string;
  supportUrl?: string;
  retryAfter?: number;
};

/**
 * JD Match hook. Sends ONLY the JD text to the server for extraction and
 * exposes the structured `requirements` — the CV never leaves the browser.
 *
 * It deliberately does NOT run the matcher itself: the panel derives the live
 * result with useMemo(matchRequirementsToCv(requirements, cv)) against the
 * store CV, so Phase B apply-fixes (which mutate the CV) recompute the score
 * and flip chips to matched automatically. (Phase A snapshotted the result,
 * which would have gone stale the moment a fix changed the CV.)
 */
export function useJdMatch() {
  const [requirements, setRequirements] = useState<JdRequirements | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<JdMatchError | null>(null);

  const run = useCallback(async (jobText: string) => {
    setIsLoading(true);
    setError(null);
    setRequirements(null);

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

      setRequirements(data.requirements);
    } catch {
      setError({ code: "OTHER", message: "Something went wrong analysing the job." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setRequirements(null);
    setError(null);
  }, []);

  return { run, requirements, isLoading, error, clear };
}
