import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import type { JdRequirements } from "@/lib/jdMatch/types";

/**
 * JD Match extraction endpoint (Phase A, free diagnosis).
 *
 * Privacy: receives ONLY the pasted job-description text. The CV never reaches
 * this route — matching happens client-side. JD text is processed transiently
 * and NOT persisted or logged. See docs/jd-match-spec.md.
 *
 * Mirrors /api/ai-improve: server-only key, same per-IP Upstash windows,
 * markdown-fence-tolerant JSON parsing, one retry on invalid JSON.
 */

const SUPPORT_URL = "https://www.makemycv.ae/support";
const MAX_JD_CHARS = 12000; // guard against pasting a whole careers page

const dailyLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
  analytics: true,
  prefix: "mmcv_jd_daily",
});

const burstLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, "60 s"),
  analytics: true,
  prefix: "mmcv_jd_burst",
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

function rateLimitedResponse(retryAfterSeconds: number) {
  const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    {
      error: "rate_limited",
      message:
        "You've used your JD Match checks for now. They reset gradually. " +
        "If you'd like to help cover AI costs, tips via Ko-fi are appreciated.",
      supportUrl: SUPPORT_URL,
      retryAfter: safeRetryAfter,
    },
    { status: 429, headers: { "Retry-After": String(safeRetryAfter) } },
  );
}

const SYSTEM_PROMPT =
  "You are an ATS and recruitment expert for the UAE job market. You read a " +
  "job description and extract the concrete requirements an applicant tracking " +
  "system and recruiter will screen for. Extract only terms actually implied by " +
  "the JD — do not invent. Prefer specific terms (e.g. 'SAP FICO' not 'software'). " +
  "Respond ONLY with a single JSON object, no markdown, no commentary, with keys: " +
  "jobTitle (string), hardSkills (string[]), tools (string[]), certifications " +
  "(string[]), softSkills (string[]), keywords (string[]). Each array max 12 items, " +
  "each item max 5 words. keywords = important domain terms not already in the other " +
  "buckets. Where the JD states a requirement with a specific phrase, use that " +
  "phrase's exact wording from the text (so it can be located in the description).";

function buildUser(jobText: string): string {
  return (
    "Extract the requirements from this job description as the specified JSON object.\n\n" +
    "JOB DESCRIPTION:\n" +
    jobText +
    "\n\nReturn only the JSON object."
  );
}

const STRING_KEYS = [
  "hardSkills",
  "tools",
  "certifications",
  "softSkills",
  "keywords",
] as const;

function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Coerce arbitrary parsed JSON into a safe JdRequirements (defensive). */
function coerceRequirements(raw: unknown): JdRequirements {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 12)
      : [];
  const result: JdRequirements = {
    jobTitle: typeof obj.jobTitle === "string" ? obj.jobTitle.trim() : undefined,
    hardSkills: arr(obj.hardSkills),
    tools: arr(obj.tools),
    certifications: arr(obj.certifications),
    softSkills: arr(obj.softSkills),
    keywords: arr(obj.keywords),
  };
  return result;
}

function isEmpty(r: JdRequirements): boolean {
  return STRING_KEYS.every((k) => r[k].length === 0);
}

async function callHaiku(apiKey: string, jobText: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUser(jobText) }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown API error");
    throw new Error(`Anthropic API error: ${res.status} — ${errText}`);
  }
  const data = await res.json();
  return (data?.content?.[0]?.text as string) ?? "";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "replace_with_your_key") {
      return NextResponse.json({ error: "API not configured" }, { status: 500 });
    }

    const ip = getClientIp(request);

    const burst = await burstLimit.limit(ip);
    if (!burst.success) {
      return rateLimitedResponse((burst.reset - Date.now()) / 1000);
    }
    const daily = await dailyLimit.limit(ip);
    if (!daily.success) {
      return rateLimitedResponse((daily.reset - Date.now()) / 1000);
    }

    const body = (await request.json().catch(() => null)) as
      | { jobText?: unknown }
      | null;
    const jobText =
      typeof body?.jobText === "string" ? body.jobText.trim() : "";

    if (jobText.length < 40) {
      return NextResponse.json(
        { error: "Job description is too short to analyse." },
        { status: 400 },
      );
    }
    const clipped = jobText.slice(0, MAX_JD_CHARS);

    // First attempt + one retry on invalid/empty JSON (hardened parser).
    let requirements: JdRequirements | null = null;
    for (let attempt = 0; attempt < 2 && !requirements; attempt++) {
      try {
        const raw = await callHaiku(apiKey, clipped);
        const parsed = coerceRequirements(extractJsonObject(raw));
        if (!isEmpty(parsed)) requirements = parsed;
      } catch {
        // fall through to retry / final guard
      }
    }

    if (!requirements) {
      return NextResponse.json(
        { error: "Couldn't read that job description. Try pasting the full text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ requirements });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
