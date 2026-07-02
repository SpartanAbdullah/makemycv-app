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
 */
import type { RoleFamily } from "./roleFamily";

const DOMAIN_HARD_SKILLS: Partial<Record<RoleFamily, string[]>> = {
  sales: [
    "Salesforce", "HubSpot CRM", "B2B Sales", "Key Account Management",
    "Pipeline Management", "Lead Generation", "Negotiation", "Business Development",
  ],
  marketing: [
    "Google Ads", "Meta Ads", "SEO", "Google Analytics (GA4)", "Content Marketing",
    "Social Media Management", "Email Marketing", "HubSpot",
  ],
  finance: [
    "IFRS", "UAE VAT / FTA", "Financial Modelling", "Budgeting & Forecasting",
    "SAP FICO", "CFA", "ACCA", "CMA",
  ],
  accounting: [
    "IFRS", "UAE VAT Filing", "General Ledger", "Accounts Payable / Receivable",
    "Bank Reconciliation", "QuickBooks", "Tally ERP", "ACCA",
  ],
  operations: [
    "Process Improvement", "Lean Six Sigma", "P&L Management", "KPI Reporting",
    "ERP (SAP / Oracle)", "Vendor Management", "Inventory Control",
  ],
  logistics: [
    "Supply Chain Management", "Inventory Control", "Customs Clearance",
    "Warehouse Management (WMS)", "SAP MM", "Freight Forwarding", "CIPS / MCIPS",
  ],
  hr: [
    "MOHRE Compliance", "WPS Payroll", "Talent Acquisition",
    "HRIS (SAP SuccessFactors)", "Employee Relations", "Onboarding", "CIPD",
  ],
  admin: [
    "MS Office 365", "Tasheel", "GDRFA / Amer", "Calendar Management",
    "Document Control", "Minute Taking", "Travel Coordination",
  ],
  engineering: [
    "AutoCAD", "Revit / BIM", "Primavera P6", "MEP Coordination",
    "QA / QC", "NEBOSH", "PMP", "Dubai Municipality Codes",
  ],
  it: [
    "Python", "JavaScript", "SQL", "React", "Node.js", "AWS", "Docker",
    "Kubernetes", "CI/CD", "Git",
  ],
  hospitality: [
    "Opera PMS", "Micros POS", "HACCP", "Food & Beverage Cost Control",
    "Guest Relations", "Revenue Management", "Upselling",
  ],
  retail: [
    "POS Systems", "Visual Merchandising", "Inventory Management",
    "Loss Prevention", "Stock Replenishment", "Upselling", "CRM",
  ],
  realestate: [
    "RERA Certified", "Ejari", "Property Management", "Leasing",
    "Bayut / Property Finder", "Sales Negotiation", "CRM",
  ],
  healthcare: [
    "DHA Licence", "DOH / MOH Licence", "BLS", "ACLS",
    "Electronic Medical Records (EMR)", "Patient Care", "Infection Control",
  ],
  education: [
    "KHDA / ADEK Curriculum", "Lesson Planning", "Classroom Management",
    "Assessment Design", "British / IB Curriculum", "Google Classroom",
  ],
  customerservice: [
    "CRM (Zendesk / Salesforce)", "Call Centre Operations", "Complaint Resolution",
    "CSAT / NPS", "Live Chat Support", "Multilingual Support",
  ],
};

/**
 * Domain hard-skill / cert suggestions for the Skills step. Returns [] for
 * "generic"/undefined (no domain confirmed yet) so the caller shows nothing.
 *
 * @param domain   confirmed job domain (settings.domain)
 * @param exclude  skill names already present (case-insensitive)
 * @param limit    max suggestions (default 10)
 */
export function domainHardSkills(
  domain: RoleFamily | undefined,
  exclude: string[] = [],
  limit = 10,
): string[] {
  if (!domain || domain === "generic") return [];
  const pool = DOMAIN_HARD_SKILLS[domain] ?? [];
  const excludeSet = new Set(exclude.map((s) => s.toLowerCase().trim()));
  const out: string[] = [];
  for (const skill of pool) {
    if (excludeSet.has(skill.toLowerCase().trim())) continue;
    out.push(skill);
    if (out.length >= limit) break;
  }
  return out;
}
