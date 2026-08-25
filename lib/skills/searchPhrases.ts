/**
 * Colloquial search phrases — the plain-language words people use for work,
 * mapped to the term the market indexes on.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * The research ranked NAMING as the #1 friction at the skills step, ahead of
 * everything else: users are not short of skills, they are short of the NOUN.
 * They know they "do the visa paperwork"; they do not know the CV word is
 * "Amer (GDRFA Dubai)". A search box that only matches canonical names and
 * acronyms is useless to exactly the person who needs it, because it requires
 * them to already know the answer they came here for.
 *
 * It bites hardest in the segments a UAE builder serves in volume — retail,
 * hospitality, admin, security, drivers, PRO/typist — where the section's
 * implicit frame reads as "software" and the user concludes they have nothing.
 *
 * ── THE HARD RULE: SEARCH ONLY ──────────────────────────────────────────────
 *
 * These phrases are matched against what the user TYPES INTO THE SEARCH BOX.
 * They are NEVER used as evidence aliases and must never be passed to
 * lib/skills/evidence.ts.
 *
 * That separation is load-bearing. "dealing with customers" is a fine hint that
 * someone means Complaint Resolution when they type it deliberately. It is NOT
 * proof of Complaint Resolution when it happens to appear in a bullet — a CV
 * reading "a colleague was dealing with customers while I restocked" would
 * otherwise be turned into a skill claim the user never made. Evidence needs
 * the strict, curated alias list in lib/data/domainSkills.ts; search can afford
 * to be generous because the user is steering it and sees the result before
 * anything is added.
 *
 * Keys are canonical names from the domain bank (or the soft-skill bank).
 * A key that no longer exists in either bank is dead weight — the test suite
 * checks for that.
 */

