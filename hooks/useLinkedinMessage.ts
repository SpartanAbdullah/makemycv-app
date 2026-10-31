"use client";

import { useCallback, useState } from "react";
import type { LinkedinMessageRequest } from "../lib/linkedinMessage/payload";

// Same error shape as useCoverLetter, plus REFUSED: the model declined
// because the paste was not a job / recruiter context. A refusal is an
// honest outcome (CLAUDE.md truthfulness rules) and the panel words it as
// one, not as a failure.
export type LinkedinMessageError = {
  code: "RATE_LIMITED" | "REFUSED" | "OTHER";
  message: string;
  supportUrl?: string;
  retryAfter?: number;
};

/**
 * `outcome` (E5): "ok" when the route's length check passed, "trimmed" when
 * the message came back over 90 words twice and was cut at a sentence
 * boundary — the panel says so and analytics counts it.
 */
export type LinkedinMessageResult =
  | { ok: true; text: string; outcome: "ok" | "trimmed" }
  | { ok: false; code: LinkedinMessageError["code"] };

/**
 * LinkedIn recruiter message (product #3). Sends the LinkedinMessageRequest
 * built by lib/linkedinMessage/payload.ts — a SMALL EXCERPT of the CV plus
 * the job / recruiter text the user pasted — to /api/linkedin-message.
 * The panel owns the editable copy; this hook only owns the network state.
 * `generate` returns the outcome directly so the caller can log it without
 * waiting for a re-render.
 */
export function useLinkedinMessage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LinkedinMessageError | null>(null);

  const generate = useCallback(async (req: LinkedinMessageRequest): Promise<LinkedinMessageResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; outcome?: string; error?: string; supportUrl?: string; retryAfter?: number }
        | null;

      if (res.status === 429) {
        setError({
          code: "RATE_LIMITED",
          message: data?.message ?? "You've used your LinkedIn messages for now. They reset gradually.",
          supportUrl: data?.supportUrl,
          retryAfter: data?.retryAfter,
        });
        return { ok: false, code: "RATE_LIMITED" };
      }
      if (res.status === 422 && data?.error === "refused") {
        setError({
          code: "REFUSED",
          message:
            data.message ??
            "This doesn't read as a job ad or a recruiter's message, so there's nothing to reply to.",
        });
        return { ok: false, code: "REFUSED" };
      }
      if (!res.ok || typeof data?.message !== "string") {
        setError({ code: "OTHER", message: data?.error ?? "Something went wrong writing the message." });
        return { ok: false, code: "OTHER" };
      }
      return { ok: true, text: data.message, outcome: data.outcome === "trimmed" ? "trimmed" : "ok" };
    } catch {
      setError({ code: "OTHER", message: "Something went wrong writing the message." });
      return { ok: false, code: "OTHER" };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { isLoading, error, generate, clearError };
}
