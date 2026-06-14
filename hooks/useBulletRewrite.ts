"use client";

import { useCallback, useState } from "react";

// Same error shape as useJdMatch / useAIImprove so the panel reuses the
// rate-limit pattern.
export type RewriteError = {
  code: "RATE_LIMITED" | "OTHER";
  message: string;
  supportUrl?: string;
  retryAfter?: number;
};

/**
 * JD Match Phase B — truthful single-bullet rewrite hook.
 *
 * Sends ONLY { bullet, keyword, roleTitle } to /api/jd-match/rewrite-bullet —
 * never the whole CV. `variants` is null until a request completes; an empty
 * array after a completed request is the truthful refusal ("couldn't add this
 * keyword without inventing something"), which is a success, not an error.
 */
export function useBulletRewrite() {
  const [variants, setVariants] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<RewriteError | null>(null);

  const rewrite = useCallback(
    async (bullet: string, keyword: string, roleTitle: string) => {
      setIsLoading(true);
      setError(null);
      setVariants(null);

      try {
        const res = await fetch("/api/jd-match/rewrite-bullet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bullet, keyword, roleTitle }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              variants?: string[];
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
              "You've used your bullet rewrites for now. They reset gradually.",
            supportUrl: data?.supportUrl,
            retryAfter: data?.retryAfter,
          });
          return;
        }

        if (!res.ok) {
          setError({
            code: "OTHER",
            message: data?.error ?? "Couldn't rewrite that bullet.",
          });
          return;
        }

        // A successful response — including an empty array (truthful refusal).
        setVariants(Array.isArray(data?.variants) ? data.variants : []);
      } catch {
        setError({ code: "OTHER", message: "Couldn't rewrite that bullet." });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setVariants(null);
    setError(null);
  }, []);

  return { rewrite, variants, isLoading, error, clear };
}
