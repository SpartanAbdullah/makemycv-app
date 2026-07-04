/**
 * UAE Idea Suggestions — instant, offline, role-keyed achievement bullets.
 *
 * This is the static counterpart to the AI bullet generator. cvtoolspro.com
 * surfaces a curated "Idea Suggestion" panel that costs nothing to run and
 * appears instantly; we replicate that with a UAE-flavored phrase library so
 * a job seeker is never staring at a blank Achievements box, and so the free
 * tier doesn't have to burn the daily AI quota (10/24h) just to get unstuck.
 *
 * Design rules for every phrase here:
 *  - Action verb first, measurable-by-design (leaves a number for the user to
 *    fill, e.g. "AED __", "__%", "__ staff") rather than inventing fake metrics.
 *  - UAE/GCC-rooted vocabulary where natural (AED, VAT/FTA, MOHRE, DIFC, JAFZA,
 *    Tasheel, multicultural teams) — the moat a generic US library can't match.
 *  - ATS-safe plain text. No symbols beyond the placeholder underscores.
 *
 * Family selection is delegated to lib/data/roleFamily.ts (the single source
 * of title→domain inference). Callers may pass an explicit `domain` (the
 * user-confirmed settings.domain) to override title-based inference — so a
 * headline of "Manager" confirmed as Sales still yields sales bullets.
 * GENERIC is the always-available fallback so every role gets ideas.
 */
import { inferRoleFamily, type RoleFamily } from "./roleFamily";

// Re-exported so existing importers keep working after the type + matcher
// moved to roleFamily.ts / types/cv.ts.
export type { RoleFamily };
export { matchesRoleKeyword } from "./roleFamily";

type RoleBullets = {
  family: RoleFamily;
  label: string;
  bullets: string[];
};

/**
 * Each entry's bullets leave a blank (the "__") for a real number. We never
 * pre-fill metrics — fabricated numbers are a fail in an interview, and the
 * product's whole pitch is honesty. Bullets are keyed by family; the matching
 * keywords live in roleFamily.ts.
 */
