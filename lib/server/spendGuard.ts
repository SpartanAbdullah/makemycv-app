// Global AI spend guard (2026-07 hardening).
//
// Every route that proxies a paid Claude call shares ONE daily budget, so a
// distributed abuse run (many IPs, each under its per-IP limit) can no longer
// generate unbounded Anthropic spend. This is deliberately a SECOND line of
// defence: routes keep their per-IP Upstash windows and check those FIRST, so
// a hammering individual still sees the friendlier per-IP 429 before the
// global 503.
//
// Budget model: a call costs "units" that reflect relative Anthropic cost.
// /api/resume-checker/parse sends up to 100k chars with max_tokens 4096, so it
// costs 3 units; the other three routes (ai-improve, jd-match, rewrite-bullet)
// are small prompts with max_tokens ≤ 1024 and cost 1 unit each.
//
// Backing store: the same @vercel/kv instance the per-IP limiters use — one
// INCRBY per guarded call on a UTC-dated key ("aiGuard:daily:<yyyy-mm-dd>")
// with a 25h TTL so keys self-clean. Cap is env-tunable via
// AI_DAILY_GLOBAL_CAP (default 1500 units/day).
//
// When KV is UNREACHABLE this guard does NOT fail open. It falls back to a
// module-scope in-memory token bucket — 30 units/hour per lambda instance.
// Bounded availability, bounded spend: local dev and short KV outages keep
// working, but a KV outage cannot be used to bypass throttling entirely.
//
// CAVEAT, stated honestly: that bound is PER INSTANCE. A fleet of N warm
// lambdas can spend N x 30 units/hour while KV is down, and N is set by
// Vercel's autoscaler, not by this file. It is bounded per instance and
// unbounded in aggregate (audit A-W9-002).
//
// 2026-08-02: an earlier version of this comment claimed the per-IP limiters
// had already been fixed to match. They had not — @upstash/ratelimit's default
// 5s timeout RESOLVES { success: true } rather than throwing, so the per-IP
// windows silently passed every request during an Upstash slowdown and the
// routes' try/catch never fired. That is fixed in lib/server/rateLimit.ts,
// which now owns limiter construction and routes timeouts here instead.

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const SUPPORT_URL = "https://www.makemycv.ae/support";

const DEFAULT_DAILY_CAP = 1500; // units/day across ALL instances (KV-backed)
const KEY_TTL_SECONDS = 25 * 60 * 60; // 25h — outlives the UTC day it belongs to

/** Units charged by /api/resume-checker/parse (largest prompt + max_tokens). */
export const PARSE_SPEND_UNITS = 3;

function dailyCap(): number {
  const raw = Number.parseInt(process.env.AI_DAILY_GLOBAL_CAP ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_CAP;
}

function utcDateKey(now: Date): string {
  return `aiGuard:daily:${now.toISOString().slice(0, 10)}`;
}

function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export type SpendVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// --- In-memory fallback (per lambda instance) ---
//
// Continuous-refill token bucket. Module scope means the budget survives
// across requests for the lifetime of the instance; a fleet of N warm
// instances can spend at most N × 30 units/hour while KV is down — bounded,
// unlike the old fail-open.

const FALLBACK_CAPACITY_UNITS = 30;
const FALLBACK_REFILL_UNITS_PER_HOUR = 30;

type Bucket = { tokens: number; lastRefillMs: number };

function refill(bucket: Bucket, capacity: number, perHour: number): void {
  const now = Date.now();
  const elapsedHours = (now - bucket.lastRefillMs) / 3_600_000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedHours * perHour);
  bucket.lastRefillMs = now;
}

function takeFromBucket(
  bucket: Bucket,
  units: number,
  capacity: number,
  perHour: number,
): SpendVerdict {
  refill(bucket, capacity, perHour);
  if (bucket.tokens >= units) {
    bucket.tokens -= units;
    return { allowed: true };
  }
  const deficit = units - bucket.tokens;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((deficit / perHour) * 3600)),
  };
}

const globalFallbackBucket: Bucket = {
  tokens: FALLBACK_CAPACITY_UNITS,
  lastRefillMs: Date.now(),
};

/**
 * Charge `units` against the shared daily budget. Call AFTER the route's
 * per-IP limiter (so per-IP 429s win) and after request validation (so
 * malformed requests don't burn budget), immediately before the Claude call.
 *
 * Never throws: KV failures degrade to the in-memory instance bucket.
 */
export async function takeSpendUnits(units: number): Promise<SpendVerdict> {
  const now = new Date();
  try {
    const key = utcDateKey(now);
    const total = await kv.incrby(key, units);
    if (total <= units) {
      // First write of the day — arm the TTL so the key self-cleans.
      await kv.expire(key, KEY_TTL_SECONDS);
    }
    if (total > dailyCap()) {
      return { allowed: false, retryAfterSeconds: secondsUntilNextUtcDay(now) };
    }
    return { allowed: true };
  } catch (err) {
    console.warn("[spendGuard] KV unreachable, using in-memory bucket:", err);
    return takeFromBucket(
      globalFallbackBucket,
      units,
      FALLBACK_CAPACITY_UNITS,
      FALLBACK_REFILL_UNITS_PER_HOUR,
    );
  }
}

/**
 * 503 for a spent daily budget. `error` carries the human-readable copy
 * because every AI client (useAIImprove, useJdMatch, useBulletRewrite,
 * UploadDropzone) renders `data.error` for non-429 failures; `message` /
 * `supportUrl` / `retryAfter` mirror the 429 shape for any consumer that
 * reads those instead.
 */
export function spendCapResponse(retryAfterSeconds: number) {
  const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  const friendly =
    "Our free AI tools are in unusually high demand and have hit today's " +
    "overall usage limit. Please try again later — the limit resets daily. " +
    "If you'd like to help cover AI costs, tips via Ko-fi are appreciated.";
  return NextResponse.json(
    {
      error: friendly,
      message: friendly,
      supportUrl: SUPPORT_URL,
      retryAfter: safeRetryAfter,
    },
    { status: 503, headers: { "Retry-After": String(safeRetryAfter) } },
  );
}

// --- Per-IP in-memory fallback (all four AI routes) ---
//
// Used when an Upstash per-IP limiter is unreachable OR times out. Called from
// lib/server/rateLimit.ts on behalf of every AI route — not just parse, which
// was the only route with any fallback at all before 2026-08-02. Roughly
// mirrors the KV windows (3 burst / 15 per 24h) as a token bucket: capacity 3,
// refilling at 15 tokens per 24h. Per instance, so it's looser than the real
// limiter — but bounded, which is the point.

const PER_IP_CAPACITY = 3;
const PER_IP_REFILL_PER_HOUR = 15 / 24;
const PER_IP_MAX_ENTRIES = 5000; // memory bound; oldest entries evicted

const perIpBuckets = new Map<string, Bucket>();

export function takePerIpFallback(ip: string): SpendVerdict {
  let bucket = perIpBuckets.get(ip);
  if (!bucket) {
    if (perIpBuckets.size >= PER_IP_MAX_ENTRIES) {
      // Map preserves insertion order — drop the oldest entry.
      const oldest = perIpBuckets.keys().next().value;
      if (oldest !== undefined) perIpBuckets.delete(oldest);
    }
    bucket = { tokens: PER_IP_CAPACITY, lastRefillMs: Date.now() };
    perIpBuckets.set(ip, bucket);
  }
  return takeFromBucket(
    bucket,
    1,
    PER_IP_CAPACITY,
    PER_IP_REFILL_PER_HOUR,
  );
}
