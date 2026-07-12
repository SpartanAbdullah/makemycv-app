import type { CvData, CvSettings } from "../types/cv";

/**
 * Realistic UAE dummy profiles used ONLY by the chrome-less capture route
 * (app/preview/[templateId]) to render marketing screenshots of the real
 * templates. Pure data — never touches the Zustand store or localStorage.
 *
 * Conventions (deliberate):
 *  - Phone numbers are masked ("+971 50 4XX XXXX") so no real number is shown.
 *  - Emails use the non-routable @email.ae placeholder domain.
 *  - Names/companies are fictional personas; "Omar Al-Hashimi / Emirates NBD"
 *    is the persona already used on the marketing site — keep consistent.
 */

const baseSettings = (templateId: string, accentColor = "#1e5b54"): CvSettings => ({
  templateId,
  accentColor,
  fontScale: 1,
  fontFamily: "sans",
  // Density level 3 = neutral (×1.0) on every axis — matches builder defaults.
  pageMargins: 3,
  fontSize: 3,
  lineHeight: 3,
  sectionSpacing: 3,
  sectionOrder: [
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "certifications",
    "projects",
  ],
  photoShape: "round",
});

/** classic — senior finance professional (persona shared with marketing site). */
const omarClassic: CvData = {
  personal: {
    firstName: "Omar",
    lastName: "Al-Hashimi",
    headline: "Senior Finance Manager",
    email: "omar.alhashimi@email.ae",
    phone: "+971 50 4XX XXXX",
    location: "Dubai, UAE",
    website: "",
    linkedin: "linkedin.com/in/omar-alhashimi",
    summary:
      "Senior finance manager with 12 years across UAE banking and corporate FP&A. " +
      "Track record of leading multi-entity budgeting cycles, tightening close " +
      "processes and building Power BI reporting layers that leadership actually " +
      "uses. CFA charterholder, fluent in Arabic and English.",
    nationality: "Jordanian",
    visaStatus: "UAE Residence Visa",
    availability: "1 month notice",
  },
  experience: [
    {
      id: "omar-exp-1",
      company: "Emirates NBD",
      role: "Senior Finance Manager",
      location: "Dubai, UAE",
      startDate: "2019-03",
      endDate: "",
      isCurrent: true,
      bullets: [
        "Led AED 120M budget planning across 4 GCC entities, aligning group targets with country CFOs",
        "Cut monthly close cycle from 9 to 5 days by re-sequencing intercompany reconciliations in SAP",
        "Built a Power BI FP&A layer covering 30+ cost centres, replacing 14 manual Excel packs",
        "Partnered with retail banking leadership on pricing reviews that lifted product NIM by 40bps",
      ],
    },
    {
      id: "omar-exp-2",
      company: "Al-Futtaim Group",
      role: "Finance Manager — FP&A",
      location: "Dubai, UAE",
      startDate: "2014-06",
      endDate: "2019-02",
      isCurrent: false,
      bullets: [
        "Owned quarterly forecasting for an AED 300M automotive P&L across UAE and Oman",
        "Standardised IFRS reporting packs across 6 business units, cutting review cycles by a third",
        "Managed a team of 4 analysts through 5 clean external audit cycles",
      ],
    },
    {
      id: "omar-exp-3",
      company: "KPMG Lower Gulf",
      role: "Financial Analyst",
      location: "Dubai, UAE",
      startDate: "2012-09",
      endDate: "2014-05",
      isCurrent: false,
      bullets: [
        "Supported statutory audits for 12 UAE clients across banking and real estate",
        "Built variance-analysis workpapers adopted as the team's standard template",
      ],
    },
  ],
  education: [
    {
      id: "omar-edu-1",
      school: "American University of Sharjah",
      degree: "BSc Finance",
      field: "Finance",
      startDate: "2008",
      endDate: "2012",
      notes: "Graduated with Distinction",
    },
  ],
  skills: [
    { id: "omar-sk-1", name: "IFRS Reporting" },
    { id: "omar-sk-2", name: "FP&A & Budgeting" },
    { id: "omar-sk-3", name: "Financial Modelling" },
    { id: "omar-sk-4", name: "Stakeholder Management" },
    { id: "omar-sk-5", name: "SAP S/4HANA", category: "technical" },
    { id: "omar-sk-6", name: "Power BI", category: "technical" },
    { id: "omar-sk-7", name: "Advanced Excel", category: "technical" },
  ],
  languages: [
    { id: "omar-lang-1", name: "Arabic", level: "native" },
    { id: "omar-lang-2", name: "English", level: "full_professional" },
  ],
  certifications: [
    {
      id: "omar-cert-1",
      name: "CFA Charterholder",
      issuer: "CFA Institute",
      date: "2016",
    },
  ],
  projects: [],
  settings: baseSettings("classic"),
};

