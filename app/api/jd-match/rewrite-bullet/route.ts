import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { spendCapResponse, takeSpendUnits } from "@/lib/server/spendGuard";

/**
 * JD Match Phase B — truthful single-bullet rewrite (Pro apply-fix).
 *
 * Privacy: receives ONLY one existing bullet + the keyword + the role title —
 * never the whole CV. Processed transiently; not persisted or logged. This
 * preserves the Phase A posture (the CV stays in the browser).
 *
 * Truthfulness is the product's core promise: the model may only re-word what
 * the bullet ALREADY describes to surface the keyword when genuinely
 * consistent. It must NEVER invent metrics, tools, employers, dates,
 * certifications, scope, or any claim not in the original. When the keyword
 * cannot be added truthfully it returns an empty array — which is a SUCCESS
 * here (200 with { variants: [] }), NOT an error like ai-improve treats it.
 *
 * Mirrors /api/ai-improve + /api/jd-match: server-only key, same per-IP Upstash
 * windows with a DISTINCT prefix (mmcv_jdfix_*), fence-tolerant JSON parse,
 * one retry on unparseable output, friendly 429 with Ko-fi support copy.
 */

const SUPPORT_URL = "https://www.makemycv.ae/support";
const MAX_BULLET_CHARS = 600;
const MAX_KEYWORD_CHARS = 80;
const MAX_ROLE_CHARS = 120;

const dailyLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
  analytics: true,
  prefix: "mmcv_jdfix_daily",
});

const burstLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, "60 s"),
  analytics: true,
  prefix: "mmcv_jdfix_burst",
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
        "You've used your bullet rewrites for now. They reset gradually. " +
        "If you'd like to help cover AI costs, tips via Ko-fi are appreciated.",
      supportUrl: SUPPORT_URL,
      retryAfter: safeRetryAfter,
    },
    { status: 429, headers: { "Retry-After": String(safeRetryAfter) } },
  );
}

const SYSTEM_PROMPT =
  "You are an expert CV editor for the UAE job market. Your ONLY job is to " +
  "re-word ONE existing CV bullet so a keyword a job description screens for " +
  "surfaces naturally — but ONLY when the bullet ALREADY describes the " +
  "experience that keyword refers to. You are an editor, not an author.\n\n" +
  "YOUR DEFAULT ANSWER IS AN EMPTY ARRAY: []. Start from the assumption that " +
  "the keyword CANNOT be added truthfully. Only move off that default if the " +
  "bullet's own words unambiguously already demonstrate the keyword. When in " +
  "doubt, return [].\n\n" +
  "TRUTHFULNESS OVERRIDES EVERYTHING. A rewrite that reads well but adds a fact " +
  "the candidate never stated is a failure, not a success. You may only " +
  "re-express what the original bullet already contains. The role title is " +
  "context for tone only — never a source of facts.\n\n" +
  "You must NEVER introduce any of these unless the exact fact is already in " +
  "the original bullet:\n" +
  "1. numbers, metrics, percentages, money, quantities, or 'X+ years'\n" +
  "2. tools, software, platforms, systems, technologies, or methodologies\n" +
  "3. employers, clients, brands, companies, or project names\n" +
  "4. dates, durations, timeframes, or tenure\n" +
  "5. certifications, licences, degrees, or qualifications\n" +
  "6. team sizes, headcounts, or people managed\n" +
  "7. responsibilities, scope, seniority, outcomes, or results not stated\n\n" +
  "Certifications and named tools are especially dangerous: a task bullet is " +
  "never evidence the candidate holds a certification or used a specific named " +
  "system. If the keyword is a certification/licence, or a specific tool the " +
  "bullet does not name, return [].\n\n" +
  "Surfacing the keyword is allowed ONLY when it is a faithful re-labelling of " +
  "something the bullet already describes (e.g. bullet 'coordinated suppliers " +
  "and tracked purchase orders', keyword 'procurement' is allowed — an honest " +
  "umbrella for that work). If the link is weak, aspirational, or uncertain, " +
  "return [].\n\n" +
  "EXAMPLES:\n" +
  "- bullet 'Resolved guest complaints to ensure satisfaction', keyword " +
  "'customer service' -> [\"Delivered strong customer service by resolving " +
  "guest complaints to ensure satisfaction.\"]\n" +
  "- bullet 'Greeted walk-in customers and arranged products on shelves', " +
  "keyword 'SAP ERP' -> []\n" +
  "- bullet 'Supported the marketing team with social media posts', keyword " +
  "'increased engagement by 40%' -> []\n\n" +
  "When you DO rewrite: produce 1 or 2 variants of the SAME bullet (never more " +
  "than 2), each preserving every fact and adding none, surfacing the keyword " +
  "naturally without keyword-stuffing. Where it reads naturally AND stays fully " +
  "truthful, use the keyword's own wording (recruiters and ATS search for that " +
  "exact term) rather than a loose paraphrase — but never distort a fact to fit " +
  "the phrase. Keep it one concise sentence, strong action verb, third person " +
  "(no 'I'/'my'), professional UAE-market tone.\n\n" +
  "OUTPUT — STRICT: respond with ONLY a JSON array of strings. No markdown, no " +
  "code fences, no commentary, no apology. Maximum 2 strings. If the keyword " +
  "cannot be surfaced truthfully, respond with exactly: []";

