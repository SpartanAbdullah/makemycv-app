/**
 * The prompts of /api/ai-improve (bullets, skills, summary).
 *
 * Moved out of the route on 2026-11-23 (prompt review) so the wording can be
 * unit tested without the network. Two things changed with the move:
 *
 * 1. The job-field line. It used to be a sentence put IN FRONT of the system
 *    prompt, such as "every bullet should quantify revenue ... in AED or %",
 *    "name systems (Opera PMS, HACCP)" or "HSE (NEBOSH)". The prompt behind it
 *    says never invent a number, a named system or a certification, so the two
 *    pulled against each other, and the bullet-shaped sentence was also sent
 *    with the skills and summary prompts. It is now a FIELD CONTEXT paragraph
 *    AFTER the rules, worded per prompt type, that names the kind of evidence
 *    the field's recruiters look for, asks for {{number}} where the input has
 *    no figure, and allows a named standard, system or regulator only when
 *    the input already names it.
 * 2. What the candidate typed is wrapped in <candidate_input> and the system
 *    prompt says tagged text is data, not instructions (lib/ai/untrusted.ts).
 *
 * Pure: no network, no environment.
 */
import type { RoleFamily } from "../data/roleFamily";
import type { ClippedImproveInput } from "./improveInput";
import { DATA_NOT_INSTRUCTIONS, asData } from "./untrusted";

export type ImproveType = "bullets" | "skills" | "summary";

export type ImprovePromptInput = ClippedImproveInput & {
  type: ImproveType;
  /** From the request, so not trusted to be a RoleFamily. */
  domain?: unknown;
};

type FieldContext = {
  /** The field's name as a recruiter would say it. */
  field: string;
  /** The kind of evidence this field's recruiters look for. No named products. */
  evidence: string;
  /**
   * Standards, systems and regulators of the field. Never suggested: the
   * prompt only says to keep the exact name when the input already has it.
   */
  keep?: string;
};

export const FIELD_CONTEXT: Partial<Record<RoleFamily, FieldContext>> = {
  sales: {
    field: "Sales & Business Development",
    evidence: "revenue, quota attainment, pipeline and client growth",
  },
  marketing: {
    field: "Marketing & Digital",
    evidence: "reach, engagement, acquisition cost, return on ad spend and campaign revenue",
  },
  finance: {
    field: "Finance",
    evidence: "amounts handled, budgets, variances and reporting accuracy",
    keep: "FTA, VAT, IFRS",
  },
  accounting: {
    field: "Accounting & Audit",
    evidence: "accuracy, reconciliations, close cycles and audit outcomes",
    keep: "IFRS, VAT, FTA",
  },
  operations: {
    field: "Operations & Management",
    evidence: "team size, budget owned, cost savings and efficiency gains",
  },
  logistics: {
    field: "Logistics & Supply Chain",
    evidence: "shipment volumes, lead times, cost reductions and supplier savings",
  },
  hr: {
    field: "Human Resources",
    evidence: "headcount supported, time to hire, turnover and payroll accuracy",
    keep: "MOHRE, WPS",
  },
  admin: {
    field: "Administration / PRO",
    evidence: "scope (people or entities supported), turnaround and accuracy",
    keep: "Tasheel, Microsoft 365",
  },
  engineering: {
    field: "Engineering & Construction",
    evidence: "project value, on-time and on-budget delivery, safety record and code compliance",
    keep: "NEBOSH",
  },
  it: {
    field: "IT & Software",
    evidence: "users served, uptime, performance gains and delivery speed",
  },
  hospitality: {
    field: "Hospitality & F&B",
    evidence: "covers, occupancy and guest satisfaction",
    keep: "Opera PMS, HACCP",
  },
  retail: {
    field: "Retail",
    evidence: "sales against target, basket size, footfall and shrinkage",
  },
  realestate: {
    field: "Real Estate",
    evidence: "deal value, occupancy and leads converted",
    keep: "RERA",
  },
  healthcare: {
    field: "Healthcare",
    evidence: "patient volumes, clinical standards and patient safety",
    keep: "DHA, DOH, MOHAP",
  },
  education: {
    field: "Education & Training",
    evidence: "learners taught, attainment gains and curriculum delivered",
    keep: "KHDA, ADEK",
  },
  customerservice: {
    field: "Customer Service",
    evidence: "customer satisfaction, handling time, first-contact resolution and languages used",
  },
};

/** How much of the experience a summary request carries into the prompt. */
export const SUMMARY_ROLES_WITH_BULLETS = 3;
export const SUMMARY_BULLETS_PER_ROLE = 4;

const FIELD_HEADING =
  "FIELD CONTEXT (guidance on wording only; it is not a source of facts and " +
  "the truthfulness rules above override it):";

/** The field paragraph for one prompt type, or "" when no known field is set. */
export function fieldClause(type: ImproveType, domain: unknown): string {
  // Own-property check: `domain` comes from the request, and "constructor"
  // would otherwise resolve to a function on the object's prototype.
  if (typeof domain !== "string" || !Object.prototype.hasOwnProperty.call(FIELD_CONTEXT, domain)) return "";
  const ctx = FIELD_CONTEXT[domain as RoleFamily];
  if (!ctx) return "";

  if (type === "skills") {
    return (
      `${FIELD_HEADING} the candidate works in ${ctx.field}. Prefer the skills ` +
      `this field's recruiters search for, and only those the candidate's own ` +
      `headline and experience make plausible.` +
      (ctx.keep ? ` Suggest ${ctx.keep} only if the input already names them.` : "")
    );
  }
  const what = type === "bullets" ? "bullets" : "summaries";
  return (
    `${FIELD_HEADING} the candidate works in ${ctx.field}. Recruiters in this ` +
    `field look for ${ctx.evidence}. Lean the ${what} towards that kind of ` +
    `result where the input supports it, and write {{number}} for every figure ` +
    `the input does not give.` +
    (ctx.keep
      ? ` Mention ${ctx.keep} only if the input already names them, and then keep the exact name.`
      : "")
  );
}

