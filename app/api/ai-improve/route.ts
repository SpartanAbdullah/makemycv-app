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
import {
  checkRateLimit,
  getClientIp,
  makeLimiter,
} from "@/lib/server/rateLimit";
import type { RoleFamily } from "@/lib/data/roleFamily";
import { normalizePlaceholders } from "@/lib/ai/placeholders";
import { logAiFailure } from "@/lib/server/logRouteError";

const ROUTE = "api/ai-improve";

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
      // Truthfulness contract (2026-10-24, audit F31). The previous prompt said
      // "use realistic estimates if not provided" and the model obliged with a
      // 22% saving, an AED 4.5M budget and a 91→98% accuracy gain the candidate
      // never entered. Figures now come from the user: the model writes the
      // literal {{number}} token and the UI refuses to insert text that still
      // carries one (lib/ai/placeholders.ts, components/ai/PlaceholderText).
      return {
        system:
          "You are an expert CV editor for the UAE job market. You write " +
          "ATS-optimised, impact-focused bullet points using the CAR framework " +
          "(Context, Action, Result): strong action verb, one sentence, never " +
          "first person.\n\n" +
          "TRUTHFULNESS OVERRIDES EVERYTHING. The ONLY facts you may state are " +
          "the job title, the company and the existing bullets you are given. " +
          "You must NEVER invent numbers, percentages, amounts, headcounts, " +
          "durations, named tools or systems, certifications, clients, " +
          "projects or outcomes. A plausible-sounding figure the candidate " +
          "never stated is a failure, not a success.\n\n" +
          "Wherever a figure would strengthen a bullet, write the literal " +
          "placeholder {{number}} in its place - e.g. \"Reduced delivery lead " +
          "time by {{number}}% across {{number}} warehouses\". The user " +
          "replaces it with the real value. Never write a real number that is " +
          "not in the input.\n\n" +
          "Respond ONLY with a JSON array of strings. No explanation. No markdown.",
        user:
          `Suggest 4 CV bullet points for this role, within the candidate's own scope:\n` +
          `Job Title: ${body.jobTitle ?? ""}\n` +
          `Company: ${body.company ?? ""}\n` +
          `Existing bullets (the ONLY source of facts beyond the title): ${existing || "(none)"}\n\n` +
          `Rules:\n` +
          `- Each bullet starts with a strong action verb, one sentence, max 20 words.\n` +
          `- Describe responsibilities and outcomes typical for this title only in terms the candidate can confirm - no named tools, clients or metrics unless they appear above.\n` +
          `- Use {{number}} wherever a metric, amount, headcount or duration belongs. Never a real number that is not in the input.\n` +
          `- Do not repeat an existing bullet.\n` +
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
          "You suggest skills a candidate's OWN headline and experience make " +
          "plausible - you do not assert skills, tools or credentials they " +
          "never mentioned. Respond ONLY with a JSON array of strings. " +
          "No explanation. No markdown. No duplicates from existing skills.",
        user:
          `Suggest 8-10 relevant professional skills for this candidate:\n` +
          `Headline / Job Title: ${body.headline ?? ""}\n` +
          `Experience:\n${roles}\n\n` +
          `Already has these skills (do NOT repeat): ${existing}\n\n` +
          `Return 8-10 skill strings as a JSON array.\n` +
          `Name a specific product or system ONLY if it appears in the experience above; otherwise use the general skill (e.g. 'ERP systems', not 'Odoo ERP').\n` +
          `Never suggest certifications, licences or qualifications - employers verify those.\n` +
          `Mix: technical skills and soft skills relevant to the UAE market.\n` +
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
          "and engage human recruiters. TRUTHFULNESS OVERRIDES EVERYTHING: " +
          "state only facts present in the headline, roles, bullets and " +
          "existing summary you are given. Never invent years of experience, " +
          "metrics, team sizes, tools, clients or outcomes - write the literal " +
          "placeholder {{number}} wherever such a figure belongs and the user " +
          "will fill it in. Respond ONLY with a JSON array of exactly 3 " +
          "strings. No explanation. No markdown.",
        user:
          `Write 3 different professional summary variations for this candidate:\n` +
          `Headline / Job Title: ${body.headline ?? ""}\n` +
          `Experience:\n${roles}\n` +
          `Existing summary for context: ${body.existingSummary ?? ""}\n\n` +
          `Requirements for each variation:\n` +
          `- 3-4 sentences maximum\n` +
          `- Open with the role and {{number}} years of experience (use the placeholder unless the years are stated above), or a strong value statement\n` +
          `- Where a metric or achievement belongs, write {{number}} - never a figure that is not in the input\n` +
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

    // Global daily spend cap — checked AFTER the per-IP windows (so hammering
    // users still see the friendlier 429) and after validation (so malformed
    // requests never burn budget). 1 unit: small prompt, max_tokens 2048.
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
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        output_config: { effort: CLAUDE_EFFORT },
        system,
        messages: [{ role: "user", content: user }],
      }),
      // Bounded: a stalled upstream answers 504 in 25 s instead of holding
      // the user's spinner until the platform kills the function.
      signal: anthropicSignal(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown API error");
      // The upstream body goes to the log, not to the browser: it used to be
      // returned verbatim, which showed users Anthropic's internal error text.
      logAiFailure(ROUTE, "upstream", new Error(`Anthropic API error: ${res.status} — ${errText}`));
      return NextResponse.json(
        { error: "Couldn't reach the writing service. Please try again." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const rawText = responseText(data);
    const parsed = extractJSON(rawText);
    // Strings only, and every placeholder variant ([X], {{ metric }}) folded
    // into the one token the UI explains - see lib/ai/placeholders.ts.
    const results = Array.isArray(parsed)
      ? parsed
          .filter((r): r is string => typeof r === "string")
          .map((r) => normalizePlaceholders(r.trim()))
          .filter(Boolean)
      : [];

    if (results.length === 0) {
      logAiFailure(ROUTE, "unparseable");
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 },
      );
    }

    return NextResponse.json({ results, type: body.type });
  } catch (err) {
    if (isTimeoutError(err)) {
      logAiFailure(ROUTE, "timeout");
      return NextResponse.json(UPSTREAM_TIMEOUT_BODY, { status: UPSTREAM_TIMEOUT_STATUS });
    }
    logAiFailure(ROUTE, "internal", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
