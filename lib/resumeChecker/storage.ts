// KV-backed storage for ATS checker reports.
// Production: Vercel KV with 24h TTL.
// Development: in-memory Map with manual TTL, so the feature works without
// provisioning KV locally. Reports are lost on server restart — expected.

import type {
  ScoreCategory,
  ScoreReport,
  ScoreSeverity,
  StoredReport,
} from "./types";

// --- Legacy KV adapter ---
// Reports saved before the score-engine unification have a slightly different
// shape (no `grade`, flat `issueCount: number`, categories lack `id`/`name`).
// We detect and upgrade on read so existing 24h URLs keep rendering.
// Remove this adapter once the 24h overlap window has fully rolled over.

type MaybeLegacyCategory = {
  id?: string;
  name?: string;
  category?: string;
  label?: string;
  score?: number;
  weight?: number;
  status?: ScoreSeverity;
  issues?: unknown[];
  faqs?: unknown[];
};

type MaybeLegacyScore = {
  total?: number;
  grade?: string;
  status?: ScoreSeverity;
  issueCount?: number | { error: number; review: number; good: number };
  issueCounts?: { error: number; review: number; good: number };
  categories?: MaybeLegacyCategory[];
};

function gradeFromTotal(total: number): ScoreReport["grade"] {
  if (total >= 85) return "excellent";
  if (total >= 65) return "good";
  if (total >= 40) return "needs-work";
  return "poor";
}

function upgradeScore(score: MaybeLegacyScore): ScoreReport {
  const total = typeof score.total === "number" ? score.total : 0;
  const status: ScoreSeverity =
    score.status ?? (total >= 85 ? "good" : total >= 60 ? "review" : "error");
  const flatIssueCount =
    typeof score.issueCount === "number" ? score.issueCount : 0;
  const issueCounts =
    score.issueCounts ??
    // Legacy entries only had a flat count — best-effort map into the new triple.
    { error: flatIssueCount, review: 0, good: 0 };

  const categories: ScoreCategory[] = (score.categories ?? []).map((c) => {
    const id = (c.id ?? c.category ?? "content") as ScoreCategory["id"];
    const name = c.name ?? c.label ?? id;
    const catScore = typeof c.score === "number" ? c.score : 0;
    return {
      id,
      name,
      score: catScore,
      weight: typeof c.weight === "number" ? c.weight : 0.25,
      status:
        c.status ??
        (catScore >= 85 ? "good" : catScore >= 60 ? "review" : "error"),
      issues: Array.isArray(c.issues) ? (c.issues as ScoreCategory["issues"]) : [],
      faqs: Array.isArray(c.faqs) ? (c.faqs as ScoreCategory["faqs"]) : [],
      category: id,
      label: name,
    };
  });

  return {
    total,
    grade:
      (score.grade as ScoreReport["grade"]) ??
      gradeFromTotal(total),
    issueCounts,
    categories,
    status,
    issueCount:
      typeof score.issueCount === "number"
        ? score.issueCount
        : issueCounts.error + issueCounts.review,
  };
}

function upgradeStored(raw: StoredReport): StoredReport {
  const score = raw.score as unknown as MaybeLegacyScore;
  // Fresh entries already carry grade + issueCounts + id/name on categories.
  if (score && typeof score === "object" && "grade" in score && "issueCounts" in score) {
    return raw;
  }
  return { ...raw, score: upgradeScore(score ?? {}) };
}

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
  return upgradeStored(entry.value);
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
  return value ? upgradeStored(value) : null;
}
