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
 * Matching is keyword-based against the job title (see suggestionsForRole).
 * GENERIC is the always-available fallback so every role gets ideas.
 */

export type RoleFamily =
  | "sales"
  | "marketing"
  | "finance"
  | "accounting"
  | "operations"
  | "logistics"
  | "hr"
  | "admin"
  | "engineering"
  | "it"
  | "hospitality"
  | "retail"
  | "realestate"
  | "healthcare"
  | "education"
  | "customerservice"
  | "generic";

type RoleMatcher = {
  family: RoleFamily;
  label: string;
  // Lowercased keywords tested against the job title (see matchesRoleKeyword).
  // A keyword that ends with a SPACE ("pro ", "bd ", "gm ", "ops ") is a
  // whole-word marker — matched only as a standalone word. Keywords without a
  // trailing space ("sales", "account", "engineer") are plain substrings.
  keywords: string[];
  bullets: string[];
};

/**
 * Each entry's bullets leave a blank (the "__") for a real number. We never
 * pre-fill metrics — fabricated numbers are a fail in an interview, and the
 * product's whole pitch is honesty.
 */
const ROLE_LIBRARY: RoleMatcher[] = [
  {
    family: "sales",
    label: "Sales & Business Development",
    keywords: ["sales", "business development", "account manager", "bd ", "key account", "relationship manager"],
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
    keywords: ["marketing", "digital", "brand", "social media", "content", "seo", "growth"],
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
    keywords: ["finance", "financial", "fp&a", "treasury", "investment", "credit"],
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
    keywords: ["account", "audit", "bookkeep", "ledger", "ifrs", "vat", "tax"],
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
    keywords: ["operations", "operation", "general manager", "gm ", "coo", "ops "],
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
    keywords: ["logistics", "supply chain", "procurement", "warehouse", "fleet", "import", "export", "freight"],
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
    keywords: ["hr ", "human resources", "recruit", "talent", "people", "hr manager", "hr officer"],
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
    keywords: ["admin", "secretary", "executive assistant", "pro ", "public relations", "office manager", "coordinator", "receptionist"],
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
    keywords: ["engineer", "engineering", "construction", "civil", "mechanical", "electrical", "mep", "project engineer", "site"],
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
    keywords: ["developer", "software", "it ", "engineer", "data", "system", "network", "devops", "qa ", "analyst", "programmer"],
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
    keywords: ["hospitality", "hotel", "f&b", "food", "beverage", "chef", "restaurant", "guest", "concierge", "front office", "housekeeping"],
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
    keywords: ["retail", "store", "sales associate", "merchandis", "cashier", "boutique", "mall"],
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
    keywords: ["real estate", "property", "leasing", "broker", "realtor", "rera"],
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
    keywords: ["nurse", "doctor", "medical", "health", "clinic", "patient", "pharmac", "dha", "haad", "moh"],
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
    keywords: ["teacher", "tutor", "lecturer", "trainer", "education", "academic", "instructor", "kg ", "school"],
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
    keywords: ["customer service", "call center", "call centre", "support", "csr", "client service", "help desk"],
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
 * Whole-word-aware keyword test honoring the trailing-space convention.
 *
 * A keyword that ends with a space (e.g. "pro ", "bd ", "gm ", "ops ", and in
 * other families "it ", "qa ", "hr ", "kg ") is a whole-word marker: it must
 * match a standalone word in the title, never a substring of a larger word —
 * so "pro " fires on the title "PRO" but NOT on "Process Excellence Manager".
 * Keywords without a trailing space ("sales", "account", "engineer") stay
 * plain substrings, as intended.
 *
 * The previous implementation did `title.includes(kw.trim())`, which stripped
 * the marker space and let "pro " leak into "process", "bd " into "brand", etc.
 *
 * @param title    already lowercased + trimmed job title
 * @param keyword  a keyword from a role family's list (may carry a trailing space)
 */
export function matchesRoleKeyword(title: string, keyword: string): boolean {
  if (keyword.endsWith(" ")) {
    return ` ${title} `.includes(` ${keyword.trim()} `);
  }
  return title.includes(keyword);
}

/**
 * Returns role-matched idea bullets for a job title. Falls back to GENERIC
 * when the title is empty or unmatched, so the panel is never empty.
 *
 * @param jobTitle  the role title the user typed (any case)
 * @param exclude   bullets already present, excluded from the result
 */
export function suggestionsForRole(
  jobTitle: string | undefined,
  exclude: string[] = [],
): IdeaMatch {
  const title = (jobTitle ?? "").toLowerCase().trim();
  const excludeSet = new Set(exclude.map((b) => b.trim()));

  let match: RoleMatcher | undefined;
  if (title) {
    match = ROLE_LIBRARY.find((r) =>
      r.keywords.some((kw) => matchesRoleKeyword(title, kw)),
    );
  }

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