const ROLE_LIBRARY: RoleBullets[] = [
  {
    family: "sales",
    label: "Sales & Business Development",
    bullets: [
      "Grew the GCC sales pipeline from AED __ to AED __ over __ months across UAE and KSA accounts.",
      "Closed __ new B2B accounts in the UAE market, exceeding the annual target by __%.",
      "Managed a portfolio of __ key accounts worth AED __ in recurring revenue.",
      "Led a __-person sales team across Dubai and Abu Dhabi, lifting quarterly conversion by __%.",
      "Built relationships with procurement teams at __ enterprise clients, shortening the sales cycle by __ days.",
    ],
  },
  {
    family: "marketing",
    label: "Marketing & Digital",
    bullets: [
      "Ran paid and organic campaigns reaching __ users across the UAE, improving engagement by __%.",
      "Cut cost per acquisition by __% through restructured Google and Meta ad accounts.",
      "Grew the brand's regional social following from __ to __ in __ months.",
      "Launched __ campaigns for the UAE market, generating AED __ in attributed revenue.",
      "Managed an annual marketing budget of AED __ across __ GCC markets.",
    ],
  },
  {
    family: "finance",
    label: "Finance",
    bullets: [
      "Prepared monthly management accounts for __ entities, cutting the close cycle from __ to __ days.",
      "Managed working capital of AED __, improving cash conversion by __ days.",
      "Built financial models supporting AED __ in investment decisions across UAE operations.",
      "Ensured full FTA VAT compliance across __ entities, with zero penalties over __ years.",
      "Led the annual budgeting cycle for a AED __ P&L spanning __ business units.",
    ],
  },
  {
    family: "accounting",
    label: "Accounting & Audit",
    bullets: [
      "Maintained the general ledger for __ entities under IFRS, reconciling AED __ in monthly transactions.",
      "Filed quarterly FTA VAT returns for __ companies accurately and on time.",
      "Reduced month-end close from __ to __ days by automating __ reconciliations.",
      "Managed accounts payable and receivable totalling AED __ across UAE suppliers and clients.",
      "Supported external audits for __ financial years with zero material adjustments.",
    ],
  },
  {
    family: "operations",
    label: "Operations & Management",
    bullets: [
      "Led daily operations across __ UAE sites, meeting __% of on-time delivery KPIs.",
      "Implemented process improvements that reduced operating costs by AED __ annually.",
      "Managed a multicultural team of __ staff across __ nationalities.",
      "Restructured workflows to cut turnaround time by __% while maintaining service levels.",
      "Owned a AED __ operational budget, delivering __% year-on-year efficiency gains.",
    ],
  },
  {
    family: "logistics",
    label: "Logistics & Supply Chain",
    bullets: [
      "Managed inbound and outbound logistics through Jebel Ali Port and JAFZA, handling __ shipments monthly.",
      "Negotiated supplier contracts that reduced procurement spend by AED __ annually.",
      "Oversaw warehouse operations of __ sq ft, improving stock accuracy to __%.",
      "Coordinated customs clearance and documentation, cutting clearance time by __ days.",
      "Optimised a fleet of __ vehicles across the UAE, reducing delivery cost per order by __%.",
    ],
  },
  {
    family: "hr",
    label: "Human Resources",
    bullets: [
      "Managed end-to-end recruitment for __ roles across __ nationalities, reducing time-to-hire by __ days.",
      "Administered MOHRE labour contracts, visa processing, and onboarding for __ employees.",
      "Cut employee turnover by __% through restructured onboarding and engagement programmes.",
      "Maintained WPS payroll compliance for a workforce of __ across __ UAE entities.",
      "Led performance-management cycles covering __ staff against measurable KPIs.",
    ],
  },
  {
    family: "admin",
    label: "Administration & PRO",
    bullets: [
      "Processed visa, Emirates ID, and labour-card renewals via Tasheel and GDRFA for __ employees.",
      "Coordinated diaries, travel, and meetings for __ senior executives across time zones.",
      "Managed office operations and vendor contracts worth AED __ annually.",
      "Maintained document control and government correspondence for __ trade-licence entities.",
      "Handled front-desk and client reception for __ visitors daily in a multicultural environment.",
    ],
  },
  {
    family: "engineering",
    label: "Engineering & Construction",
    bullets: [
      "Delivered __ projects worth AED __ on time and within budget across UAE sites.",
      "Supervised __ contractors and site staff, maintaining zero lost-time incidents over __ months.",
      "Ensured compliance with Dubai Municipality and UAE Fire & Life Safety codes on __ projects.",
      "Reduced project delivery time by __% through revised scheduling and resource planning.",
      "Managed MEP / civil works for a __ sq ft development in __.",
    ],
  },
  {
    family: "it",
    label: "IT & Software",
    bullets: [
      "Built and shipped __ features used by __ users, improving __ by __%.",
      "Reduced system downtime to __% uptime across __ production services.",
      "Automated __ manual processes, saving the team __ hours per week.",
      "Migrated __ to a new platform with zero data loss for __ users.",
      "Led a team of __ engineers delivering __ releases per quarter.",
    ],
  },
  {
    family: "hospitality",
    label: "Hospitality & F&B",
    bullets: [
      "Maintained a guest-satisfaction score of __% across __ daily covers / room nights.",
      "Led a multicultural team of __ across __ nationalities in a __-star property.",
      "Ensured HACCP and Dubai Municipality food-safety compliance with zero violations.",
      "Increased average covers / occupancy by __% through service and upselling initiatives.",
      "Managed F&B / front-office operations generating AED __ in monthly revenue.",
    ],
  },
  {
    family: "retail",
    label: "Retail & Customer-Facing",
    bullets: [
      "Achieved __% of monthly store sales targets across a AED __ retail outlet.",
      "Increased basket size by __% through upselling and cross-selling in a mall environment.",
      "Managed stock and merchandising for __ SKUs, keeping shrinkage below __%.",
      "Delivered service to __ customers daily across __ nationalities.",
      "Trained and supervised __ retail staff during peak Dubai shopping seasons.",
    ],
  },
  {
    family: "realestate",
    label: "Real Estate",
    bullets: [
      "Closed property deals worth AED __ across Dubai and Abu Dhabi (RERA-certified).",
      "Managed a portfolio of __ leasing units, maintaining __% occupancy.",
      "Generated __ qualified leads per month through portals and referrals.",
      "Negotiated sale and tenancy contracts totalling AED __ in annual value.",
      "Built a client base of __ investors across GCC and international markets.",
    ],
  },
  {
    family: "healthcare",
    label: "Healthcare",
    bullets: [
      "Cared for __ patients per shift while maintaining DHA / MOH clinical standards.",
      "Maintained accurate patient records and compliance for a __-bed facility.",
      "Reduced patient wait times by __% through revised triage workflows.",
      "Held a valid DHA / DOH / MOH licence and __ years of UAE clinical experience.",
      "Supported a multidisciplinary team serving __ patients monthly.",
    ],
  },
  {
    family: "education",
    label: "Education & Training",
    bullets: [
      "Taught __ students across __ year groups, improving average attainment by __%.",
      "Delivered KHDA / ADEK-aligned curriculum to a multicultural classroom of __ nationalities.",
      "Designed and delivered __ training programmes for __ learners.",
      "Raised student / learner satisfaction scores to __% over __ terms.",
      "Mentored __ junior staff and led __ extracurricular initiatives.",
    ],
  },
  {
    family: "customerservice",
    label: "Customer Service & Call Centre",
    bullets: [
      "Resolved __ customer queries per day, maintaining a CSAT score of __%.",
      "Handled inbound and outbound contact across __ languages for the UAE market.",
      "Reduced average handling time by __% while keeping first-contact resolution above __%.",
      "Supported __ customers across __ nationalities with multilingual service.",
      "Escalated and resolved complex cases, improving retention by __%.",
    ],
  },
];

