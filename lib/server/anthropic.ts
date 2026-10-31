// Shared settings for the four Claude-proxy routes (ai-improve, jd-match,
// jd-match/rewrite-bullet, resume-checker parse).
//
// One place for the model ID so the next model bump is a one-line change
// rather than a hunt across routes.
//
// Claude Haiku 5.5 (2026-10-10 migration from claude-haiku-4-5-20251001):
// - Adaptive thinking is ON by default, so a response can START with a
//   `thinking` block (empty text, signature only). Reading `content[0].text`
//   then yields "" and every route silently falls back. Read text blocks by
//   type — use responseText().
// - Thinking tokens count toward max_tokens. These are extraction/rewrite
//   tasks that ran without thinking on 4.5, so we send effort "low" (the model
//   thinks little, often not at all) and leave max_tokens headroom.
// - The tokenizer counts the same text as ~30% more tokens than 4.5.
// - temperature / top_p / top_k and assistant prefill return a 400. None of
//   the routes send them; keep it that way.

export const CLAUDE_MODEL = "claude-haiku-5-5";

export const CLAUDE_EFFORT = "low";

// Upper bound on ONE Messages API call (2026-10-31, performance review).
//
// Before this, no route passed a signal to fetch(), so a stalled upstream
// held the request open until the platform killed the function — 60 s on
// /api/resume-checker/parse (maxDuration) and the platform default (minutes)
// everywhere else — while the client spinner kept turning: the hooks have no
// timeout of their own and render whatever `error` the route finally sends,
// or "Something went wrong" when the platform's 504 has no JSON body.
//
// Observed latency for these prompts on Haiku at low effort is single-digit
// seconds (≤ 2048 output tokens), and 10–25 s for the parse route (up to
// 100k chars in, 8192 tokens out). The caps below are 3–5× those, so they
// fire only when something is genuinely wrong — and then the user gets a
// sentence and a retry button in 25 s instead of a dead spinner.
export const ANTHROPIC_TIMEOUT_MS = 25_000;
/** The parse route: largest prompt, maxDuration 60 — leave room for KV. */
export const ANTHROPIC_PARSE_TIMEOUT_MS = 45_000;

// Output ceiling of the checker's parse call (/api/resume-checker/parse).
//
// The parse answers with the whole CV as JSON, bullets copied verbatim, so its
// output grows with the CV. It was 4096 on Haiku 4.5; the 5.5 migration
// (eeb7112) doubled every route's ceiling because thinking tokens count
// toward max_tokens and the tokenizer counts the same text as ~30% more
// tokens — the small routes went 1024 → 2048 and this one 4096 → 8192. The
// ratio to the small routes (4×) is unchanged, and so is the 3-unit spend
// weight (PARSE_SPEND_UNITS in spendGuard.ts) that was reasoned from it.
// max_tokens is a ceiling, not a charge: output is billed as generated.
// Lowering it would cut long CVs off mid-JSON and drop them to the heuristic
// fallback; raising it changes the worst-case cost and needs the spend weight
// revisited. Pinned by anthropic.test.ts.
export const PARSE_MAX_TOKENS = 8192;

/** Signal to pass as fetch's `signal` for a Claude call. */
export function anthropicSignal(ms: number = ANTHROPIC_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * True when `err` is the abort fetch throws on `AbortSignal.timeout` — a
 * DOMException named "TimeoutError" (undici / browsers) or "AbortError"
 * (older runtimes abort without the distinct name).
 */
export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * Body of the 504 every route answers when the upstream call times out.
 * `error` is what the AI hooks render for a non-429 failure; `message`
 * mirrors it for consumers that read that field instead.
 */
export const UPSTREAM_TIMEOUT_BODY = {
  error:
    "The AI service is taking longer than usual to answer. Nothing was lost — please try again in a moment.",
  message:
    "The AI service is taking longer than usual to answer. Nothing was lost — please try again in a moment.",
} as const;

export const UPSTREAM_TIMEOUT_STATUS = 504;

type ContentBlock = { type?: unknown; text?: unknown };

/**
 * Concatenated text of every `text` block in a Messages API response.
 * Returns "" for a refusal (`stop_reason: "refusal"`) or a response cut off
 * at max_tokens before any text — callers already treat "" as unparseable.
 */
export function responseText(data: unknown): string {
  const content = (data as { content?: unknown } | null)?.content;
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}
