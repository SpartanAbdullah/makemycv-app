/**
 * Domain hard-skill / certification bank (Phase 2 personalization).
 *
 * The soft-skill bank (softSkills.ts) covers cross-cultural, screenable soft
 * skills. THIS bank covers the HARD skills, tools, and UAE certifications that
 * an ATS keyword-matches on — the domain-native terms recruiters filter for
 * (Salesforce for sales, IFRS/VAT for finance, DHA licence for healthcare,
 * NEBOSH for construction, Opera PMS for hospitality…). Surfaced as one-tap
 * chips in SkillsStep when a domain is set.
 *
 * Curated, UAE-flavored, zero runtime cost. Keyed by the shared RoleFamily so
 * it stays in lockstep with inferRoleFamily / the confirm chip.
 *
 * ── Shape (2026-08-25) ──────────────────────────────────────────────────────
 * Entries were a flat `string[]`. They now carry three things the flat list
 * could not express, each answering a question the user is provably stuck on
 * (see the skills-step research brief):
 *
 *   tier    — "must" vs "nice". The user's literal question is "which skills
 *             MUST be there and which not", and a single undifferentiated tray
 *             of chips cannot answer it. Modelled on ESCO's essential/optional
 *             split, which is the only free taxonomy that takes a position.
 *   aliases — the other spellings a real CV uses. Alias coverage is a per-entry
 *             defect in every public skills dataset, and it is what makes
 *             "the builder doesn't know my skill" happen. Never rendered; used
 *             to suppress a chip the user already has under another name, and
 *             (next slice) to find the skill inside their own bullets.
 *   kind    — a licence is not a skill. UAE application forms ask about
 *             licences as knockout questions, and lib/utils/essentials.ts
 *             already treats credentials differently from skills. Marking them
 *             here lets the UI stop rendering "Ejari" (a government system) as
 *             though it were a certificate someone holds.
 *
 * `domainHardSkills()` still returns `string[]` and is unchanged for callers.
 */
import type { RoleFamily } from "./roleFamily";

/** How decisive an entry is for its domain. */
export type SkillTier = "must" | "nice";

/**
 * What the entry IS. Drives affordances, not scoring:
 *   skill      — a competency ("Key Account Management")
 *   tool       — a named product ("Salesforce", "Primavera P6")
 *   credential — a licence, certificate or registration someone HOLDS
 *   system     — a government portal/process someone USES, not holds
 */
export type SkillKind = "skill" | "tool" | "credential" | "system";

export type DomainSkill = {
  /** Canonical label. Rendered on the chip and written into CvSkill.name. */
  name: string;
  tier: SkillTier;
  kind?: SkillKind;
  /**
   * Alternate spellings, acronyms and legacy names. Never rendered.
   *
   * Held to a STRICT bar, because this list does two jobs and the harder one
   * sets the standard: it suppresses an already-held suggestion (where a loose
   * alias is merely unhelpful) AND it is what lib/skills/evidence.ts searches
   * the user's own bullets for (where a loose alias makes the product claim
   * they have proven something they have not).
   *
   * So an alias must be specific enough that its presence in prose genuinely
   * implies the skill. "FTA Portal" was removed from EmaraTax for exactly this
   * reason — a bullet reading "filed through the FTA portal" is evidence of
   * VAT work, not of the EmaraTax system. Bare common-English words ("Lean",
   * "Epic") belong in `weakAliases` instead.
   */
  aliases?: string[];
  /**
   * Spellings that are ALSO ordinary English words — "React", "Node", "Go".
   *
   * Recognised when they appear as a discrete entry on the skills list (so we
   * don't re-suggest something the user already typed), but NEVER searched for
   * in prose: "the ability to react quickly" and "each node in the cluster"
   * are not evidence of React or Node.js. Same distinction the JD matcher
   * draws with AMBIGUOUS_TECH_FORMS in lib/jdMatch/match.ts — a word is a
   * claim in a skills list and merely a word in a sentence.
   */
  weakAliases?: string[];
};

