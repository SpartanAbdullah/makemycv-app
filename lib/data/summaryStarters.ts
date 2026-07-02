/**
 * Domain summary starters (Phase 2+ personalization).
 *
 * The summary is the first thing a UAE recruiter reads, and today it's a blank
 * box unless the user spends AI quota. These instant, offline, domain-keyed
 * scaffolds get them unstuck — same pattern as the idea-bullet library.
 *
 * Design rules (identical spirit to ideaSuggestions.ts):
 *  - Blanks ("__", "AED __", "__%") for real numbers — never fabricated metrics.
 *  - UAE/GCC-rooted vocabulary (AED, DHA, RERA, KHDA, Opera PMS, MOHRE…).
 *  - NO weak/filler phrases — these must pass the genericPhrases linter (there
 *    is a unit test that enforces it), so the starter itself models good copy.
 */
import type { RoleFamily } from "./roleFamily";

const DOMAIN_SUMMARY_STARTERS: Partial<Record<RoleFamily, string[]>> = {
  sales: [
    "Sales professional with __ years in the UAE market, beating targets by __% and growing account revenue to AED __. I manage key GCC accounts end-to-end and shorten sales cycles through disciplined pipeline management.",
    "Business development specialist with __ years opening new UAE and KSA accounts. Closed AED __ in new business last year across __ enterprise clients and rebuilt the CRM pipeline to lift conversion by __%.",
  ],
  marketing: [
    "Marketing specialist with __ years running paid and organic campaigns for UAE brands. I cut cost-per-acquisition by __% and grew regional social reach to __, with GA4 and Meta/Google Ads at the core of my work.",
    "Digital marketer with __ years in the GCC managing budgets of AED __ across __ markets. I launched __ campaigns that generated AED __ in attributed revenue and lifted engagement by __%.",
  ],
  finance: [
    "Finance professional with __ years in the UAE managing AED __ in working capital and leading month-end close for __ entities. Strong in IFRS, FTA VAT compliance, and financial modelling for investment decisions.",
    "FP&A specialist with __ years' GCC experience owning a AED __ P&L across __ business units. I build forecasting models, cut the close cycle by __ days, and keep VAT filings penalty-free.",
  ],
  accounting: [
    "Accountant with __ years in the UAE maintaining the general ledger for __ entities under IFRS. I file FTA VAT accurately, reconcile AED __ monthly, and cut month-end close from __ to __ days.",
    "Audit and accounting professional with __ years' GCC experience. I supported external audits with zero material adjustments and managed AP/AR totalling AED __ across UAE suppliers and clients.",
  ],
  operations: [
    "Operations manager with __ years leading multi-site UAE operations. I manage teams of __ across __ nationalities, own a AED __ budget, and deliver __% year-on-year efficiency gains.",
    "Operations leader with __ years in the GCC. I cut operating costs by AED __ through process improvement and consistently hit __% of on-time delivery KPIs across __ sites.",
  ],
  logistics: [
    "Supply chain professional with __ years in the UAE managing logistics through Jebel Ali and JAFZA at __ shipments a month. I cut procurement spend by AED __ and improved stock accuracy to __%.",
    "Logistics specialist with __ years' GCC experience overseeing warehousing, customs clearance, and a fleet of __ vehicles. I reduced clearance time by __ days and delivery cost per order by __%.",
  ],
  hr: [
    "HR professional with __ years in the UAE managing end-to-end recruitment and MOHRE compliance for __ employees. I cut time-to-hire by __ days and kept WPS payroll compliant across __ entities.",
    "People and talent specialist with __ years' GCC experience. I reduced turnover by __% through better onboarding and ran performance cycles covering __ staff against measurable KPIs.",
  ],
  admin: [
    "Administrative professional with __ years in the UAE supporting __ senior executives. I handle visa and Emirates ID processing through Tasheel and GDRFA and manage vendor contracts worth AED __.",
    "Executive assistant and PRO with __ years' GCC experience. I coordinate diaries and travel across time zones, maintain document control for __ trade-licence entities, and keep government correspondence on schedule.",
  ],
  engineering: [
    "Civil / MEP engineer with __ years delivering UAE projects worth AED __ on time and within budget. I supervise __ site staff, enforce NEBOSH-standard HSE, and ensure Dubai Municipality code compliance.",
    "Project engineer with __ years in GCC construction. I delivered __ projects with zero lost-time incidents over __ months and cut delivery time by __% through better scheduling and resource planning.",
  ],
  it: [
    "Software engineer with __ years building products used by __ users. I work across Python, SQL, and AWS, ship __ releases a quarter, and hold system uptime at __%.",
    "Technology professional with __ years in the UAE. I automated __ manual processes to save __ hours a week and migrated __ to a new platform with zero data loss for __ users.",
  ],
  hospitality: [
    "Hospitality professional with __ years in UAE __-star properties, holding guest-satisfaction at __% across __ daily covers. I lead multicultural teams and ensure HACCP and Dubai Municipality compliance.",
    "F&B and front-office specialist with __ years' GCC experience on Opera PMS. I lifted occupancy by __% through upselling and managed operations generating AED __ in monthly revenue.",
  ],
  retail: [
    "Retail professional with __ years in UAE malls, hitting __% of monthly store targets across a AED __ outlet. I raised basket size by __% and kept shrinkage below __% through tight stock control.",
    "Store and merchandising specialist with __ years' GCC experience serving __ customers daily across __ nationalities. I trained __ staff and drove sales through visual merchandising and upselling.",
  ],
  realestate: [
    "RERA-certified real estate professional with __ years in Dubai and Abu Dhabi. I closed property deals worth AED __ and maintained __% occupancy across a portfolio of __ leasing units.",
    "Property specialist with __ years in the UAE market. I generate __ qualified leads a month through portals and referrals, and negotiated sale and tenancy contracts totalling AED __ a year.",
  ],
  healthcare: [
    "DHA-licensed healthcare professional with __ years of UAE clinical experience, caring for __ patients per shift while meeting DHA/MOH standards. Strong in patient care, EMR, and infection control.",
    "Healthcare professional with __ years in the GCC and a valid DHA/DOH/MOH licence. I supported a __-bed facility, cut patient wait times by __% through better triage, and maintained accurate records.",
  ],
  education: [
    "Educator with __ years teaching a KHDA/ADEK-aligned curriculum in the UAE. I taught __ students across __ year groups and raised average attainment by __% through structured lesson planning.",
    "Teacher and trainer with __ years' GCC experience delivering British and IB curriculum to multicultural classrooms. I lifted learner satisfaction to __% and mentored __ junior staff.",
  ],
  customerservice: [
    "Customer service professional with __ years in the UAE resolving __ queries a day at a __% CSAT score. I support customers across __ languages and keep first-contact resolution above __%.",
    "Contact-centre specialist with __ years' GCC experience. I cut average handling time by __% while improving retention by __% through careful case handling and multilingual support.",
  ],
};

