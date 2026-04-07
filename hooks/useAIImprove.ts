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

const STORAGE_KEYS: Record<AIImproveType, string> = {
  bullets: "makemycv_ai_bullets_used",
  skills: "makemycv_ai_skills_used",
  summary: "makemycv_ai_summary_used",
};

export function hasUsedFreeAI(type: AIImproveType): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS[type]) === "1";
  } catch {
    return false;
  }
}

export function useAIImprove() {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const improve = useCallback(async (payload: AIImprovePayload) => {
    const key = STORAGE_KEYS[payload.type];

    try {
      if (localStorage.getItem(key) === "1") {
        setError("FREE_LIMIT_REACHED");
        setResults([]);
        setIsLoading(false);
        return;
      }
    } catch {
      /* SSR guard */
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/ai-improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      setResults(data.results);
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* storage full */
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasUsedFree = useCallback(
    (type: AIImproveType) => hasUsedFreeAI(type),
    [],
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { improve, results, isLoading, error, hasUsedFree, clearResults };
}