const DOMAIN_HARD_SKILLS: Partial<Record<RoleFamily, DomainSkill[]>> = {
  sales: [
    // CRM is a FAMILY in the UAE, not a Salesforce monopoly: local postings
    // name Zoho, HubSpot, Dynamics and property-specific CRMs more or less
    // interchangeably, so leading with Salesforce alone under-serves the market.
    { name: "Salesforce", tier: "must", kind: "tool", aliases: ["Salesforce CRM", "SFDC"] },
    { name: "HubSpot CRM", tier: "nice", kind: "tool", aliases: ["HubSpot"] },
    { name: "Zoho CRM", tier: "nice", kind: "tool", aliases: ["Zoho"] },
    { name: "Microsoft Dynamics 365", tier: "nice", kind: "tool", aliases: ["MS Dynamics", "Dynamics 365", "Dynamics CRM"] },
    { name: "B2B Sales", tier: "must", aliases: ["Business to Business Sales"] },
    { name: "Key Account Management", tier: "must", aliases: ["Account Management", "KAM"] },
    { name: "Pipeline Management", tier: "must", aliases: ["Sales Pipeline"] },
    { name: "Lead Generation", tier: "nice", aliases: ["Lead Gen", "Prospecting"] },
    { name: "Negotiation", tier: "must" },
    { name: "Business Development", tier: "nice", aliases: ["BD", "New Business Development"] },
  ],
  marketing: [
    { name: "Google Ads", tier: "must", kind: "tool", aliases: ["AdWords", "Google AdWords", "PPC"] },
    { name: "Meta Ads", tier: "must", kind: "tool", aliases: ["Facebook Ads", "Instagram Ads", "Meta Business Suite"] },
    { name: "SEO", tier: "must", aliases: ["Search Engine Optimisation", "Search Engine Optimization"] },
    { name: "Google Analytics (GA4)", tier: "must", kind: "tool", aliases: ["GA4", "Google Analytics", "Google Analytics 4"] },
    { name: "Content Marketing", tier: "nice" },
    { name: "Social Media Management", tier: "nice", aliases: ["SMM", "Social Media Marketing"] },
    { name: "Email Marketing", tier: "nice", aliases: ["EDM", "Mailchimp"] },
    { name: "HubSpot", tier: "nice", kind: "tool", aliases: ["HubSpot Marketing"] },
  ],
  finance: [
    { name: "IFRS", tier: "must", aliases: ["International Financial Reporting Standards", "IFRS 9", "IFRS 16"] },
    // UAE Corporate Tax (9%, effective from FY2023) has overtaken VAT as the
    // live differentiator on UAE finance postings; VAT stays because it is
    // still screened for and is what most candidates have on their CV.
    { name: "UAE Corporate Tax", tier: "must", aliases: ["Corporate Tax", "CT", "UAE CT", "Corporate Tax Registration"] },
    { name: "UAE VAT / FTA", tier: "must", aliases: ["VAT", "UAE VAT", "FTA", "Federal Tax Authority", "VAT Filing", "VAT Return"] },
    { name: "EmaraTax", tier: "nice", kind: "system", aliases: ["Emara Tax"] },
    { name: "Financial Modelling", tier: "must", aliases: ["Financial Modeling", "Financial Models"] },
    { name: "Budgeting & Forecasting", tier: "must", aliases: ["Budgeting and Forecasting", "Budgeting", "Forecasting", "FP&A"] },
    { name: "SAP FICO", tier: "nice", kind: "tool", aliases: ["SAP FI", "SAP CO", "SAP Finance"] },
    { name: "CFA", tier: "nice", kind: "credential", aliases: ["Chartered Financial Analyst"] },
    { name: "ACCA", tier: "nice", kind: "credential", aliases: ["Association of Chartered Certified Accountants"] },
    { name: "CMA", tier: "nice", kind: "credential", aliases: ["Certified Management Accountant"] },
    // Robert Half's UAE guide lists ACAMS FIRST for financial services — ahead
    // of ACCA — on the back of regional AML enforcement.
    { name: "ACAMS", tier: "nice", kind: "credential", aliases: ["Anti-Money Laundering", "AML Certification", "CAMS"] },
  ],
  accounting: [
    { name: "IFRS", tier: "must", aliases: ["International Financial Reporting Standards"] },
    { name: "UAE VAT Filing", tier: "must", aliases: ["VAT", "VAT Return", "UAE VAT", "FTA"] },
    { name: "UAE Corporate Tax", tier: "must", aliases: ["Corporate Tax", "CT"] },
    { name: "General Ledger", tier: "must", aliases: ["GL", "Ledger Management"] },
    { name: "Accounts Payable / Receivable", tier: "must", aliases: ["AP", "AR", "Accounts Payable", "Accounts Receivable", "AP/AR"] },
    { name: "Bank Reconciliation", tier: "must", aliases: ["Reconciliations", "Bank Recs"] },
    { name: "QuickBooks", tier: "nice", kind: "tool" },
    { name: "Tally ERP", tier: "nice", kind: "tool", aliases: ["Tally", "Tally Prime"] },
    { name: "ACCA", tier: "nice", kind: "credential" },
  ],
  operations: [
    { name: "Process Improvement", tier: "must", aliases: ["Process Optimisation", "Continuous Improvement"] },
    { name: "Lean Six Sigma", tier: "must", kind: "credential", aliases: ["Six Sigma", "Lean Manufacturing", "Green Belt", "Black Belt"] },
    { name: "P&L Management", tier: "must", aliases: ["P&L", "Profit and Loss", "PnL"] },
    { name: "KPI Reporting", tier: "must", aliases: ["KPIs", "Performance Reporting"] },
    { name: "ERP (SAP / Oracle)", tier: "must", kind: "tool", aliases: ["ERP", "SAP", "Oracle ERP", "S/4HANA", "Oracle Fusion"] },
    { name: "Vendor Management", tier: "nice", aliases: ["Supplier Management"] },
    { name: "Inventory Control", tier: "nice", aliases: ["Stock Control", "Inventory Management"] },
  ],
  logistics: [
    { name: "Supply Chain Management", tier: "must", aliases: ["SCM", "Supply Chain"] },
    { name: "Inventory Control", tier: "must", aliases: ["Stock Control", "Inventory Management"] },
    { name: "Customs Clearance", tier: "must", aliases: ["Customs", "Dubai Customs", "Import Export Documentation"] },
    { name: "Warehouse Management (WMS)", tier: "must", kind: "tool", aliases: ["WMS", "Warehouse Management"] },
    { name: "SAP MM", tier: "nice", kind: "tool", aliases: ["SAP Materials Management"] },
    { name: "Freight Forwarding", tier: "nice", aliases: ["Freight", "Shipping"] },
    { name: "CIPS / MCIPS", tier: "nice", kind: "credential", aliases: ["CIPS", "MCIPS", "Chartered Institute of Procurement"] },
  ],
  hr: [
    { name: "MOHRE Compliance", tier: "must", aliases: ["MOHRE", "Ministry of Human Resources", "Labour Compliance"] },
    { name: "WPS Payroll", tier: "must", aliases: ["WPS", "Wage Protection System", "Payroll"] },
    // Federal Decree-Law 33 of 2021 is the current UAE labour law; postings ask
    // for it by name and by number.
    { name: "UAE Labour Law", tier: "must", aliases: ["UAE Labor Law", "Federal Decree-Law 33", "Labour Law"] },
    { name: "Emiratisation / Nafis", tier: "must", aliases: ["Emiratisation", "Emiratization", "Nafis"] },
    { name: "Talent Acquisition", tier: "must", aliases: ["Recruitment", "Hiring", "Sourcing"] },
    { name: "HRIS (SAP SuccessFactors)", tier: "nice", kind: "tool", aliases: ["HRIS", "SuccessFactors", "SAP HR", "Oracle HCM"] },
    { name: "Gratuity / End-of-Service", tier: "nice", aliases: ["Gratuity", "End of Service Benefits", "EOSB"] },
    { name: "Employee Relations", tier: "nice", aliases: ["ER", "Employee Engagement"] },
    { name: "Onboarding", tier: "nice", aliases: ["Induction"] },
    { name: "CIPD", tier: "nice", kind: "credential", aliases: ["CIPD Level 5", "CIPD Level 7", "Chartered Institute of Personnel and Development"] },
  ],
  admin: [
    { name: "MS Office 365", tier: "must", kind: "tool", aliases: ["Microsoft Office", "MS Office", "Office 365", "M365", "Microsoft 365"] },
    // Tasheel and Amer are NOT interchangeable — Tasheel handles MOHRE labour
    // transactions, Amer handles GDRFA Dubai residency/immigration, and TAMM is
    // the Abu Dhabi equivalent. A PRO applying in the wrong emirate with the
    // wrong term reads as someone who has not done the job.
    { name: "Tasheel (MOHRE)", tier: "must", kind: "system", aliases: ["Tasheel", "Tas-heel", "MOHRE Portal"] },
    { name: "Amer (GDRFA Dubai)", tier: "must", kind: "system", aliases: ["Amer", "GDRFA", "Amer Centre"] },
    { name: "TAMM (Abu Dhabi)", tier: "nice", kind: "system", aliases: ["TAMM"] },
    { name: "Calendar Management", tier: "nice", aliases: ["Diary Management", "Scheduling"] },
    { name: "Document Control", tier: "nice", aliases: ["Document Management", "Filing"] },
    { name: "Minute Taking", tier: "nice", aliases: ["Minutes", "Meeting Minutes"] },
    { name: "Travel Coordination", tier: "nice", aliases: ["Travel Arrangements", "Visa Coordination"] },
  ],
  engineering: [
    { name: "AutoCAD", tier: "must", kind: "tool", aliases: ["Auto CAD", "CAD"] },
    { name: "Revit / BIM", tier: "must", kind: "tool", aliases: ["Revit", "BIM", "Building Information Modelling", "Navisworks"] },
    { name: "Primavera P6", tier: "must", kind: "tool", aliases: ["P6", "Oracle Primavera", "Primavera"] },
    { name: "MEP Coordination", tier: "must", aliases: ["MEP", "Mechanical Electrical Plumbing"] },
    { name: "QA / QC", tier: "must", aliases: ["QAQC", "Quality Assurance", "Quality Control"] },
    // The screened token is the International General Certificate, not the bare
    // brand. Deliberately NOT carrying a spec code (IG/GIC) in the label — the
    // spec revises and a baked-in code dates the CV.
    { name: "NEBOSH IGC", tier: "must", kind: "credential", aliases: ["NEBOSH", "NEBOSH IG", "NEBOSH International General Certificate"] },
    { name: "IOSH Managing Safely", tier: "nice", kind: "credential", aliases: ["IOSH"] },
    { name: "ISO 45001", tier: "nice", kind: "credential", aliases: ["OHSAS 18001", "ISO45001"] },
    { name: "PMP", tier: "must", kind: "credential", aliases: ["Project Management Professional", "PMI"] },
    // UAE postings phrase this as "SOE registration in place or in process".
    { name: "Society of Engineers (SOE)", tier: "nice", kind: "credential", aliases: ["SOE", "SOE Card", "Society of Engineers UAE"] },
    { name: "Dubai Municipality Codes", tier: "nice", aliases: ["Dubai Municipality", "DM Regulations", "Trakhees"] },
  ],
  it: [
    { name: "Python", tier: "must", kind: "tool" },
    { name: "JavaScript", tier: "must", kind: "tool", aliases: ["JS", "ES6", "TypeScript"] },
    { name: "SQL", tier: "must", kind: "tool", aliases: ["MySQL", "PostgreSQL", "T-SQL", "PL/SQL"] },
    { name: "React.js", tier: "must", kind: "tool", aliases: ["ReactJS"], weakAliases: ["React"] },
    { name: "Node.js", tier: "must", kind: "tool", aliases: ["NodeJS"], weakAliases: ["Node"] },
    { name: "AWS", tier: "must", kind: "tool", aliases: ["Amazon Web Services", "EC2", "S3"] },
    { name: "Docker", tier: "nice", kind: "tool", aliases: ["Containers"] },
    { name: "Kubernetes", tier: "nice", kind: "tool", aliases: ["K8s"] },
    { name: "CI/CD", tier: "nice", aliases: ["Continuous Integration", "GitHub Actions", "Jenkins"] },
    { name: "Git", tier: "nice", kind: "tool", aliases: ["GitHub", "GitLab", "Version Control"] },
  ],
  hospitality: [
    { name: "Opera PMS", tier: "must", kind: "tool", aliases: ["Opera", "Oracle Opera", "PMS"] },
    { name: "Micros POS", tier: "must", kind: "tool", aliases: ["Micros", "Simphony"] },
    { name: "HACCP", tier: "must", kind: "credential", aliases: ["Food Safety", "Hazard Analysis Critical Control Point"] },
    { name: "Food & Beverage Cost Control", tier: "must", aliases: ["F&B Cost Control", "Cost Control", "F&B"] },
    { name: "Guest Relations", tier: "nice", aliases: ["Guest Services", "Front Office"] },
    { name: "Revenue Management", tier: "nice", aliases: ["RevPAR", "Yield Management"] },
    { name: "Upselling", tier: "nice" },
  ],
  retail: [
    { name: "POS Systems", tier: "must", kind: "tool", aliases: ["Point of Sale", "POS"] },
    { name: "Visual Merchandising", tier: "must", aliases: ["Merchandising", "VM"] },
    { name: "Inventory Management", tier: "must", aliases: ["Stock Management", "Stock Control"] },
    { name: "Loss Prevention", tier: "nice", aliases: ["Shrinkage Control"] },
    { name: "Stock Replenishment", tier: "nice", aliases: ["Replenishment"] },
    { name: "Upselling", tier: "nice", aliases: ["Cross-selling"] },
    { name: "CRM", tier: "nice", kind: "tool", aliases: ["Customer Relationship Management"] },
  ],
  realestate: [
    // "RERA Certified" was FOLKLORE and is corrected here. RERA is the
    // regulator (an arm of DLD) — nobody is certified BY it. The real artifact
    // is the DLD-issued real estate professional practice card, colloquially
    // the Broker Card: valid one year, renewed against an annual test. The old
    // wording survives as an alias because that is what candidates type.
    // TODO: DLD also issues the training/exam route (DREI course + RERA exam).
    // Third-party sources render the course acronym as both CTRB and CTREB and
    // DLD's own page uses neither — verify the canonical string on drei.ae
    // before adding it as its own chip.
    { name: "RERA Broker Card", tier: "must", kind: "credential", aliases: ["RERA", "RERA Certified", "Broker Card", "DLD Broker Card", "Real Estate Practice Card", "Brokers Card"] },
    // Ejari is a government REGISTRATION SYSTEM, not a credential — do not
    // render it with a certificate affordance.
    { name: "Ejari", tier: "must", kind: "system", aliases: ["Ejari Registration", "Tenancy Contract Registration"] },
    { name: "Property Management", tier: "must", aliases: ["Facilities Management", "Community Management"] },
    { name: "Leasing", tier: "must", aliases: ["Lettings", "Tenancy Management"] },
    { name: "Bayut / Property Finder", tier: "nice", kind: "tool", aliases: ["Bayut", "Property Finder", "Dubizzle"] },
    { name: "Sales Negotiation", tier: "nice", aliases: ["Negotiation", "Deal Closing"] },
    { name: "CRM", tier: "nice", kind: "tool", aliases: ["Property CRM", "Salesforce", "Zoho CRM"] },
  ],
  healthcare: [
    // Licensing is EMIRATE-SCOPED, and shipping "DHA licence" as though it were
    // national mis-serves everyone outside Dubai. Three authorities:
    //   DHA   — Dubai (portal: Sheryan)
    //   DOH   — Abu Dhabi + Al Ain (formerly HAAD; ads still say HAAD)
    //   MOHAP — federal: Sharjah, Ajman, UAQ, RAK, Fujairah (ads still say MOH)
    { name: "DHA Licence (Dubai)", tier: "must", kind: "credential", aliases: ["DHA", "Dubai Health Authority", "DHA Licence", "DHA License", "Sheryan"] },
    { name: "DOH Licence (Abu Dhabi)", tier: "must", kind: "credential", aliases: ["DOH", "HAAD", "HAAD Licence", "Department of Health Abu Dhabi"] },
    { name: "MOHAP Licence", tier: "must", kind: "credential", aliases: ["MOHAP", "MOH", "MOH Licence", "Ministry of Health and Prevention"] },
    // The mandatory step BEFORE any licence issues — and the state most
    // candidates are actually in when they apply.
    { name: "DataFlow (PSV)", tier: "must", kind: "credential", aliases: ["DataFlow", "Primary Source Verification", "PSV"] },
    { name: "BLS", tier: "must", kind: "credential", aliases: ["Basic Life Support"] },
    { name: "ACLS", tier: "nice", kind: "credential", aliases: ["Advanced Cardiac Life Support"] },
    { name: "Electronic Medical Records (EMR)", tier: "nice", kind: "tool", aliases: ["EMR", "EHR", "Cerner", "Malaffi"] },
    { name: "Patient Care", tier: "nice", aliases: ["Patient Management"] },
    { name: "Infection Control", tier: "nice", aliases: ["IPC"] },
  ],
  education: [
    { name: "KHDA / ADEK Curriculum", tier: "must", aliases: ["KHDA", "ADEK", "ADEC", "Curriculum Compliance"] },
    { name: "UAE Teacher Licence", tier: "must", kind: "credential", aliases: ["Teacher Licence", "Teacher License", "TLS", "MOE Teacher Licence"] },
    { name: "Lesson Planning", tier: "must", aliases: ["Curriculum Planning", "Schemes of Work"] },
    { name: "Classroom Management", tier: "must", aliases: ["Behaviour Management"] },
    { name: "Assessment Design", tier: "nice", aliases: ["Assessment", "Formative Assessment"] },
    { name: "British / IB Curriculum", tier: "nice", aliases: ["IB", "British Curriculum", "National Curriculum", "IGCSE", "A-Level", "American Curriculum"] },
    { name: "Google Classroom", tier: "nice", kind: "tool", aliases: ["Classroom", "LMS", "Seesaw"] },
  ],
  customerservice: [
    { name: "CRM (Zendesk / Salesforce)", tier: "must", kind: "tool", aliases: ["Zendesk", "Salesforce", "Freshdesk", "CRM"] },
    { name: "Call Centre Operations", tier: "must", aliases: ["Call Center", "Contact Centre", "Inbound Calls"] },
    { name: "Complaint Resolution", tier: "must", aliases: ["Complaint Handling", "Escalation Management"] },
    { name: "CSAT / NPS", tier: "must", aliases: ["CSAT", "NPS", "Customer Satisfaction"] },
    { name: "Live Chat Support", tier: "nice", aliases: ["Live Chat", "Chat Support"] },
    { name: "Multilingual Support", tier: "nice", aliases: ["Bilingual Support", "Arabic Support"] },
  ],
};

