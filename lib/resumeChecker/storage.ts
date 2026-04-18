// KV-backed storage for ATS checker reports.
// Production: Vercel KV with 24h TTL.
// Development: in-memory Map with manual TTL, so the feature works without
// provisioning KV locally. Reports are lost on server restart — expected.

import type { StoredReport } from "./types";

const TTL_SECONDS = 86400; // 24h — spec: "Do not add a cleanup cron — KV handles it."

type Entry = { value: StoredReport; expiresAt: number };

// Module-level Map — survives HMR reloads in dev better when attached to globalThis.
const globalRef = globalThis as typeof globalThis & {
  __resumeCheckerDevStore__?: Map<string, Entry>;
};
const devStore: Map<string, Entry> =
  globalRef.__resumeCheckerDevStore__ ?? new Map();
globalRef.__resumeCheckerDevStore__ = devStore;

function kvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

function shouldUseInMemory(): boolean {
  return process.env.NODE_ENV === "development" && !kvConfigured();
}

function devSet(key: string, value: StoredReport): void {
  devStore.set(key, {
    value,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
}

function devGet(key: string): StoredReport | null {
  const entry = devStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    devStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function saveReport(
  reportId: string,
  report: StoredReport,
): Promise<void> {
  const key = `report:${reportId}`;
  if (shouldUseInMemory()) {
    devSet(key, report);
    return;
  }
  if (!kvConfigured()) {
    throw new Error(
      "Vercel KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.",
    );
  }
  const { kv } = await import("@vercel/kv");
  await kv.set(key, report, { ex: TTL_SECONDS });
}

export async function getReport(reportId: string): Promise<StoredReport | null> {
  const key = `report:${reportId}`;
  if (shouldUseInMemory()) {
    return devGet(key);
  }
  if (!kvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  const value = await kv.get<StoredReport>(key);
  return value ?? null;
}
