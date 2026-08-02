// GET /api/health — liveness + dependency check for uptime monitoring.
// (2026-08-02, audit A-W5-027: nothing verified a deploy after it went live.)
//
// Monitoring the homepage only proves Vercel is serving HTML — which stays
// true while KV is down and every AI route is 500ing. This endpoint checks the
// one dependency whose failure is invisible from the outside: Vercel KV backs
// both the report store and every rate limiter, so when it is unreachable the
// checker breaks and the spend guard falls back to its bounded local bucket.
//
// Contract for the monitor:
//   200 {"status":"ok"}       — serving, KV reachable
//   503 {"status":"degraded"} — serving, KV NOT reachable (alert on this)
//
// Deliberately returns NO version, commit SHA, env var names or error details.
// This route is public and unauthenticated; an uptime probe needs a status
// code, not a description of your infrastructure.

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
// Never cached — a cached "ok" would hide an outage for the cache's lifetime,
// which is the exact failure this endpoint exists to catch.
export const dynamic = "force-dynamic";

const KV_TIMEOUT_MS = 3000;

export async function GET() {
  const kvConfigured = Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );

  if (!kvConfigured) {
    // Local dev without KV env vars. Not a production signal, so don't alert.
    return NextResponse.json(
      { status: "ok", kv: "not-configured" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let kvOk = false;
  try {
    // Bounded: without a race, an unreachable KV would hang this request until
    // the platform timeout and the monitor would report a timeout rather than
    // a clean "degraded".
    await Promise.race([
      kv.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("kv-timeout")), KV_TIMEOUT_MS),
      ),
    ]);
    kvOk = true;
  } catch {
    kvOk = false;
  }

  return NextResponse.json(
    { status: kvOk ? "ok" : "degraded", kv: kvOk ? "ok" : "unreachable" },
    {
      status: kvOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
