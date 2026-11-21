/**
 * Reading one Messages API reply for /api/ai-improve, and deciding whether
 * it is worth asking again (product audit 2026-11, A9).
 *
 * Before this the route had one path for every reply that was not a clean
 * JSON array — a refusal, a reply cut off at max_tokens, prose instead of
 * JSON — and all of them reached the user as "Internal server error" with no
 * second attempt. They are three different things:
 *
 *   results   strings the user can pick from
 *   declined  the model chose not to answer (a refusal, or an empty list).
 *             An honest "nothing to suggest" — asking again is pointless.
 *   unusable  the reply could not be read. Usually a one-off; ask once more.
 *
 * Server-side only (it imports lib/server). The words the UI shows live in
 * improveOutcome.ts.
 */
import { responseText } from "../server/anthropic";
import { normalizePlaceholders } from "./placeholders";

export type ImproveReply =
  | { kind: "results"; results: string[] }
  | { kind: "declined" }
  | { kind: "unusable" };

/** The JSON array inside `text`, or null when there is none to read. */
function parseArray(text: string): unknown[] | null {
  // The prompt forbids markdown, but a fenced block still turns up.
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readImproveReply(data: unknown): ImproveReply {
  const stopReason = (data as { stop_reason?: unknown } | null)?.stop_reason;
  if (stopReason === "refusal") return { kind: "declined" };

  const parsed = parseArray(responseText(data));
  if (parsed === null) return { kind: "unusable" };

  // Strings only, and every placeholder variant ([X], {{ metric }}) folded
  // into the one token the UI explains — see placeholders.ts.
  const results = parsed
    .filter((r): r is string => typeof r === "string")
    .map((r) => normalizePlaceholders(r.trim()))
    .filter(Boolean);
  return results.length > 0 ? { kind: "results", results } : { kind: "declined" };
}

/**
 * Ask, and ask ONE more time when the first reply could not be read.
 *
 * `ask` gets the attempt number (1 or 2). `mayRetry` is the caller's gate —
 * the route uses it to charge the spend guard and to check there is still
 * time on the clock; when it says no, the first reply stands. Anything other
 * than `unusable` (including a caller-defined kind such as an upstream
 * failure) is returned as it came.
 */
export async function askWithOneRetry<T extends { kind: string }>(
  ask: (attempt: 1 | 2) => Promise<T>,
  mayRetry: () => Promise<boolean> | boolean,
): Promise<T> {
  const first = await ask(1);
  if (first.kind !== "unusable") return first;
  if (!(await mayRetry())) return first;
  return ask(2);
}
