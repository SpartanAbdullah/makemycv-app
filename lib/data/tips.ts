/**
 * UAE-specific tips surfaced on the builder via the Today's Tip card.
 *
 * Tips rotate daily by default (day-of-year mod tips.length) and can be cycled
 * manually with the chevrons in the card. Step-scoped tips ("stepId" set) are
 * preferred when the user is on that step; the rest are universal.
 *
 * Every quote is paired with a citation. Where we draw on internal research
 * rather than a public source we credit it explicitly — vague "studies show"
 * lines have no place here.
 */
import type { RoleFamily } from "./roleFamily";

export type UaeTip = {
  id: string;
  quote: string;
  citation: string;
  stepId?:
    | "personal"
    | "summary"
    | "experience"
    | "education"
    | "skills"
    | "languages"
    | "certifications"
    | "projects"
    | "review";
  /** Domain-scoped tip (Phase 3): shown when the user's confirmed
   *  settings.domain matches. Domain tips are field-general (no stepId) so they
   *  rotate alongside step tips on every step. */
  domain?: RoleFamily;
};

export const tips: UaeTip[] = [
  {
    id: "visa-status-first",
    quote:
      "UAE recruiters scan visa status in the first three seconds. Put yours up top, not buried at the bottom.",
    citation: "From our review of UAE job listings on Bayt and LinkedIn, 2024.",
    stepId: "personal",
  },
  {
    id: "uae-mobile-format",
    quote:
      "List your phone as +971 50 / 55 / 56 — UAE recruiters dial WhatsApp, not landlines.",
    citation: "TDRA UAE mobile prefix guide, 2024.",
    stepId: "personal",
  },
  {
    id: "english-arabic-bilingual",
    quote:
      "Bilingual Arabic-English candidates get noticeably more interview callbacks for UAE government and semi-government roles.",
    citation: "Pattern from hands-on hiring reviews at Interior360, 2025.",
    stepId: "languages",
  },
  {
    id: "summary-six-seconds",
    quote:
      "Recruiters spend an average of six seconds on the first scan. Open your summary with a number, not an adjective.",
    citation: "Ladders eye-tracking study, updated 2018; mirrored in 2024 LinkedIn UAE recruiter survey.",
    stepId: "summary",
  },
  {
    id: "experience-quantify",
    quote:
      "‘Led a team’ says nothing. ‘Led 14 people across 3 sites to AED 42M revenue’ shows what you did.",
    citation: "From hands-on reviews of UAE operations CVs, 2024.",
    stepId: "experience",
  },
  {
    id: "experience-action-verbs",
    quote:
      "Start every bullet with a verb. ‘Responsible for…’ describes a job posting, not a person.",
    citation: "Harvard Extension School career writing guide, 2023.",
    stepId: "experience",
  },
  {
    id: "education-attestation",
    quote:
      "Note whether your overseas degree is MOFA-attested. Most UAE government and semi-government roles require it before shortlist.",
    citation: "UAE Ministry of Foreign Affairs document verification guide, 2024.",
    stepId: "education",
  },
  {
    id: "skills-ten-twenty",
    quote:
      "Ten to twenty focused skills is the sweet spot. Above thirty reads as keyword stuffing and ATS systems sometimes penalise it.",
    citation: "Jobscan ATS benchmark, 2023.",
    stepId: "skills",
  },
  {
    id: "skills-mirror-jd",
    quote:
      "Copy the exact wording of the job description. To an ATS, ‘stakeholder management’ and ‘client liaison’ are different skills.",
    citation: "From hands-on ATS testing at Interior360, 2024.",
    stepId: "skills",
  },
  {
    id: "certs-recency",
    quote:
      "Lead with certifications earned in the last three years. PMP, NEBOSH, CFA, CIPD and DHA / DOH credentials carry the most weight in the UAE.",
    citation: "Bayt UAE 2024 employer survey.",
    stepId: "certifications",
  },
  {
    id: "projects-tools",
    quote:
      "On project bullets, name the tools. ‘Built a dashboard in Power BI’ beats ‘Built a dashboard’ in ATS keyword matching.",
    citation: "From hands-on ATS testing at Interior360, 2024.",
    stepId: "projects",
  },
  {
    id: "review-length",
    quote:
      "One page if you have under five years of experience, two pages for more. Three pages is only for academics and executives.",
    citation: "Bayt UAE recruiter panel, 2024.",
    stepId: "review",
  },
  {
    id: "review-pdf-first",
    quote:
      "Send PDF for the application, DOCX for the recruiter to forward. Most UAE applicant tracking systems parse modern PDFs cleanly.",
    citation: "Workable parser benchmark, 2024.",
    stepId: "review",
  },
  {
    id: "photo-toggle",
    quote:
      "Photos are accepted by most UAE employers but toggle them off when applying to blind-hiring international companies.",
    citation: "ILO global hiring practices brief, 2023.",
    // Scoped to the step that owns the photo control — as a universal tip it
    // was mathematically unreachable (personal has scoped tips that always
    // win the rotation; audit UX-10).
    stepId: "personal",
  },
  {
    id: "headline-mirror-role",
    quote:
      "Your headline should mirror the role you want, not the one you held. Recruiters search by target title, not history.",
    citation: "LinkedIn 2024 talent insights report, MENA.",
    stepId: "personal",
  },
  {
    id: "summary-length",
    quote:
      "Aim for 40 to 80 words in the summary. Anything shorter reads like a placeholder; anything longer gets skipped.",
    citation: "From hands-on CV writing reviews at Interior360, 2024.",
    stepId: "summary",
  },
  {
    id: "experience-three-five",
    quote:
      "Three to five bullets per role. The most recent role can run slightly longer; older roles should shrink to one or two.",
    citation: "Harvard Extension School career writing guide, 2023.",
    stepId: "experience",
  },
  {
    id: "skills-uae-favourites",
    quote:
      "Three skills UAE recruiters reliably search: ‘Arabic’, ‘UAE driving licence’, and an ERP system (Oracle, SAP or Tally).",
    citation: "Naukrigulf 2024 search trends.",
    stepId: "skills",
  },
  {
    id: "languages-cefr",
    quote:
      "Use ‘Native’, ‘Fluent’, ‘Professional’ or ‘Conversational’ — not numeric scales. UAE recruiters scan by label, not band.",
    citation: "From hands-on CV writing reviews at Interior360, 2024.",
    stepId: "languages",
  },
  {
    id: "availability-immediate",
    quote:
      "If you can start within 30 days, write ‘Immediate’ or ‘30 days notice’. A vague ‘negotiable’ gets your CV skipped.",
    citation: "Bayt UAE recruiter survey, 2024.",
    stepId: "personal",
  },

  // ── Domain-scoped tips (Phase 3) ──────────────────────────────────────────
  // Field-general advice tagged by domain; surfaces when settings.domain matches.
  {
    id: "domain-sales",
    quote:
      "In UAE sales CVs, lead every bullet with AED revenue and % of target hit — shortlists are filtered on numbers before the prose is read.",
    citation: "From our review of UAE sales listings on Bayt and LinkedIn, 2024.",
    domain: "sales",
  },
  {
    id: "domain-marketing",
    quote:
      "Name GA4, Meta and Google Ads, and quantify reach and ROAS — UAE marketing shortlists are keyword-driven, not adjective-driven.",
    citation: "Pattern from hands-on hiring reviews at Interior360, 2025.",
    domain: "marketing",
  },
  {
    id: "domain-finance",
    quote:
      "State IFRS and FTA VAT exposure explicitly — UAE finance roles screen for both before reading achievements.",
    citation: "From our review of UAE finance listings on Bayt, 2024.",
    domain: "finance",
  },
  {
    id: "domain-accounting",
    quote:
      "Show month-end close days and VAT filing volume — UAE finance teams read accounting CVs for accuracy and compliance signals.",
    citation: "Pattern from hands-on hiring reviews at Interior360, 2025.",
    domain: "accounting",
  },
  {
    id: "domain-operations",
    quote:
      "Put team size, budget owned and efficiency % on page one — UAE operations hiring reads for scale and cost control.",
    citation: "From our review of UAE operations listings on Bayt and LinkedIn, 2024.",
    domain: "operations",
  },
  {
    id: "domain-logistics",
    quote:
      "Name Jebel Ali/JAFZA, customs clearance and a WMS — UAE supply-chain recruiters filter for local trade fluency.",
    citation: "From our review of UAE logistics listings on Naukrigulf, 2024.",
    domain: "logistics",
  },
  {
    id: "domain-hr",
    quote:
      "Name MOHRE, WPS and a time-to-hire number — UAE HR roles screen first for local compliance fluency.",
    citation: "MOHRE guidance; pattern from Interior360 hiring reviews, 2025.",
    domain: "hr",
  },
  {
    id: "domain-admin",
    quote:
      "Name Tasheel, Amer/GDRFA and MS Office 365, and how many executives you supported — UAE admin roles read for scope and systems.",
    citation: "From our review of UAE admin/PRO listings on Bayt, 2024.",
    domain: "admin",
  },
  {
    id: "domain-engineering",
    quote:
      "UAE construction employers expect NEBOSH/IOSH and a project value in AED — put both on page one, with Dubai Municipality/DEWA approvals.",
    citation: "From our review of UAE construction listings on Bayt, 2024.",
    domain: "engineering",
  },
  {
    id: "domain-it",
    quote:
      "List the exact stack — Python, AWS, Docker — not ‘software development’. UAE ATS keyword-matches the tool names.",
    citation: "Pattern from hands-on hiring reviews at Interior360, 2025.",
    domain: "it",
  },
  {
    id: "domain-hospitality",
    quote:
      "Name your PMS (Opera, Micros) and your guest-satisfaction score — UAE hospitality recruiters scan for both.",
    citation: "From our review of UAE hospitality listings on Bayt, 2024.",
    domain: "hospitality",
  },
  {
    id: "domain-retail",
    quote:
      "Show sales-target attainment %, basket size and shrinkage — UAE retail hiring reads for the store numbers, not duties.",
    citation: "From our review of UAE retail listings on Naukrigulf, 2024.",
    domain: "retail",
  },
  {
    id: "domain-realestate",
    quote:
      "Lead with RERA certification and AED deal value — UAE property employers filter on both before calling.",
    citation: "Dubai RERA/DLD guidance; Interior360 hiring reviews, 2025.",
    domain: "realestate",
  },
  {
    id: "domain-healthcare",
    quote:
      "Put your DHA/DOH/MOH licence (or DataFlow stage) near the top — it clears the first ATS gate for UAE clinical roles.",
    citation: "DHA/DOH licensing guidance, 2024.",
    domain: "healthcare",
  },
  {
    id: "domain-education",
    quote:
      "Name the curriculum (KHDA/ADEK, British or IB) and attainment gains — UAE schools shortlist on curriculum fit first.",
    citation: "KHDA/ADEK guidance; Interior360 hiring reviews, 2025.",
    domain: "education",
  },
  {
    id: "domain-customerservice",
    quote:
      "Quantify CSAT, handling time and the languages you support — UAE contact-centre roles read CVs for those three.",
    citation: "From our review of UAE customer-service listings on Bayt, 2024.",
    domain: "customerservice",
  },
];

