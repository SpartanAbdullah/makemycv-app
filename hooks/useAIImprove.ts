"use client";

import { useState, useCallback } from "react";

export type AIImproveType = "bullets" | "skills" | "summary";

export type AIImprovePayload = {
  type: AIImproveType;
  jobTitle?: string;
  company?: string;
  existingBullets?: string[];
  headline?: string;
  experienceRoles?: { title: string; company: string; bullets: string[] }[];
  existingSkills?: string[];
  existingSummary?: string;
};

export type AIError = {
  code: "RATE_LIMITED" | "OTHER";
  message: string;
  supportUrl?: string;
  retryAfter?: number;
};

export function useAIImprove() {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AIError | null>(null);

  const improve = useCallback(async (payload: AIImprovePayload) => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/ai-improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            results?: string[];
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
            "You've used your AI improvements for now. They reset gradually.",
          supportUrl: data?.supportUrl,
          retryAfter: data?.retryAfter,
        });
        return;
      }

      if (!res.ok) {
        setError({
          code: "OTHER",
          message: data?.error ?? "Something went wrong",
        });
        return;
      }

      setResults(data?.results ?? []);
    } catch {
      setError({ code: "OTHER", message: "Something went wrong" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { improve, results, isLoading, error, clearResults };
}