/** Every string that should suppress this entry as a suggestion. */
function matchTokens(entry: DomainSkill): string[] {
  return [entry.name, ...(entry.aliases ?? []), ...(entry.weakAliases ?? [])];
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * The domain's entries, must-haves first, with anything the user already has
 * removed. Order within a tier is the curated order above.
 *
 * Exclusion is ALIAS-AWARE: a user who typed "RERA Certified" or "HAAD" is not
 * offered "RERA Broker Card" or "DOH Licence (Abu Dhabi)" as though they had
 * nothing. That mismatch is the single most common way a suggestion bank
 * insults someone who has already done the work.
 */
export function domainSkillEntries(
  domain: RoleFamily | undefined,
  exclude: string[] = [],
  limit = 10,
): DomainSkill[] {
  if (!domain || domain === "generic") return [];
  const pool = DOMAIN_HARD_SKILLS[domain] ?? [];
  const excludeSet = new Set(exclude.map(norm));

  const kept = pool.filter(
    (entry) => !matchTokens(entry).some((t) => excludeSet.has(norm(t))),
  );

  // Stable partition: must-haves keep their curated order, then nice-to-haves.
  const must = kept.filter((e) => e.tier === "must");
  const nice = kept.filter((e) => e.tier !== "must");
  return [...must, ...nice].slice(0, limit);
}

/**
 * Domain hard-skill / cert suggestions for the Skills step. Returns [] for
 * "generic"/undefined (no domain confirmed yet) so the caller shows nothing.
 *
 * Name-only view of domainSkillEntries, kept for callers that just render
 * chips. Prefer domainSkillEntries when you need the tier or the kind.
 *
 * @param domain   confirmed job domain (settings.domain)
 * @param exclude  skill names already present (case-insensitive, alias-aware)
 * @param limit    max suggestions (default 10)
 */
export function domainHardSkills(
  domain: RoleFamily | undefined,
  exclude: string[] = [],
  limit = 10,
): string[] {
  return domainSkillEntries(domain, exclude, limit).map((e) => e.name);
}

/** Flat list of every entry in the bank — used by the alias/consistency tests
 *  and (next slice) by the evidence matcher. */
export function allDomainSkills(): DomainSkill[] {
  return Object.values(DOMAIN_HARD_SKILLS).flat();
}