function buildUser(bullet: string, keyword: string, roleTitle: string): string {
  return (
    "Rewrite this ONE CV bullet so the keyword surfaces naturally — but ONLY if " +
    "the bullet already describes that experience. If it does not, return [].\n\n" +
    "ROLE TITLE (context for tone only — do NOT import facts from it): " +
    (roleTitle || "(not given)") +
    "\nKEYWORD the job description wants: " +
    keyword +
    "\nORIGINAL BULLET (the ONLY source of facts you may use): " +
    bullet +
    "\n\nReturn ONLY a JSON array of at most 2 truthful rewrites of this one " +
    "bullet, or [] if the keyword cannot be added without inventing anything."
  );
}

/**
 * Parse a JSON array of strings from the model text (markdown-fence tolerant).
 * Throws when no array is present (caller retries, then treats as no-rewrite).
 */
function extractStringArray(text: string): string[] {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("Not an array");
  return parsed
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
}

async function callHaiku(
  apiKey: string,
  bullet: string,
  keyword: string,
  roleTitle: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUser(bullet, keyword, roleTitle) }],
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
      | { bullet?: unknown; keyword?: unknown; roleTitle?: unknown }
      | null;

    const bullet =
      typeof body?.bullet === "string"
        ? body.bullet.trim().slice(0, MAX_BULLET_CHARS)
        : "";
    const keyword =
      typeof body?.keyword === "string"
        ? body.keyword.trim().slice(0, MAX_KEYWORD_CHARS)
        : "";
    const roleTitle =
      typeof body?.roleTitle === "string"
        ? body.roleTitle.trim().slice(0, MAX_ROLE_CHARS)
        : "";

    // Need a real bullet to rewrite and a keyword to surface. We refuse to
    // "rewrite" an empty bullet — that would be generating, i.e. fabricating.
    if (bullet.length < 8 || keyword.length < 2) {
      return NextResponse.json(
        { error: "A bullet and a keyword are required." },
        { status: 400 },
      );
    }

    // Global daily spend cap — after the per-IP windows (per-IP 429s win) and
    // after validation. 1 unit: single-bullet rewrite, max_tokens 512.
    const spend = await takeSpendUnits(1);
    if (!spend.allowed) return spendCapResponse(spend.retryAfterSeconds);

    // First attempt + one retry. A clean empty array (the truthful refusal) is
    // a valid SUCCESS and is returned immediately — never retried. We retry on
    // an upstream API failure or unparseable output, and distinguish the two:
    // a real API outage is a 502, whereas unparseable-after-retry degrades to
    // a graceful "no rewrite available" so the user just gets no suggestion.
    let variants: string[] | null = null;
    let apiFailed = false;
    for (let attempt = 0; attempt < 2 && variants === null; attempt++) {
      let raw: string;
      try {
        raw = await callHaiku(apiKey, bullet, keyword, roleTitle);
        apiFailed = false;
      } catch {
        apiFailed = true;
        continue; // upstream/network error — retry the call
      }
      try {
        variants = extractStringArray(raw); // may legitimately be []
      } catch {
        // Parsed nothing usable — retry once for a cleaner response.
      }
    }

    if (variants !== null) {
      return NextResponse.json({ variants });
    }
    if (apiFailed) {
      return NextResponse.json(
        { error: "Couldn't reach the rewrite service. Please try again." },
        { status: 502 },
      );
    }
    // Reached the model but never got a parseable array — treat as no rewrite.
    return NextResponse.json({ variants: [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
