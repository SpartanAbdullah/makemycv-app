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
import { parseCoverLetterRequest, type CoverLetterRequest } from "@/lib/coverLetter/payload";
import { normalizePlaceholders } from "@/lib/ai/placeholders";

/**
 * Cover letter v1 (2026-10-24, audit WP-9 — product #2 in CLAUDE.md).
 *
 * Privacy: receives an EXCERPT of the CV (lib/coverLetter/payload.ts says
 * exactly which fields: headline, summary, latest role + ≤4 bullets, ≤12
 * skill names, visa/availability) plus the job details the user typed. No
 * contact details, no photo. Processed transiently; not persisted or logged.
 * The page discloses this list before the user clicks Generate, and the
 * privacy policy on www names the feature.
 *
 * Truthfulness: the same contract as rewrite-bullet / ai-improve — only facts
 * from the excerpt and the job ad; {{number}} where a figure would help; the
 * UI refuses to export a letter that still carries a placeholder.
 *
 * Mirrors the other Claude routes: server-only key, per-IP windows with their
 * own prefix (mmcv_cl_*), global spend cap (1 unit), fence-tolerant parse.
 */

const SUPPORT_URL = "https://www.makemycv.ae/support";

const limits = {
  daily: makeLimiter({
    limiter: Ratelimit.slidingWindow(6, "24 h"),
    prefix: "mmcv_cl_daily",
  }),
  burst: makeLimiter({
    limiter: Ratelimit.slidingWindow(2, "60 s"),
    prefix: "mmcv_cl_burst",
  }),
};

function rateLimitedResponse(retryAfterSeconds: number) {
  const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    {
      error: "rate_limited",
      message:
        "You've used your cover letters for now. They reset gradually. " +
        "If you'd like to help cover AI costs, tips via Ko-fi are appreciated.",
      supportUrl: SUPPORT_URL,
      retryAfter: safeRetryAfter,
    },
    { status: 429, headers: { "Retry-After": String(safeRetryAfter) } },
  );
}

const SYSTEM_PROMPT =
  "You write cover letters for job seekers in the UAE. You are an editor of " +
  "the candidate's own material, not an author of new facts.\n\n" +
  "TRUTHFULNESS OVERRIDES EVERYTHING. The ONLY facts you may state about the " +
  "candidate are those in the CV EXCERPT you are given. You must NEVER invent " +
  "numbers, metrics, team sizes, years of experience, tools, systems, " +
  "certifications, clients, projects, employers, degrees or outcomes. Where a " +
  "figure would strengthen a sentence and the excerpt does not contain it, " +
  "write the literal placeholder {{number}} and nothing else — the candidate " +
  "fills it in. Do not claim the candidate meets a requirement unless the " +
  "excerpt shows it; it is fine to leave requirements unaddressed.\n\n" +
  "Style: UAE business English, direct, warm, no clichés ('I am writing to " +
  "apply', 'passionate', 'dynamic'), no bullet points, no headings. 3 short " +
  "paragraphs (opening with the role and company; evidence from the latest " +
  "role and skills that match the job; availability/visa line if present and " +
  "a one-sentence close). 150–230 words. Third-person facts, first-person " +
  "voice ('I led…'). Address the hiring manager by name if given, otherwise " +
  "'Dear Hiring Manager'. Sign off with the candidate's first name only.\n\n" +
  "OUTPUT: respond ONLY with a JSON object {\"letter\": \"...\"} where letter " +
  "is plain text with blank lines between paragraphs. No markdown, no commentary.";

function buildUser(req: CoverLetterRequest): string {
  const cv = req.cv;
  const role = cv.latestRole
    ? `Latest role: ${cv.latestRole.title || "(no title)"} at ${cv.latestRole.company || "(no company)"}` +
      (cv.latestRole.period ? ` (${cv.latestRole.period})` : "") +
      (cv.latestRole.bullets.length ? `\nWhat they did there:\n- ${cv.latestRole.bullets.join("\n- ")}` : "")
    : "Latest role: (none listed)";
  return (
    `Write a cover letter for this application.\n\n` +
    `TARGET ROLE: ${req.jobTitle}\nCOMPANY: ${req.company}\n` +
    (req.hiringManager ? `HIRING MANAGER: ${req.hiringManager}\n` : "") +
    (req.jobText ? `\nJOB AD (for what the employer wants — NOT a source of facts about the candidate):\n${req.jobText}\n` : "") +
    `\nCV EXCERPT (the ONLY source of facts about the candidate):\n` +
    `First name: ${cv.firstName || "(unknown)"}\n` +
    (cv.headline ? `Headline: ${cv.headline}\n` : "") +
    (cv.summary ? `Summary: ${cv.summary}\n` : "") +
    `${role}\n` +
    (cv.skills.length ? `Skills: ${cv.skills.join(", ")}\n` : "") +
    (cv.visaStatus ? `Visa status: ${cv.visaStatus}\n` : "") +
    (cv.availability ? `Availability: ${cv.availability}\n` : "") +
    `\nReturn only the JSON object.`
  );
}

function extractLetter(text: string): string | null {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as { letter?: unknown };
    return typeof obj.letter === "string" && obj.letter.trim().length > 80 ? obj.letter.trim() : null;
  } catch {
    return null;
  }
}

async function callHaiku(apiKey: string, req: CoverLetterRequest): Promise<string> {
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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUser(req) }],
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
      return NextResponse.json({ error: "API not configured" }, { status: 500 });
    }

    const ip = getClientIp(request);
    const throttle = await checkRateLimit(ip, limits);
    if (!throttle.allowed) return rateLimitedResponse(throttle.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const req = parseCoverLetterRequest(body);
    if (!req) {
      return NextResponse.json(
        { error: "Add the company and job title, and make sure your CV has at least a role, a summary or some skills." },
        { status: 400 },
      );
    }

    const spend = await takeSpendUnits(1);
    if (!spend.allowed) return spendCapResponse(spend.retryAfterSeconds);

    let letter: string | null = null;
    let apiFailed = false;
    for (let attempt = 0; attempt < 2 && letter === null; attempt++) {
      try {
        const raw = await callHaiku(apiKey, req);
        apiFailed = false;
        letter = extractLetter(raw);
      } catch (err) {
        // A timeout is not retried: the user has already waited 25 s, and a
        // second attempt would double that behind the same spinner.
        if (isTimeoutError(err)) {
          return NextResponse.json(UPSTREAM_TIMEOUT_BODY, { status: UPSTREAM_TIMEOUT_STATUS });
        }
        apiFailed = true;
      }
    }
    if (letter === null) {
      return NextResponse.json(
        { error: apiFailed ? "Couldn't reach the writing service. Please try again." : "Couldn't write a letter from this. Try adding a summary or a role to your CV." },
        { status: 502 },
      );
    }
    return NextResponse.json({ letter: normalizePlaceholders(letter) });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
