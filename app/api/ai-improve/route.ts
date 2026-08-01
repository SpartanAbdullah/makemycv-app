import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { spendCapResponse, takeSpendUnits } from "../../../lib/server/spendGuard";
import type { RoleFamily } from "../../../lib/data/roleFamily";

type AIType = "bullets" | "skills" | "summary";

type RequestBody = {
  type: AIType;
  jobTitle?: string;
  company?: string;
  existingBullets?: string[];
  headline?: string;
  experienceRoles?: { title: string; company: string; bullets: string[] }[];
  existingSkills?: string[];
  existingSummary?: string;
  // Job domain (Phase 1 personalization) — prepends a specialist clause to the
  // system prompt so wording is domain-native, not generic "UAE job market".
  domain?: RoleFamily;
};

// Per-domain specialist clause. Each names the family's "proof unit" so the
// model quantifies the way that field's recruiters expect.
const DOMAIN_CLAUSE: Partial<Record<RoleFamily, string>> = {
  sales:
    "The candidate works in Sales & Business Development — every bullet should quantify revenue, quota, pipeline or client growth in AED or %.",
  marketing:
    "The candidate works in Marketing & Digital — quantify reach, engagement, CAC/ROAS and campaign-attributed revenue.",
  finance:
    "The candidate works in Finance — quantify AED amounts, budgets, variances and compliance (FTA/VAT, IFRS).",
  accounting:
    "The candidate works in Accounting & Audit — emphasise accuracy, reconciliations, close cycles and IFRS/VAT compliance.",
  operations:
    "The candidate works in Operations & Management — quantify team size, budget owned, cost savings and efficiency %.",
  logistics:
    "The candidate works in Logistics & Supply Chain — quantify shipments, cost/lead-time reductions and supplier savings.",
  hr:
    "The candidate works in Human Resources — quantify headcount, time-to-hire, turnover and MOHRE/WPS compliance.",
  admin:
    "The candidate works in Administration/PRO — emphasise scope (execs supported, entities), named systems (Tasheel, MS365) and zero-error accuracy.",
  engineering:
    "The candidate works in Engineering & Construction — quantify project value, on-time/on-budget delivery, HSE (NEBOSH) and code compliance.",
  it:
    "The candidate works in IT & Software — quantify users, uptime, performance gains and name concrete technologies.",
  hospitality:
    "The candidate works in Hospitality & F&B — quantify covers/occupancy and guest-satisfaction, and name systems (Opera PMS, HACCP).",
  retail:
    "The candidate works in Retail — quantify sales-target attainment, basket size, footfall and shrinkage.",
  realestate:
    "The candidate works in Real Estate — quantify deal value in AED, occupancy and leads, and note RERA where relevant.",
  healthcare:
    "The candidate works in Healthcare — emphasise patient volumes, clinical standards and DHA/DOH/MOH licensure.",
  education:
    "The candidate works in Education & Training — quantify learners, attainment gains and curriculum (KHDA/ADEK).",
  customerservice:
    "The candidate works in Customer Service — quantify CSAT, handling time, first-contact resolution and languages.",
};

const SUPPORT_URL = "https://www.makemycv.ae/support";

// Per-IP rate limits backed by the same Upstash instance that powers @vercel/kv.
// Two windows compose: daily (slow drip) + burst (anti-hammer).
const dailyLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
  analytics: true,
  prefix: "mmcv_ai_daily",
});

const burstLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, "60 s"),
  analytics: true,
  prefix: "mmcv_ai_burst",
});

