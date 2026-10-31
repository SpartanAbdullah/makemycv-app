/**
 * One line per failed request in the feedback routes (2026-10-24). The routes
 * answer a flat `server_error` on purpose, so without this the Vercel log is
 * empty and a misconfigured Resend domain or Supabase table is invisible.
 * Logs the route and the error message only — never the request body, so no
 * email address or quote text reaches the log.
 */
export function logRouteError(route: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${route}] ${message.slice(0, 300)}`);
}

export type AiFailureKind =
  | "timeout" // AbortSignal.timeout fired (504 to the user)
  | "upstream" // Anthropic answered non-2xx or the fetch failed (502/422)
  | "unparseable" // the model answered but nothing usable came back (502)
  | "spend_cap" // the shared daily budget refused the call (503)
  | "internal"; // anything else in the route (500)

/**
 * One line per failed AI request (2026-10-31, production stability review).
 *
 * Before this the AI routes answered 502/503/504 without writing anything, and
 * on the Vercel Hobby plan runtime logs are kept for one hour, so a revoked
 * key, an exhausted Anthropic balance or a spent daily cap left no trace at
 * all. `console.error` lands in Vercel's 7-day runtime-error clusters
 * (`get_runtime_errors`), which is the only error history this plan keeps.
 *
 * Privacy: request payloads and model output can carry CV text, so the only
 * message ever printed verbatim is Anthropic's own error body (which never
 * echoes the prompt); any other error is reduced to its name.
 */
export function logAiFailure(route: string, kind: AiFailureKind, err?: unknown): void {
  const raw = err instanceof Error ? err.message : "";
  const detail = /^Anthropic API error: \d{3}/.test(raw)
    ? raw.slice(0, 300)
    : err instanceof Error
      ? err.name
      : "";
  console.error(`[${route}] ai_${kind}${detail ? ` ${detail}` : ""}`);
}
