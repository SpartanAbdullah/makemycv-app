/**
 * Supabase (Postgres) access for the feedback features — ratings, quotes and
 * email sign-ups (2026-10-24). Server-only: the service-role key bypasses
 * row-level security, so it must never reach a client bundle. Both tables
 * have RLS enabled with NO policies, which means the anon/publishable key can
 * read and write nothing — the only way in is through these route handlers.
 *
 * Thin PostgREST client over fetch rather than @supabase/supabase-js: three
 * verbs, no realtime, no auth, no extra dependency. Region: the project is
 * expected to live in the EU (eu-central-1) — the privacy policy says so.
 *
 * Absent configuration is a soft state, not an error: `supabaseConfigured()`
 * is false and every caller returns 503 so the UI can hide itself.
 */

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = (): boolean => Boolean(URL_ && KEY);

type Row = Record<string, unknown>;

async function call(path: string, init: RequestInit & { prefer?: string }): Promise<Response> {
  if (!URL_ || !KEY) throw new Error("Supabase is not configured");
  const headers: Record<string, string> = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res;
}

/** INSERT one row; returns the inserted row (selected columns via `select`). */
export async function sbInsert<T extends Row = Row>(table: string, row: Row, select = "*"): Promise<T> {
  const res = await call(`${table}?select=${encodeURIComponent(select)}`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "return=representation",
  });
  const rows = (await res.json()) as T[];
  return rows[0];
}

/** UPSERT on a unique column; returns the resulting row. */
export async function sbUpsert<T extends Row = Row>(table: string, row: Row, onConflict: string, select = "*"): Promise<T> {
  const res = await call(`${table}?on_conflict=${onConflict}&select=${encodeURIComponent(select)}`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const rows = (await res.json()) as T[];
  return rows[0];
}

/** PATCH rows matching a PostgREST filter string (e.g. "id=eq.<uuid>"); returns them. */
export async function sbPatch<T extends Row = Row>(table: string, filter: string, patch: Row, select = "*"): Promise<T[]> {
  const res = await call(`${table}?${filter}&select=${encodeURIComponent(select)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    prefer: "return=representation",
  });
  return (await res.json()) as T[];
}

/** SELECT with a raw PostgREST query string (filters, order, limit). */
export async function sbSelect<T extends Row = Row>(table: string, query: string): Promise<T[]> {
  const res = await call(`${table}?${query}`, { method: "GET" });
  return (await res.json()) as T[];
}