function getClientIp(request: Request): string {
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

// Prepends the domain specialist clause (when a domain is set) to the base
// system prompt, so the model writes domain-native wording.
function buildPrompt(body: RequestBody): { system: string; user: string } {
  const base = buildBasePrompt(body);
  const clause = body.domain ? DOMAIN_CLAUSE[body.domain] : undefined;
  if (!clause) return base;
  return { system: `${clause}\n\n${base.system}`, user: base.user };
}

function buildBasePrompt(body: RequestBody): { system: string; user: string } {
  switch (body.type) {
    case "bullets": {
      const existing = (body.existingBullets ?? []).filter(Boolean).join("\n");
      return {
        system:
          "You are an expert CV writer specialising in the UAE job market. " +
          "You write ATS-optimised, impact-focused bullet points using the " +
          "CAR framework (Context, Action, Result). Use strong action verbs. " +
          "Always quantify achievements where possible. Never use first person. " +
          "Respond ONLY with a JSON array of strings. No explanation. No markdown.",
        user:
          `Generate 4 strong CV bullet points for this role:\n` +
          `Job Title: ${body.jobTitle ?? ""}\n` +
          `Company: ${body.company ?? ""}\n` +
          `Existing bullets for context (if any): ${existing}\n\n` +
          `Return exactly 4 bullet points as a JSON array of strings.\n` +
          `Each bullet must start with a strong action verb.\n` +
          `Each bullet must be one sentence, max 20 words.\n` +
          `At least 2 bullets must contain a metric or number (use realistic estimates if not provided).\n` +
          `Format: ["bullet 1", "bullet 2", "bullet 3", "bullet 4"]`,
      };
    }
    case "skills": {
      const roles = (body.experienceRoles ?? [])
        .map((r) => `- ${r.title} at ${r.company}: ${r.bullets.join("; ")}`)
        .join("\n");
      const existing = (body.existingSkills ?? []).join(", ");
      return {
        system:
          "You are a UAE job market expert and ATS optimisation specialist. " +
          "You suggest relevant, specific skills that match a candidate's " +
          "experience profile. Respond ONLY with a JSON array of strings. " +
          "No explanation. No markdown. No duplicates from existing skills.",
        user:
          `Suggest 8-10 relevant professional skills for this candidate:\n` +
          `Headline / Job Title: ${body.headline ?? ""}\n` +
          `Experience:\n${roles}\n\n` +
          `Already has these skills (do NOT repeat): ${existing}\n\n` +
          `Return 8-10 skill strings as a JSON array.\n` +
          `Skills should be specific (e.g. 'Odoo ERP' not just 'ERP').\n` +
          `Mix: technical skills, tools, and soft skills relevant to UAE market.\n` +
          `Format: ["Skill 1", "Skill 2", ...]`,
      };
    }
    case "summary": {
      const roles = (body.experienceRoles ?? [])
        .map((r) => `- ${r.title} at ${r.company}`)
        .join("\n");
      return {
        system:
          "You are an expert CV writer specialising in the UAE job market. " +
          "You write compelling professional summaries that pass ATS filters " +
          "and engage human recruiters. Respond ONLY with a JSON array of " +
          "exactly 3 strings. No explanation. No markdown.",
        user:
          `Write 3 different professional summary variations for this candidate:\n` +
          `Headline / Job Title: ${body.headline ?? ""}\n` +
          `Experience:\n${roles}\n` +
          `Existing summary for context: ${body.existingSummary ?? ""}\n\n` +
          `Requirements for each variation:\n` +
          `- 3-4 sentences maximum\n` +
          `- Start with years of experience or a strong value statement\n` +
          `- Include at least one metric or achievement\n` +
          `- UAE-market appropriate tone (professional, direct)\n` +
          `- ATS-friendly (include relevant keywords from their field)\n` +
          `- Each variation must have a distinct tone:\n` +
          `  Variation 1: Achievement-focused\n` +
          `  Variation 2: Skills and expertise focused\n` +
          `  Variation 3: Career narrative / growth focused\n\n` +
          `Return exactly 3 summaries as a JSON array of strings.\n` +
          `Format: ["Summary 1", "Summary 2", "Summary 3"]`,
      };
    }
  }
}

function extractJSON(text: string): string[] {
  // Strip markdown fences if present
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  // Find the JSON array
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found");
  return JSON.parse(cleaned.slice(start, end + 1));
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

    const ip = getClientIp(request);

    // Burst window first — cheaper to reject, smaller window.
    const burst = await burstLimit.limit(ip);
    if (!burst.success) {
      const retryAfter = Math.max(1, (burst.reset - Date.now()) / 1000);
      return rateLimitedResponse(retryAfter);
    }

    const daily = await dailyLimit.limit(ip);
    if (!daily.success) {
      const retryAfter = Math.max(1, (daily.reset - Date.now()) / 1000);
      return rateLimitedResponse(retryAfter);
    }

    const body = (await request.json()) as RequestBody;

    if (!body.type || !["bullets", "skills", "summary"].includes(body.type)) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 },
      );
    }

    // Global daily spend cap — checked AFTER the per-IP windows (so hammering
    // users still see the friendlier 429) and after validation (so malformed
    // requests never burn budget). 1 unit: small prompt, max_tokens 1024.
    const spend = await takeSpendUnits(1);
    if (!spend.allowed) return spendCapResponse(spend.retryAfterSeconds);

    const { system, user } = buildPrompt(body);

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
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown API error");
      return NextResponse.json(
        { error: `Anthropic API error: ${res.status} — ${errText}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const rawText: string = data?.content?.[0]?.text ?? "";
    const results = extractJSON(rawText);

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 },
      );
    }

    return NextResponse.json({ results, type: body.type });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
