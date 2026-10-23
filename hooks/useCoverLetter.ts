"use client";

import { useCallback, useState } from "react";
import type { CoverLetterRequest } from "../lib/coverLetter/payload";

// Same error shape as useJdMatch / useBulletRewrite so the panel reuses the
// rate-limit pattern (message + Ko-fi support link on 429).
export type CoverLetterError = {
  code: "RATE_LIMITED" | "OTHER";
  message: string;
  supportUrl?: string;
  retryAfter?: number;
};

/**
 * Cover letter v1 (WP-9). Sends the CoverLetterRequest built by
 * lib/coverLetter/payload.ts — an EXCERPT of the CV plus the job details the
 * user typed — to /api/cover-letter and exposes the returned letter text.
 * The panel owns the editable copy; this hook only owns the network state.
 */
export function useCoverLetter() {
  const [letter, setLetter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CoverLetterError | null>(null);

  const generate = useCallback(async (req: CoverLetterRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = (await res.json().catch(() => null)) as
        | { letter?: string; error?: string; message?: string; supportUrl?: string; retryAfter?: number }
        | null;

      if (res.status === 429) {
        setError({
          code: "RATE_LIMITED",
          message: data?.message ?? "You've used your cover letters for now. They reset gradually.",
          supportUrl: data?.supportUrl,
          retryAfter: data?.retryAfter,
        });
        return null;
      }
      if (!res.ok || typeof data?.letter !== "string") {
        setError({ code: "OTHER", message: data?.error ?? "Something went wrong writing the letter." });
        return null;
      }
      setLetter(data.letter);
      return data.letter;
    } catch {
      setError({ code: "OTHER", message: "Something went wrong writing the letter." });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setLetter(null);
    setError(null);
  }, []);

  return { letter, isLoading, error, generate, clear };
}