/**
 * Default tip index for a given calendar date — used as the initial rotation
 * before the user starts cycling. We use UTC day-of-year so the tip is stable
 * across devices for the same user/day.
 */
export const getDailyTipIndex = (date = new Date()): number => {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  return dayOfYear % tips.length;
};

/**
 * Resolve the tip to show for a given step. If a step-scoped tip exists, the
 * rotation cycles through step-scoped tips first; otherwise we fall back to
 * the universal pool. Returns both the tip and a 1-based position string for
 * the "02 / 30" counter in the card header.
 */
export const resolveTipForStep = (
  stepId: UaeTip["stepId"] | undefined,
  userIndex: number,
  domain?: RoleFamily,
): { tip: UaeTip; positionLabel: string; pool: UaeTip[]; index: number } => {
  // Pool = tips for the current step PLUS tips for the user's confirmed domain,
  // so field-specific advice rotates alongside step advice. Falls back to the
  // universal pool when neither matches. With no domain this is identical to the
  // pre-Phase-3 behavior (step-scoped pool, else universal).
  const relevant = tips.filter(
    (t) =>
      (stepId ? t.stepId === stepId : false) ||
      (domain ? t.domain === domain : false),
  );
  const pool = relevant.length > 0 ? relevant : tips;
  const normalizedIndex = ((userIndex % pool.length) + pool.length) % pool.length;
  const tip = pool[normalizedIndex];
  const positionLabel = `${String(normalizedIndex + 1).padStart(2, "0")} / ${String(pool.length).padStart(2, "0")}`;
  return { tip, positionLabel, pool, index: normalizedIndex };
};
