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
