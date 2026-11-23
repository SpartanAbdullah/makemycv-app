/**
 * Reading one Messages API reply for /api/jd-match/rewrite-bullet
 * (2026-11-23, prompt review).
 *
 * An empty list is this route's honest answer: "this keyword cannot be added
 * to this bullet truthfully". Until now a reply that could not be read at all
 * (prose, cut off at the length limit) was turned into that same empty list,
 * so the user was told "can't add this truthfully" when the real cause was a
 * broken reply, and nothing was logged. The two are now separate kinds.
 *
 *   variants  a list the route can return as it is. May be empty: the model
 *             answered [] or declined to answer.
 *   unusable  nothing readable came back. The route asks once more, then
 *             answers with an error the user can retry.
 *
 * Server-side only (it imports lib/server).
 */
import { responseText } from "../server/anthropic";
import { countPlaceholders, normalizePlaceholders } from "../ai/placeholders";

export type RewriteReply = { kind: "variants"; variants: string[] } | { kind: "unusable" };

export const MAX_REWRITE_VARIANTS = 2;

export function readRewriteReply(data: unknown, originalBullet: string): RewriteReply {
  // A refusal from the model is a "no", the same as [].
  const stopReason = (data as { stop_reason?: unknown } | null)?.stop_reason;
  if (stopReason === "refusal") return { kind: "variants", variants: [] };

  // The prompt forbids markdown, but a fenced block still turns up.
  const cleaned = responseText(data)
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) return { kind: "unusable" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { kind: "unusable" };
  }
  if (!Array.isArray(parsed)) return { kind: "unusable" };

  // A rewrite may only re-word what the bullet says. One that carries more
  // blanks than the original ("... by {{number}}%") is asking the candidate
  // for a figure the bullet never had, so it is dropped, not shown.
  const blanksAllowed = countPlaceholders(originalBullet);
  const variants = parsed
    .filter((x): x is string => typeof x === "string")
    .map((s) => normalizePlaceholders(s.trim()))
    .filter(Boolean)
    .filter((s) => countPlaceholders(s) <= blanksAllowed)
    .slice(0, MAX_REWRITE_VARIANTS);
  return { kind: "variants", variants };
}