function basePrompt(body: ImprovePromptInput): { system: string; user: string } {
  switch (body.type) {
    case "bullets": {
      const existing = body.existingBullets.filter(Boolean).join("\n");
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
          `${DATA_NOT_INSTRUCTIONS}\n\n` +
          "Respond ONLY with a JSON array of strings. No explanation. No markdown.",
        user:
          `Suggest 4 CV bullet points for the role below, within the candidate's own scope.\n\n` +
          asData(
            "candidate_input",
            `Job Title: ${body.jobTitle}\n` +
              `Company: ${body.company}\n` +
              `Existing bullets:\n${existing || "(none)"}`,
          ) +
          `\n\nThe existing bullets are the ONLY source of facts beyond the title.\n\n` +
          `Rules:\n` +
          `- Each bullet starts with a strong action verb, one sentence, max 20 words.\n` +
          `- Describe responsibilities and outcomes typical for this title only in terms the candidate can confirm - no named tools, clients or metrics unless they appear above.\n` +
          `- Use {{number}} wherever a metric, amount, headcount or duration belongs. Never a real number that is not in the input.\n` +
          `- Do not repeat an existing bullet.\n` +
          `Format: ["bullet 1", "bullet 2", "bullet 3", "bullet 4"]`,
      };
    }
    case "skills": {
      const roles = body.experienceRoles
        .map((r) => `- ${r.title} at ${r.company}: ${r.bullets.join("; ")}`)
        .join("\n");
      const existing = body.existingSkills.join(", ");
      return {
        system:
          "You are a UAE job market expert and ATS optimisation specialist. " +
          "You suggest skills a candidate's OWN headline and experience make " +
          "plausible - you do not assert skills, tools or credentials they " +
          "never mentioned. NEVER name a software product, brand or platform " +
          "that is not in the candidate's own text: write the general skill " +
          "instead ('CAD software' not 'AutoCAD', 'Spreadsheets' not 'Excel', " +
          "'ERP systems' not 'SAP', 'CRM software' not 'Salesforce'). A " +
          "suggestion that names an unmentioned product is removed before the " +
          `candidate sees it, so it is wasted. ${DATA_NOT_INSTRUCTIONS} Respond ONLY with a JSON ` +
          "array of strings. No explanation. No markdown. No duplicates from " +
          "existing skills.",
        user:
          `Suggest 8-10 relevant professional skills for this candidate.\n\n` +
          asData(
            "candidate_input",
            `Headline / Job Title: ${body.headline}\n` +
              `Experience:\n${roles}\n` +
              `Already has these skills (do NOT repeat): ${existing}`,
          ) +
          `\n\nReturn 8-10 skill strings as a JSON array.\n` +
          `Name a specific product or system ONLY if it appears in the experience above; otherwise use the general skill (e.g. 'ERP systems', not 'Odoo ERP').\n` +
          `Never suggest certifications, licences or qualifications - employers verify those.\n` +
          `Mix: technical skills and soft skills relevant to the UAE market.\n` +
          `Format: ["Skill 1", "Skill 2", ...]`,
      };
    }
    case "summary": {
      // The builder has always sent each role's bullets with a summary
      // request, but until 2026-11-23 only the titles reached the prompt, so
      // summaries were written from "Accountant at X" alone. The first roles
      // (the builder lists the latest first) now bring a few bullets each.
      const roles = body.experienceRoles
        .map((r, i) => {
          const bullets =
            i < SUMMARY_ROLES_WITH_BULLETS
              ? r.bullets.filter(Boolean).slice(0, SUMMARY_BULLETS_PER_ROLE)
              : [];
          return `- ${r.title} at ${r.company}` + bullets.map((b) => `\n    * ${b}`).join("");
        })
        .join("\n");
      return {
        system:
          "You are an expert CV writer specialising in the UAE job market. " +
          "You write compelling professional summaries that pass ATS filters " +
          "and engage human recruiters. TRUTHFULNESS OVERRIDES EVERYTHING: " +
          "state only facts present in the headline, the roles with their " +
          "bullets and the existing summary you are given. Build the summary " +
          "from what the bullets say the candidate did; a role with no " +
          "bullets gives you its title and employer only. Never invent years of experience, " +
          "metrics, team sizes, tools, clients or outcomes - write the literal " +
          "placeholder {{number}} wherever such a figure belongs and the user " +
          `will fill it in. ${DATA_NOT_INSTRUCTIONS} Respond ONLY with a JSON ` +
          "array of exactly 3 strings. No explanation. No markdown.",
        user:
          `Write 3 different professional summary variations for this candidate.\n\n` +
          asData(
            "candidate_input",
            `Headline / Job Title: ${body.headline}\n` +
              `Experience (latest first, with what they did there):\n${roles}\n` +
              `Existing summary for context: ${body.existingSummary}`,
          ) +
          `\n\nRequirements for each variation:\n` +
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

/** System and user prompt for one request, field paragraph included. */
export function buildImprovePrompt(body: ImprovePromptInput): { system: string; user: string } {
  const base = basePrompt(body);
  const clause = fieldClause(body.type, body.domain);
  if (!clause) return base;
  return { system: `${base.system}\n\n${clause}`, user: base.user };
}
