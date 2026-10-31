import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { spendCapResponse, takeSpendUnits } from "@/lib/server/spendGuard";
import {
  CLAUDE_EFFORT,
  CLAUDE_MODEL,
  UPSTREAM_TIMEOUT_BODY,
  UPSTREAM_TIMEOUT_STATUS,
  anthropicSignal,
  isTimeoutError,
  responseText,
} from "@/lib/server/anthropic";
import { checkRateLimit, getClientIp, makeLimiter } from "@/lib/server/rateLimit";
import {
  MESSAGE_WORDS,
  parseLinkedinMessageRequest,
  type LinkedinMessageRequest,
} from "@/lib/linkedinMessage/payload";
import {
  LINKEDIN_SYSTEM_PROMPT,
  buildLinkedinUserPrompt,
  parseLinkedinModelOutput,
  type LinkedinModelOutcome,
} from "@/lib/linkedinMessage/prompt";
import { trimToWordLimit } from "@/lib/linkedinMessage/length";

/**
 * LinkedIn recruiter message (2026-10-31 — product #3 in CLAUDE.md).
 *
 * Privacy: receives a SMALL EXCERPT of the CV (lib/linkedinMessage/payload.ts
 * says exactly which fields: headline, latest role + ≤2 bullets, ≤3 skill
 * names, visa/availability) plus the job / recruiter text the user pasted.
 * No name, no contact details, no photo, no summary. Processed transiently;
 * not persisted or logged. The page discloses this list before the user
 * clicks Generate, and the privacy policy on www names the feature.
 *
 * Truthfulness: the same contract as the cover letter — only facts from the
 * excerpt; {{number}} where a figure would help; the UI refuses to copy a
 * message that still carries a placeholder. REFUSAL IS A VALID OUTPUT: when
 * the paste is not a job / recruiter context the model declines and this
 * route answers 422 so the UI can say so plainly.
 *
 * Mirrors the cover-letter route: server-only key, per-IP windows with their
 * own prefix (mmcv_li_*), global spend cap (1 unit), fence-tolerant parse.
 */

const SUPPORT_URL = "https://www.makemycv.ae/support";

const limits = {
  daily: makeLimiter({
    limiter: Ratelimit.slidingWindow(6, "24 h"),
    prefix: "mmcv_li_daily",
  }),
  burst: makeLimiter({
    limiter: Ratelimit.slidingWindow(2, "60 s"),
    prefix: "mmcv_li_burst",
  }),
};

function rateLimitedResponse(retryAfterSeconds: number) {
  const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    {
      error: "rate_limited",
      message:
        "You've used your LinkedIn messages for now. They reset gradually. " +
        "If you'd like to help cover AI costs, tips via Ko-fi are appreciated.",
      supportUrl: SUPPORT_URL,
      retryAfter: safeRetryAfter,
    },
    { status: 429, headers: { "Retry-After": String(safeRetryAfter) } },
  );
}

async function callHaiku(apiKey: string, req: LinkedinMessageRequest): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      output_config: { effort: CLAUDE_EFFORT },
      system: LINKEDIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildLinkedinUserPrompt(req) }],
    }),
    signal: anthropicSignal(),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown API error");
    throw new Error(`Anthropic API error: ${res.status} — ${errText}`);
  }
  return responseText(await res.json());
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "replace_with_your_key") {
      return NextResponse.json({ error: "This feature is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const ip = getClientIp(request);
    const throttle = await checkRateLimit(ip, limits);
    if (!throttle.allowed) return rateLimitedResponse(throttle.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const req = parseLinkedinMessageRequest(body);
    if (!req) {
      return NextResponse.json(
        {
          error:
            "Paste the job ad or the recruiter's message (a few sentences at least), and make sure your CV has a role, a headline or some skills.",
        },
        { status: 400 },
      );
    }

    const spend = await takeSpendUnits(1);
    if (!spend.allowed) return spendCapResponse(spend.retryAfterSeconds);

    let outcome: LinkedinModelOutcome | null = null;
    let apiFailed = false;
    for (let attempt = 0; attempt < 2 && outcome === null; attempt++) {
      try {
        const raw = await callHaiku(apiKey, req);
        apiFailed = false;
        outcome = parseLinkedinModelOutput(raw, req.variant);
      } catch (err) {
        // A timeout is not retried — the user has already waited 25 s.
        if (isTimeoutError(err)) {
          return NextResponse.json(UPSTREAM_TIMEOUT_BODY, { status: UPSTREAM_TIMEOUT_STATUS });
        }
        apiFailed = true;
      }
    }
    if (outcome === null) {
      return NextResponse.json(
        {
          error: apiFailed
            ? "Couldn't reach the writing service. Please try again."
            : "Couldn't write a message from this. Try pasting more of the job ad, or add a role to your CV.",
        },
        { status: 502 },
      );
    }
    if (outcome.kind === "refusal") {
      // An honest decline, not an error: the paste did not read as a job or a
      // recruiter's message, so there is nothing truthful to reply to.
      return NextResponse.json(
        {
          error: "refused",
          message:
            "This doesn't read as a job ad or a recruiter's message, so there's nothing to reply to. " +
            "Paste the role description or the note the recruiter sent you.",
          reason: outcome.reason,
        },
        { status: 422 },
      );
    }
    // Length enforcement (backlog E5). The brief is 60–90 words and the model
    // overshot it in both e2e runs (101, 102). The prompt now states 90 as a
    // hard ceiling; when a draft still runs over, it is cut here at a sentence
    // boundary (never inside "2.5" or "AED 1.2M") and the response says so
    // (`outcome: "trimmed"`) so the UI can flag it and analytics can count it.
    // No second model call: it would double latency and spend for one unit.
    let text = outcome.text;
    let lengthOutcome: "ok" | "trimmed" = "ok";
    if (req.variant === "message") {
      const cut = trimToWordLimit(text, MESSAGE_WORDS.max);
      text = cut.text;
      if (cut.trimmed) lengthOutcome = "trimmed";
    }
    return NextResponse.json({ message: text, variant: req.variant, outcome: lengthOutcome });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