/** modern — digital marketing professional. */
const saraModern: CvData = {
  personal: {
    firstName: "Sara",
    lastName: "Mahmoud",
    headline: "Digital Marketing Lead",
    email: "sara.mahmoud@email.ae",
    phone: "+971 55 2XX XXXX",
    location: "Dubai, UAE",
    website: "sara-mahmoud.ae",
    linkedin: "linkedin.com/in/sara-mahmoud-dxb",
    summary:
      "Digital marketing lead with 8 years scaling performance and lifecycle " +
      "marketing for UAE consumer brands. Comfortable owning the full funnel — " +
      "paid acquisition, SEO, CRM journeys and attribution — with budgets above " +
      "AED 10M a year and a bias for measurable growth.",
    nationality: "Egyptian",
    visaStatus: "UAE Residence Visa",
    availability: "Immediately",
  },
  experience: [
    {
      id: "sara-exp-1",
      company: "Careem",
      role: "Digital Marketing Lead",
      location: "Dubai, UAE",
      startDate: "2021-04",
      endDate: "",
      isCurrent: true,
      bullets: [
        "Scaled paid acquisition across UAE and KSA, cutting blended CAC 31% while doubling installs",
        "Grew organic sessions from 180K to 540K per month in 14 months through SEO and content ops",
        "Rebuilt lifecycle journeys in Braze, lifting 30-day retention by 4.2 points",
        "Managed an AED 12M annual media budget across Google, Meta, TikTok and programmatic",
      ],
    },
    {
      id: "sara-exp-2",
      company: "Mashreq Bank",
      role: "Digital Marketing Specialist",
      location: "Dubai, UAE",
      startDate: "2017-09",
      endDate: "2021-03",
      isCurrent: false,
      bullets: [
        "Ran always-on acquisition for retail banking products, delivering 25K qualified leads a year",
        "Launched the bank's first bilingual (Arabic/English) social content programme",
        "Cut cost-per-lead 22% by restructuring search campaigns around intent tiers",
      ],
    },
  ],
  education: [
    {
      id: "sara-edu-1",
      school: "University of Sharjah",
      degree: "BBA Marketing",
      field: "Marketing",
      startDate: "2012",
      endDate: "2016",
    },
  ],
  skills: [
    { id: "sara-sk-1", name: "Performance Marketing" },
    { id: "sara-sk-2", name: "SEO & Content Strategy" },
    { id: "sara-sk-3", name: "CRM & Lifecycle" },
    { id: "sara-sk-4", name: "Brand Campaigns" },
    { id: "sara-sk-5", name: "Google Ads", category: "technical" },
    { id: "sara-sk-6", name: "Meta Ads", category: "technical" },
    { id: "sara-sk-7", name: "GA4 & Attribution", category: "technical" },
    { id: "sara-sk-8", name: "Braze", category: "technical" },
  ],
  languages: [
    { id: "sara-lang-1", name: "Arabic", level: "native" },
    { id: "sara-lang-2", name: "English", level: "full_professional" },
  ],
  certifications: [
    {
      id: "sara-cert-1",
      name: "Google Ads Certification",
      issuer: "Google",
      date: "2023",
    },
    {
      id: "sara-cert-2",
      name: "Meta Blueprint — Media Buying",
      issuer: "Meta",
      date: "2022",
    },
  ],
  projects: [],
  settings: baseSettings("modern"),
};

