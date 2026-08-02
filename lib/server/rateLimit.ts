// Shared per-IP rate limiting for the four Claude-proxy routes.
// (2026-08-02 — audit A hardening, findings A-W3-001 / A-W2-001 / A-W1-019.)
//
// Replaces four near-identical copies of getClientIp() and eight inline
// Ratelimit constructions. Two independent defects lived in those copies:
//
// 1. PRIVACY — all eight constructors set `analytics: true`. @upstash/ratelimit
//    asks @upstash/core-analytics for `retention: "90d"`, but core-analytics
//    0.0.10 never reads that option: its `ingest` is a bare ZINCRBY with no
//    EXPIRE (`grep -c expire` over its dist returns 0). The identifier it
//    records is the raw client IP. So every rate-limited request was writing a
//    personal identifier into KV *permanently*, contradicting the privacy
//    policy's "held briefly in short-lived storage" and granting an erasure
//    right the code could not service. Nothing in the product ever read that
//    data back. Analytics is OFF here and must stay off — if you ever want the
//    metrics, add a scheduled purge and update the policy in the same PR.
//
// 2. FAIL-OPEN — @upstash/ratelimit@2 defaults to `timeout: 5000` and, when it
//    expires, RESOLVES `{ success: true, reason: "timeout", reset: 0 }`. It
//    does not throw. A try/catch around .limit() therefore never fired on the
//    single most likely KV failure mode (slow, not refused), and every per-IP
//    window silently passed for the duration of an Upstash slowdown. Worse,
//    @upstash/redis retries 5 times with exponential backoff (~4.29s of sleeps)
//    before it would throw at all, so the 5s race almost always resolved into
//    the fail-open first. parse/route.ts had a carefully written fallback that
//    was dead code for exactly the scenario it was written for.
//
// The fix is not "catch harder": it is to stop treating a timeout as success.
// `reason === "timeout"` is now LIMITER UNAVAILABLE, and both that and a thrown
// error degrade to the bounded in-memory per-IP bucket in spendGuard — the same
// fail-closed-with-degradation posture takeSpendUnits already uses.
//
// NOTE on `reset`: on the timeout path the library returns `reset: 0`, not a
// real timestamp. Never compute Retry-After from `reset` without checking
// success first — `reset - Date.now()` goes hugely negative.

import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { takePerIpFallback, type SpendVerdict } from "./spendGuard";

/** Limiter algorithm, e.g. Ratelimit.slidingWindow(10, "24 h"). */
type Limiter = ConstructorParameters<typeof Ratelimit>[0]["limiter"];

// Shorter than the library's 5s default: Upstash round-trips are normally well
// under 100ms, so 3s already means "something is wrong" and we would rather
// degrade to the local bucket than hold the request open.
const LIMITER_TIMEOUT_MS = 3000;

/**
 * Client IP for per-IP windows.
 *
 * KNOWN LIMITATION (audit A-W2-004, open question A1): this reads the FIRST
 * x-forwarded-for entry. That is correct only if the platform overwrites the
 * header rather than appending to a client-supplied one. If Vercel appends,
 * this value is attacker-controlled and every per-IP window here is bypassable
 * with a random XFF per request. Settle it by echoing x-forwarded-for,
 * x-real-ip and x-vercel-forwarded-for from a scratch route with a forged
 * header; if the forged value comes back first, switch to the last XFF entry
 * or to x-vercel-forwarded-for.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // Local dev / no proxy — fall back to a stable string so the window still works.
  return "anon";
}

/**
 * Build a per-IP limiter. Always `analytics: false` (see header) and always an
 * explicit timeout, so the library's fail-open default can never be inherited
 * by a future route that forgets to pass one.
 */
export function makeLimiter(config: { limiter: Limiter; prefix: string }): Ratelimit {
  return new Ratelimit({
    redis: kv,
    limiter: config.limiter,
    analytics: false,
    prefix: config.prefix,
    timeout: LIMITER_TIMEOUT_MS,
  });
}

/** The burst (anti-hammer) + daily (slow drip) pair every AI route runs. */
export type RateLimitWindows = { burst: Ratelimit; daily: Ratelimit };

type WindowOutcome =
  | { kind: "allowed" }
  | { kind: "limited"; resetAtMs: number }
  | { kind: "unavailable" };

async function runWindow(limiter: Ratelimit, ip: string): Promise<WindowOutcome> {
  let result;
  try {
    result = await limiter.limit(ip);
  } catch (err) {
    console.warn("[rateLimit] limiter threw, degrading to in-memory bucket:", err);
    return { kind: "unavailable" };
  }

  // `reason` is populated on the non-consuming paths. "timeout" is the one that
  // resolves as success — treat it as an outage, not as permission.
  const reason = (result as { reason?: string }).reason;
  if (reason === "timeout") {
    console.warn("[rateLimit] limiter timed out, degrading to in-memory bucket");
    return { kind: "unavailable" };
  }

  if (!result.success) return { kind: "limited", resetAtMs: result.reset };
  return { kind: "allowed" };
}

/**
 * Run both windows for `ip`, degrading to the bounded in-memory per-IP bucket
 * when the limiter is unreachable or slow.
 *
 * Returns the same shape as spendGuard's verdicts so callers can treat a
 * throttle and a spend cap identically. Callers own their own 429 copy — the
 * four routes deliberately say different things.
 */
export async function checkRateLimit(
  ip: string,
  windows: RateLimitWindows,
): Promise<SpendVerdict> {
  // Burst first — cheaper to reject, smaller window.
  for (const limiter of [windows.burst, windows.daily]) {
    const outcome = await runWindow(limiter, ip);

    if (outcome.kind === "limited") {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((outcome.resetAtMs - Date.now()) / 1000),
        ),
      };
    }

    if (outcome.kind === "unavailable") {
      // One bounded local decision covers both windows — do not charge the
      // bucket twice for a single request.
      return takePerIpFallback(ip);
    }
  }

  return { allowed: true };
}