/** canonical skill name → phrases someone might type instead */
export const SEARCH_PHRASES: Record<string, string[]> = {
  // ── Admin / PRO / government portals ──────────────────────────────────────
  "Amer (GDRFA Dubai)": [
    "visa paperwork", "visa processing", "residence visa", "immigration paperwork",
    "visa renewal", "pro work", "government paperwork",
  ],
  "Tasheel (MOHRE)": [
    "labour card", "work permit", "labour contract", "mohre paperwork",
    "employment paperwork", "pro work",
  ],
  "TAMM (Abu Dhabi)": ["abu dhabi government portal", "abu dhabi paperwork"],
  "Document Control": [
    "filing", "paperwork", "keeping records", "record keeping", "organising files",
    "document filing",
  ],
  "Calendar Management": [
    "booking meetings", "scheduling", "diary", "arranging appointments",
    "managing the calendar",
  ],
  "Travel Coordination": [
    "booking flights", "travel booking", "arranging travel", "hotel booking",
  ],
  "Minute Taking": ["taking notes in meetings", "meeting notes", "writing minutes"],
  "MS Office 365": [
    "microsoft office", "word and excel", "computer skills", "office software",
    "spreadsheets", "typing",
  ],

  // ── Customer service / retail / hospitality ───────────────────────────────
  "Complaint Resolution": [
    "dealing with customers", "angry customers", "handling complaints",
    "difficult customers", "sorting out problems", "customer problems",
    "calming people down",
  ],
  "Call Centre Operations": [
    "answering phones", "taking calls", "phone work", "call center",
    "handling calls", "customer calls",
  ],
  "Live Chat Support": ["online chat", "chat support", "replying to messages"],
  "Multilingual Support": [
    "speaking arabic with customers", "translating for customers", "two languages",
    "bilingual",
  ],
  "CSAT / NPS": ["customer feedback", "customer satisfaction scores", "reviews"],
  "Guest Relations": [
    "looking after guests", "welcoming guests", "front desk", "reception",
    "meeting and greeting",
  ],
  "POS Systems": [
    "till", "cash register", "checkout", "scanning items", "point of sale",
    "billing customers",
  ],
  "Visual Merchandising": [
    "arranging displays", "shop displays", "window display", "arranging shelves",
    "making the shop look good",
  ],
  "Stock Replenishment": [
    "restocking", "filling shelves", "putting stock out", "shelf stacking",
  ],
  "Inventory Management": [
    "counting stock", "stock take", "stock control", "keeping track of stock",
    "ordering stock",
  ],
  "Loss Prevention": ["stopping theft", "shoplifting", "security checks", "shrinkage"],
  Upselling: [
    "selling extras", "suggesting more products", "increasing the basket",
    "offering add ons",
  ],
  "Food & Beverage Cost Control": [
    "food cost", "controlling waste", "portion control", "kitchen costs",
  ],
  HACCP: ["food safety", "food hygiene", "kitchen hygiene", "safe food handling"],
  "Opera PMS": ["hotel system", "hotel booking system", "check in system"],
  "Micros POS": ["restaurant till", "restaurant system", "ordering system"],

  // ── Sales ─────────────────────────────────────────────────────────────────
  Negotiation: [
    "getting a better price", "agreeing prices", "haggling", "closing deals",
    "bargaining",
  ],
  "Key Account Management": [
    "looking after big clients", "managing clients", "client relationships",
    "handling accounts",
  ],
  "Lead Generation": [
    "finding customers", "cold calling", "finding new business", "prospecting",
  ],
  "Pipeline Management": ["tracking deals", "sales tracking", "following up leads"],
  "B2B Sales": ["selling to businesses", "corporate sales", "business clients"],

  // ── Finance / accounting ──────────────────────────────────────────────────
  "Bank Reconciliation": [
    "matching the bank statement", "checking the bank", "reconciling accounts",
  ],
  "Accounts Payable / Receivable": [
    "paying suppliers", "chasing payments", "invoices", "collecting money",
    "supplier payments",
  ],
  "General Ledger": ["book keeping", "bookkeeping", "posting entries", "the books"],
  "Budgeting & Forecasting": [
    "planning the budget", "forecasting", "predicting costs", "budgets",
  ],
  "UAE VAT / FTA": ["vat returns", "tax filing", "filing tax", "vat"],
  "UAE Corporate Tax": ["corporate tax", "company tax", "9% tax"],
  "Financial Modelling": ["building models", "excel models", "financial models"],

  // ── Logistics / procurement / operations ──────────────────────────────────
  "Supply Chain Management": [
    "getting goods delivered", "supply chain", "moving goods", "logistics",
  ],
  "Customs Clearance": [
    "customs paperwork", "clearing shipments", "import export", "customs",
    "shipping documents",
  ],
  "Warehouse Management (WMS)": [
    "running the warehouse", "warehouse", "storing goods", "picking and packing",
  ],
  "Freight Forwarding": ["shipping", "arranging shipments", "cargo", "containers"],
  "Vendor Management": [
    "dealing with suppliers", "supplier relationships", "managing suppliers",
    "choosing suppliers",
  ],
  "Process Improvement": [
    "making things faster", "improving the process", "cutting waste",
    "making work easier", "streamlining",
  ],
  "KPI Reporting": ["reporting numbers", "monthly reports", "targets", "performance reports"],

  // ── HR / payroll ──────────────────────────────────────────────────────────
  "WPS Payroll": ["paying salaries", "payroll", "salary transfer", "wages"],
  "Talent Acquisition": [
    "hiring", "recruiting", "interviewing candidates", "finding staff",
  ],
  "Employee Relations": [
    "staff issues", "staff problems", "employee complaints", "grievances",
  ],
  Onboarding: ["new joiners", "inducting new staff", "settling in new employees"],
  "Gratuity / End-of-Service": ["end of service", "gratuity", "final settlement"],
  "UAE Labour Law": ["labour law", "employment law", "uae labor law"],

  // ── Engineering / construction / HSE ──────────────────────────────────────
  "QA / QC": [
    "checking quality", "quality checks", "inspections", "making sure it's right",
  ],
  "Primavera P6": ["project schedule", "programme", "planning software", "p6"],
  AutoCAD: ["drawings", "technical drawings", "drafting", "cad drawings"],
  "MEP Coordination": ["mechanical electrical plumbing", "mep", "services coordination"],
  "NEBOSH IGC": ["health and safety certificate", "safety certificate", "hse certificate"],
  "IOSH Managing Safely": ["safety training", "iosh"],

  // ── Healthcare ────────────────────────────────────────────────────────────
  "Patient Care": ["looking after patients", "caring for patients", "bedside care"],
  "Infection Control": ["hygiene", "sterilising", "preventing infection", "ppe"],
  "Electronic Medical Records (EMR)": [
    "patient records", "medical records", "charting", "patient files",
  ],
  "DataFlow (PSV)": ["document verification", "primary source verification", "dataflow"],

  // ── Real estate ───────────────────────────────────────────────────────────
  "Property Management": [
    "looking after buildings", "managing properties", "landlord work", "maintenance",
  ],
  Leasing: ["renting out", "letting", "tenancy", "finding tenants"],
  Ejari: ["tenancy registration", "registering contracts", "ejari"],
  "RERA Broker Card": ["broker licence", "broker card", "estate agent licence"],

  // ── Education ─────────────────────────────────────────────────────────────
  "Lesson Planning": ["planning lessons", "preparing lessons", "schemes of work"],
  "Classroom Management": ["controlling the class", "managing behaviour", "discipline"],
  "Assessment Design": ["setting tests", "marking", "exams", "grading"],
};

/** Normalised for matching: lowercase, collapsed whitespace. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Canonical names whose colloquial phrases match the query.
 *
 * Matching is deliberately loose in ONE direction only: a phrase counts when
 * the user's query is contained in it, or it is contained in the user's query.
 * "customers" finds "dealing with customers"; "I was dealing with customers all
 * day" finds it too. This is safe precisely because it only ever surfaces a
 * SUGGESTION the user then chooses — nothing is added on a match.
 */
export function phraseMatches(query: string): string[] {
  const q = norm(query);
  if (q.length < 3) return [];
  const out: string[] = [];
  for (const [canonical, phrases] of Object.entries(SEARCH_PHRASES)) {
    for (const phrase of phrases) {
      const p = norm(phrase);
      if (p.includes(q) || q.includes(p)) {
        out.push(canonical);
        break;
      }
    }
  }
  return out;
}

/**
 * The phrase that caused the match, so the UI can explain itself:
 * "Amer (GDRFA Dubai) — the usual CV term for 'visa paperwork'".
 * Explaining WHY a result appeared is what turns a guess into a recognition.
 */
export function matchingPhrase(canonical: string, query: string): string | null {
  const q = norm(query);
  if (q.length < 3) return null;
  for (const phrase of SEARCH_PHRASES[canonical] ?? []) {
    const p = norm(phrase);
    if (p.includes(q) || q.includes(p)) return phrase;
  }
  return null;
}