/** executive — C-suite operations leader. Navy accent = template's signature. */
const laylaExecutive: CvData = {
  personal: {
    firstName: "Layla",
    lastName: "Khoury",
    headline: "Chief Operating Officer",
    email: "layla.khoury@email.ae",
    phone: "+971 50 6XX XXXX",
    location: "Abu Dhabi, UAE",
    website: "",
    linkedin: "linkedin.com/in/layla-khoury",
    summary:
      "Chief Operating Officer with 18+ years leading large-scale operations " +
      "across the GCC and wider MENA. P&L ownership above USD 80M, with a " +
      "record of restructuring organisations, driving EBITDA growth and " +
      "delivering operational excellence programmes in real estate and retail.",
    nationality: "Lebanese",
    visaStatus: "UAE Residence Visa",
    availability: "3 months notice",
  },
  experience: [
    {
      id: "layla-exp-1",
      company: "Aldar Properties",
      role: "Chief Operating Officer",
      location: "Abu Dhabi, UAE",
      startDate: "2018-01",
      endDate: "",
      isCurrent: true,
      bullets: [
        "Restructured a 350-person operations organisation into asset-class verticals, removing 3 management layers",
        "Delivered 22% YoY EBITDA growth by renegotiating FM contracts and digitising community operations",
        "Own a USD 80M+ operating P&L spanning residential, retail and hospitality portfolios",
        "Sponsored a group-wide ERP and CAFM replacement delivered on time across 60+ assets",
      ],
    },
    {
      id: "layla-exp-2",
      company: "Emaar Properties",
      role: "VP Operations",
      location: "Dubai, UAE",
      startDate: "2011-05",
      endDate: "2017-12",
      isCurrent: false,
      bullets: [
        "Led community and asset operations for a portfolio of 25K+ residential units",
        "Cut service-charge cost per unit 15% over three years without service-level erosion",
        "Built the operations playbook later adopted across international ventures",
        "Scaled the handover team from 90 to 220 through two record delivery years",
      ],
    },
    {
      id: "layla-exp-3",
      company: "Majid Al Futtaim",
      role: "Regional Operations Director",
      location: "Dubai, UAE",
      startDate: "2006-02",
      endDate: "2011-04",
      isCurrent: false,
      bullets: [
        "Directed mall operations across 4 GCC markets through a period of rapid expansion",
        "Launched the group's first centralised command centre for facilities incidents",
        "Delivered AED 30M in energy savings via BMS retrofits across the mall portfolio",
      ],
    },
  ],
  education: [
    {
      id: "layla-edu-1",
      school: "London Business School",
      degree: "MBA",
      field: "General Management",
      startDate: "2004",
      endDate: "2006",
    },
    {
      id: "layla-edu-2",
      school: "American University of Beirut",
      degree: "BEng Civil Engineering",
      field: "Civil Engineering",
      startDate: "1998",
      endDate: "2002",
    },
  ],
  skills: [
    { id: "layla-sk-1", name: "P&L Ownership" },
    { id: "layla-sk-2", name: "Corporate Strategy" },
    { id: "layla-sk-3", name: "Operational Excellence" },
    { id: "layla-sk-4", name: "Org Design & Restructuring" },
    { id: "layla-sk-5", name: "Digital Transformation" },
    { id: "layla-sk-6", name: "Board & Investor Relations" },
  ],
  languages: [
    { id: "layla-lang-1", name: "Arabic", level: "native" },
    { id: "layla-lang-2", name: "English", level: "full_professional" },
    { id: "layla-lang-3", name: "French", level: "professional" },
  ],
  certifications: [
    {
      id: "layla-cert-1",
      name: "Executive Leadership Programme",
      issuer: "INSEAD",
      date: "2015",
    },
  ],
  projects: [],
  settings: baseSettings("executive", "#1E2A4A"),
};

/**
 * ats-clean — fresh-graduate persona. Chosen over "professional" because fresh
 * grads overwhelmingly apply through portals/ATS, and ATS Clean is the registry's
 * single-column maximum-parse layout with prominent education + technical skills.
 */
