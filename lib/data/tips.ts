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
): { tip: UaeTip; positionLabel: string; pool: UaeTip[]; index: number } => {
  const stepPool = stepId ? tips.filter((t) => t.stepId === stepId) : [];
  const pool = stepPool.length > 0 ? stepPool : tips;
  const normalizedIndex = ((userIndex % pool.length) + pool.length) % pool.length;
  const tip = pool[normalizedIndex];
  const positionLabel = `${String(normalizedIndex + 1).padStart(2, "0")} / ${String(pool.length).padStart(2, "0")}`;
  return { tip, positionLabel, pool, index: normalizedIndex };
};