// Universal fallback — strong, structure-teaching bullets for any role.
const GENERIC: string[] = [
  "Led __ projects / initiatives, delivering measurable results within budget and on time.",
  "Managed a team of __ across multiple nationalities in a fast-paced UAE environment.",
  "Improved __ by __% through a specific process change you introduced.",
  "Handled a budget / portfolio of AED __, ensuring accuracy and accountability.",
  "Collaborated with __ cross-functional stakeholders to deliver __.",
];

export type IdeaMatch = {
  family: RoleFamily;
  label: string;
  bullets: string[];
};

/**
 * Returns role-matched idea bullets. The family is the caller-supplied
 * `domain` (user-confirmed) when given, otherwise inferred from the job title.
 * Falls back to GENERIC when the title is empty/unmatched, so the panel is
 * never empty.
 *
 * @param jobTitle  the role title the user typed (any case)
 * @param exclude   bullets already present, excluded from the result
 * @param domain    optional confirmed domain that overrides title inference
 */
export function suggestionsForRole(
  jobTitle: string | undefined,
  exclude: string[] = [],
  domain?: RoleFamily,
): IdeaMatch {
  const excludeSet = new Set(exclude.map((b) => b.trim()));

  const family =
    domain && domain !== "generic" ? domain : inferRoleFamily(jobTitle).family;

  const match =
    family !== "generic"
      ? ROLE_LIBRARY.find((r) => r.family === family)
      : undefined;

  if (match) {
    return {
      family: match.family,
      label: match.label,
      bullets: match.bullets.filter((b) => !excludeSet.has(b.trim())),
    };
  }

  return {
    family: "generic",
    label: "General achievements",
    bullets: GENERIC.filter((b) => !excludeSet.has(b.trim())),
  };
}
