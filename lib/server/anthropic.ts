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
