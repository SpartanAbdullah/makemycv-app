// POST /api/resume-checker/parse
// application/json { rawText: string, fileName?: string }  →  { reportId }
//
// PDF text is extracted client-side (see components/resume-checker/UploadDropzone
// and lib/importers/pdfAdapter.extractPdfTextInBrowser). This route only sees
// plain text, so it stays lightweight and avoids server-side pdfjs which is
// brittle under Next.js Turbopack.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { parseCvText } from "@/lib/resumeChecker/parse";
import { computeScore } from "@/lib/scoreEngine";
import { saveReport } from "@/lib/resumeChecker/storage";
import {
  PARSE_SPEND_UNITS,
  spendCapResponse,
  takePerIpFallback,
  takeSpendUnits,
} from "@/lib/server/spendGuard";
import type { StoredReport } from "@/lib/resumeChecker/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 100_000;
const MIN_TEXT_LENGTH = 200;

// Per-IP rate limits (2026-06 audit): this route proxies a paid Claude call
// per request and was the only AI endpoint with NO throttle — an open abuse
// vector on the server's Anthropic key. Mirrors /api/ai-improve's pattern:
// burst window (anti-hammer) + daily window (slow drip). Limits are looser
// than ai-improve's because one check = one report a human reads.
const dailyLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(15, "24 h"),
  analytics: true,
  prefix: "mmcv_parse_daily",
});

const burstLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, "60 s"),
  analytics: true,
  prefix: "mmcv_parse_burst",
});

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anon";
}

function rateLimitedResponse(resetAtMs: number, requestId: string) {
  const retryAfter = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
  return NextResponse.json(
    {
      error:
        "You've checked several CVs recently — the checker is rate-limited to keep it free for everyone. Please try again in a little while.",
      requestId,
      retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  const requestId = nanoid(10);

  // Rate limit first — before any parsing work. When KV is unreachable
  // (local dev without env vars, Upstash hiccup) this used to fail OPEN,
  // which left the single most expensive Claude route unlimited exactly when
  // the throttle infrastructure was down. Now it degrades to a bounded
  // in-memory per-IP bucket (lib/server/spendGuard) instead — the free tool
  // keeps working through hiccups, but never unmetered.
  const ip = getClientIp(request);
  try {
    const burst = await burstLimit.limit(ip);
    if (!burst.success) return rateLimitedResponse(burst.reset, requestId);
    const daily = await dailyLimit.limit(ip);
    if (!daily.success) return rateLimitedResponse(daily.reset, requestId);
  } catch (err) {
    console.warn("[parse] rate limiter unavailable, in-memory fallback:", err);
    const fallback = takePerIpFallback(ip);
    if (!fallback.allowed) {
      return rateLimitedResponse(
        Date.now() + fallback.retryAfterSeconds * 1000,
        requestId,
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", requestId },
      { status: 400 },
    );
  }

  const rawText =
    body && typeof body === "object" && "rawText" in body
      ? (body as { rawText: unknown }).rawText
      : undefined;

  if (typeof rawText !== "string" || rawText.length === 0) {
    return NextResponse.json(
      { error: "No text provided", requestId },
      { status: 400 },
    );
  }

  if (rawText.length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error:
          "CV text is too short. If your PDF is a scanned image, export a text-based version.",
        requestId,
      },
      { status: 422 },
    );
  }

  if (rawText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `CV text is too long. Maximum is ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
        requestId,
      },
      { status: 400 },
    );
  }

  // Global daily spend cap — after the per-IP limiter (per-IP 429s win) and
  // after text validation (bad uploads never burn budget). This route sends
  // up to 100k chars with max_tokens 4096 — by far the most expensive Claude
  // call in the app — so it charges 3 units against the shared daily budget.
  const spend = await takeSpendUnits(PARSE_SPEND_UNITS);
  if (!spend.allowed) return spendCapResponse(spend.retryAfterSeconds);

  let result;
  try {
    result = await parseCvText(rawText);
  } catch (err) {
    const e = err as { kind?: string; message?: string };
    if (e?.kind === "too-short") {
      return NextResponse.json(
        {
          error:
            "We couldn't read enough text from this CV. Try a different PDF.",
          requestId,
        },
        { status: 422 },
      );
    }
    if (e?.kind === "claude-failed") {
      return NextResponse.json(
        {
          error:
            "Our parser had trouble with this CV. Please try again in a minute.",
          requestId,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "Unexpected error while parsing.", requestId },
      { status: 500 },
    );
  }

  const { cv, parseSignals, rawText: storedRawText } = result;
  const score = computeScore(cv, { mode: "checker", parseSignals });

  const reportId = nanoid(16);
  const createdAt = Date.now();
  const stored: StoredReport = {
    cv,
    parseSignals,
    score,
    createdAt,
    rawText: storedRawText, // server-only — never returned to client
  };

  try {
    await saveReport(reportId, stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage error";
    return NextResponse.json(
      { error: `Couldn't save the report: ${message}`, requestId },
      { status: 500 },
    );
  }

  return NextResponse.json({ reportId });
}
