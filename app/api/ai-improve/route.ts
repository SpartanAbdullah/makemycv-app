import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { spendCapResponse, takeSpendUnits } from "@/lib/server/spendGuard";
import {
  ANTHROPIC_TIMEOUT_MS,
  CLAUDE_EFFORT,
  CLAUDE_MODEL,
  UPSTREAM_TIMEOUT_BODY,
  UPSTREAM_TIMEOUT_STATUS,
  anthropicSignal,
  isTimeoutError,
} from "@/lib/server/anthropic";
import {
  checkRateLimit,
  getClientIp,
  makeLimiter,
} from "@/lib/server/rateLimit";
import { clipImproveInput } from "@/lib/ai/improveInput";
import { buildImprovePrompt, type ImproveType } from "@/lib/ai/improvePrompt";
import { askWithOneRetry, readImproveReply, type ImproveReply } from "@/lib/ai/improveReply";
import { NOTHING_TO_SUGGEST, nothingToSuggestMessage } from "@/lib/ai/improveOutcome";
import { logAiFailure } from "@/lib/server/logRouteError";

const ROUTE = "api/ai-improve";

type AIType = ImproveType;

type RequestBody = {
  type: AIType;
  jobTitle?: string;
  company?: string;
  existingBullets?: string[];
  headline?: string;
  experienceRoles?: { title: string; company: string; bullets: string[] }[];
  existingSkills?: string[];
  existingSummary?: string;
  // Job field (Phase 1 personalization). Adds a FIELD CONTEXT paragraph after
  // the rules of the system prompt; see lib/ai/improvePrompt.ts, which holds
  // all three prompts.
  domain?: string;
};

const SUPPORT_URL = "https://www.makemycv.ae/support";

// Per-IP rate limits backed by the same Upstash instance that powers @vercel/kv.
// Two windows compose: daily (slow drip) + burst (anti-hammer).
const limits = {
  daily: makeLimiter({
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    prefix: "mmcv_ai_daily",
  }),
  burst: makeLimiter({
    limiter: Ratelimit.slidingWindow(3, "60 s"),
    prefix: "mmcv_ai_burst",
  }),
};

function rateLimitedResponse(retryAfterSeconds: number) {
  const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    {
      error: "rate_limited",
      message:
        "You've used your AI improvements for now. They reset gradually. " +
        "If you'd like to help cover AI costs, tips via Ko-fi are appreciated.",
      supportUrl: SUPPORT_URL,
      retryAfter: safeRetryAfter,
    },
    {
      status: 429,
      headers: { "Retry-After": String(safeRetryAfter) },
    },
  );
}

// A second attempt is only worth starting with this much of the 25 s budget
// left: these prompts answer in single-digit seconds, and the user is
// watching a spinner.
const RETRY_MIN_BUDGET_MS = 8_000;

type Attempt = ImproveReply | { kind: "upstream" };

/** One Messages API call, read into what it means for the user. */
async function askModel(
  apiKey: string,
  system: string,
  user: string,
  timeoutMs: number,
): Promise<Attempt> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      output_config: { effort: CLAUDE_EFFORT },
      system,
      messages: [{ role: "user", content: user }],
    }),
    // Bounded: a stalled upstream answers 504 in 25 s instead of holding
    // the user's spinner until the platform kills the function.
    signal: anthropicSignal(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown API error");
    // The upstream body goes to the log, not to the browser: it used to be
    // returned verbatim, which showed users Anthropic's internal error text.
    logAiFailure(ROUTE, "upstream", new Error(`Anthropic API error: ${res.status} — ${errText}`));
    return { kind: "upstream" };
  }

  // A body that is not JSON reads as `unusable`, like any other bad reply.
  return readImproveReply(await res.json().catch(() => null));
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "replace_with_your_key") {
      return NextResponse.json(
        { error: "API not configured" },
        { status: 500 },
      );
    }

    // Burst window first, then daily — and when Upstash is slow or unreachable,
    // a bounded in-memory bucket rather than a silent pass. See
    // lib/server/rateLimit.ts for why a timeout is NOT treated as success.
    const ip = getClientIp(request);
    const throttle = await checkRateLimit(ip, limits);
    if (!throttle.allowed) {
      return rateLimitedResponse(throttle.retryAfterSeconds);
    }

    const body = (await request.json()) as RequestBody;

    if (!body.type || !["bullets", "skills", "summary"].includes(body.type)) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 },
      );
    }

    // Bounded before spend is charged: the 1 unit below only limits tokens if
    // the prompt really is small. See lib/ai/improveInput.ts.
    const input = { type: body.type, domain: body.domain, ...clipImproveInput(body) };

    // Global daily spend cap — checked AFTER the per-IP windows (so hammering
    // users still see the friendlier 429) and after validation (so malformed
    // requests never burn budget). 1 unit: small prompt, max_tokens 2048.
    const spend = await takeSpendUnits(1);
    if (!spend.allowed) return spendCapResponse(spend.retryAfterSeconds);

    const { system, user } = buildImprovePrompt(input);

    // One retry when the reply could not be read (cut off, prose instead of
    // JSON). A refusal or an empty list is an answer, not a fault, and is not
    // asked again. Both attempts share the one 25 s budget, and the second is
    // charged to the spend guard like any other call — if the cap says no,
    // the first reply stands. Until 2026-11 every one of these reached the
    // user as a bare server error (product audit A9).
    const startedAt = Date.now();
    const remainingMs = () => ANTHROPIC_TIMEOUT_MS - (Date.now() - startedAt);
    const attempt = await askWithOneRetry<Attempt>(
      (n) => askModel(apiKey, system, user, n === 1 ? ANTHROPIC_TIMEOUT_MS : remainingMs()),
      async () => remainingMs() >= RETRY_MIN_BUDGET_MS && (await takeSpendUnits(1)).allowed,
    );

    if (attempt.kind === "upstream") {
      return NextResponse.json(
        { error: "Couldn't reach the writing service. Please try again." },
        { status: 502 },
      );
    }

    if (attempt.kind === "results") {
      return NextResponse.json({ results: attempt.results, type: body.type });
    }

    // Declined, or unreadable twice: say so plainly. 422 — the request was
    // understood and there is nothing to return for it. The hook shows the
    // message as a neutral note with a retry, not as an error.
    if (attempt.kind === "unusable") logAiFailure(ROUTE, "unparseable");
    return NextResponse.json(
      { error: NOTHING_TO_SUGGEST, message: nothingToSuggestMessage(body.type) },
      { status: 422 },
    );
  } catch (err) {
    if (isTimeoutError(err)) {
      logAiFailure(ROUTE, "timeout");
      return NextResponse.json(UPSTREAM_TIMEOUT_BODY, { status: UPSTREAM_TIMEOUT_STATUS });
    }
    logAiFailure(ROUTE, "internal", err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Nothing was lost — please try again." },
      { status: 500 },
    );
  }
}
