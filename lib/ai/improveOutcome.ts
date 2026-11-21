/**
 * Words shared by /api/ai-improve and the screens that show its answers
 * (product audit 2026-11, A9 and A6). Client-safe: no server imports.
 */

export type ImproveType = "bullets" | "skills" | "summary";

/**
 * `error` value of the 422 the route answers when the model had nothing
 * usable to offer — a refusal, an empty list, or two unusable replies in a
 * row. It is an honest decline, not a fault, and the UI shows it as one.
 */
export const NOTHING_TO_SUGGEST = "nothing_to_suggest";

const NOTHING_MESSAGES: Record<ImproveType, string> = {
  bullets:
    "Nothing to suggest for this role yet. Add the job title and one or two things you did there, then try again.",
  skills:
    "Nothing to suggest yet. Add a headline or a role with a couple of bullet points, then try again.",
  summary:
    "Nothing to suggest yet. Add a headline and at least one role, then try again.",
};

export const nothingToSuggestMessage = (type: ImproveType | undefined): string =>
  NOTHING_MESSAGES[type ?? "bullets"] ?? NOTHING_MESSAGES.bullets;

/**
 * "in about 3 hours" for a Retry-After number of seconds, or null when the
 * server gave none. Deliberately approximate: the daily allowance is a
 * sliding window, so the figure is when the window ends, not a promise to
 * the second.
 */
export const describeRetryAfter = (seconds: number | undefined | null): string | null => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 90) return "in about a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `in about ${minutes} minutes`;
  const hours = Math.round(seconds / 3600);
  if (hours <= 1) return "in about an hour";
  if (hours < 20) return `in about ${hours} hours`;
  return "tomorrow";
};