const aishaGraduate: CvData = {
  personal: {
    firstName: "Aisha",
    lastName: "Al-Mansouri",
    headline: "Business Graduate — Aspiring Financial Analyst",
    email: "aisha.almansouri@email.ae",
    phone: "+971 56 7XX XXXX",
    location: "Sharjah, UAE",
    website: "",
    linkedin: "linkedin.com/in/aisha-almansouri",
    summary:
      "Recent BSc Business Administration graduate (Finance concentration, GPA " +
      "3.7) from the American University of Sharjah, with a data-focused " +
      "internship at Majid Al Futtaim. Seeking an entry-level analyst role in " +
      "Dubai or Sharjah where strong Excel, Power BI and research skills can " +
      "contribute from day one.",
    nationality: "Emirati",
    visaStatus: "UAE National",
    availability: "Immediately",
  },
  experience: [
    {
      id: "aisha-exp-1",
      company: "Majid Al Futtaim",
      role: "Business Analyst Intern",
      location: "Dubai, UAE",
      startDate: "2025-06",
      endDate: "2025-08",
      isCurrent: false,
      bullets: [
        "Built a Power BI dashboard tracking footfall and conversion for 12 mall assets, used in weekly trading reviews",
        "Cleaned and reconciled 18 months of leasing data in Excel, cutting report preparation time by half",
        "Presented a competitor pricing study to the revenue team, adopted for two lease renewals",
      ],
    },
    {
      id: "aisha-exp-2",
      company: "American University of Sharjah",
      role: "Research Assistant — School of Business",
      location: "Sharjah, UAE",
      startDate: "2024-09",
      endDate: "2025-05",
      isCurrent: false,
      bullets: [
        "Collected and coded survey data for a study on GCC consumer fintech adoption (n = 1,200)",
        "Automated descriptive statistics in Excel, saving the research team roughly 6 hours per week",
      ],
    },
  ],
  education: [
    {
      id: "aisha-edu-1",
      school: "American University of Sharjah",
      degree: "BSc Business Administration",
      field: "Finance",
      startDate: "2021",
      endDate: "2025",
      notes: "GPA 3.7 / 4.0 — Dean's List (4 semesters)",
    },
  ],
  skills: [
    { id: "aisha-sk-1", name: "Financial Analysis" },
    { id: "aisha-sk-2", name: "Market Research" },
    { id: "aisha-sk-3", name: "Report Writing" },
    { id: "aisha-sk-4", name: "Presentation Skills" },
    { id: "aisha-sk-5", name: "Advanced Excel", category: "technical" },
    { id: "aisha-sk-6", name: "Power BI", category: "technical" },
    { id: "aisha-sk-7", name: "SQL (basic)", category: "technical" },
    { id: "aisha-sk-8", name: "PowerPoint", category: "technical" },
  ],
  languages: [
    { id: "aisha-lang-1", name: "Arabic", level: "native" },
    { id: "aisha-lang-2", name: "English", level: "full_professional" },
  ],
  certifications: [
    {
      id: "aisha-cert-1",
      name: "Google Data Analytics Certificate",
      issuer: "Coursera",
      date: "2025",
    },
  ],
  projects: [
    {
      id: "aisha-proj-1",
      name: "Capstone: UAE Retail REIT Valuation",
      bullets: [
        "Built a DCF and comparables model for a listed UAE REIT; graded A and presented to faculty panel",
      ],
    },
  ],
  settings: baseSettings("ats-clean"),
};

/** Profiles keyed by the template id they are designed for. */
export const previewProfiles: Record<string, CvData> = {
  classic: omarClassic,
  modern: saraModern,
  executive: laylaExecutive,
  "ats-clean": aishaGraduate,
};

/** Template ids the capture pipeline screenshots (scripts/capture-previews.js). */
export const previewTemplateIds = Object.keys(previewProfiles);

/**
 * Profile for a template id. Templates without a dedicated persona reuse the
 * classic (Omar) profile re-pointed at the requested template so any
 * /preview/<id> URL renders real content.
 */
export function getPreviewProfile(templateId: string): CvData {
  const exact = previewProfiles[templateId];
  if (exact) return exact;
  return {
    ...omarClassic,
    settings: { ...omarClassic.settings, templateId },
  };
}