const GENERIC_SUMMARY_STARTERS: string[] = [
  "Professional with __ years of experience in the UAE, delivering measurable results across [your industry]. I lead multicultural teams, manage budgets of AED __, and am seeking a senior role in [Dubai / Abu Dhabi].",
  "[Your role] with __ years in the UAE market. I delivered __ and improved __ by __%, and I am looking for a role where I can [your goal].",
];

/**
 * Instant summary scaffolds for the Summary step. Domain-tailored when a domain
 * is confirmed, otherwise a strong generic pair — so it always helps.
 *
 * @param domain confirmed job domain (settings.domain)
 * @param limit  max starters (default 2)
 */
export function summaryStartersFor(
  domain: RoleFamily | undefined,
  limit = 2,
): string[] {
  const pool =
    domain && domain !== "generic"
      ? (DOMAIN_SUMMARY_STARTERS[domain] ?? GENERIC_SUMMARY_STARTERS)
      : GENERIC_SUMMARY_STARTERS;
  return pool.slice(0, limit);
}

// Exported for the test that asserts starters never contain a weak phrase.
export const ALL_SUMMARY_STARTERS: string[] = [
  ...GENERIC_SUMMARY_STARTERS,
  ...Object.values(DOMAIN_SUMMARY_STARTERS).flat(),
];
