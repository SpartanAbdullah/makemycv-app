/**
 * PDF smoke render — exports all 10 templates with a stress-test fixture so
 * output regressions are caught without clicking through the app.
 *
 * Run: npm run test:pdf-smoke   (also part of the aggregate `npm test`)
 * Output: .smoke-pdfs/<templateId>.pdf
 *
 * Exit 0 = pass (every template rendered without throwing). The
 * "Incomplete or corrupt PNG file" warnings are expected — the fixture's
 * 1x1 base64 photo exists purely to exercise the <Image> path.
 *
 * The fixture deliberately stresses the known failure modes: long name +
 * long email (sidebar hyphenation), scheme-less URLs (link normalization),
 * mixed-case skill names (casing corruption), a 10-bullet role (page-break
 * behavior), and yyyy-mm dates (date normalization).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import ReactPDF from "@react-pdf/renderer";
import { CVDocument } from "../components/pdf/CVDocument";
import type { CvData } from "../lib/types/cv";

const fixture: CvData = {
  personal: {
    firstName: "Abdullah",
    lastName: "Muhammad",
    headline: "Odoo Administrator",
    email: "sendmailtoabdullah@gmail.com",
    phone: "+971 56 910 0798",
    location: "Dubai, UAE",
    website: "makemycv.ae",
    linkedin: "linkedin.com/in/abdullah2431",
    summary:
      "Proficient Odoo Administrator with 3 years of specialized expertise in ERP system administration, configuration, and technical support. Core competencies include Odoo module management, database administration, customization, user training, and workflow optimization. Skilled in troubleshooting complex system issues, ensuring data integrity, and maintaining peak operational performance.",
    nationality: "Pakistan",
    visaStatus: "Employment visa",
    availability: "30 days notice",
    drivingLicense: "UAE Light Vehicle",
    // 1x1 PNG so photo-bearing layouts exercise their <Image> path.
    photo:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    showPhoto: true,
  },
  experience: [
    {
      id: "exp1",
      company: "Interior360 General Trading LLC",
      role: "Odoo Administrator",
      location: "Dubai",
      startDate: "2025-02",
      endDate: "",
      isCurrent: true,
      bullets: [
        "Manage Odoo database & codebase using Odoo.sh with daily staging rebuilds and automated backup verification across three environments",
        "Odoo 17 Enterprise edition administration covering access rights, record rules, and scheduled actions for 45+ internal users",
        "Configuration & process design for CRM, Sale, Purchase, Accounting, Inventory, Employee, and Payroll applications",
        "Odoo implementation & user training with role-specific playbooks and quarterly refresher workshops",
        "Custom module building & managing, including a bespoke project-costing module integrated with analytic accounting",
        "Developed & integrated Outlook email logging into Contacts & CRM with marked activities and SLA timers",
        "Developed custom reporting in QWeb and spreadsheet dashboards consumed by management weekly",
        "Reduced inventory discrepancy by 8% through cycle-count automation and barcode workflows",
        "Introduced LinkedIn learning tracks for team development with completion tracking in Odoo",
        "Managed petty cash of warehouse & expense management digitization end to end",
      ],
    },
    {
      id: "exp2",
      company: "Al Huzaifa Furniture",
      role: "Warehouse Administrator",
      location: "Sharjah",
      startDate: "2022-11",
      endDate: "2025-02",
      isCurrent: false,
      bullets: [
        "Managed warehouse work force of 12 across two shifts",
        "Prepared inventory reports and reduced discrepancy by 8%",
        "Improved attendance & salary register system with biometric integration",
      ],
    },
  ],
  education: [
    {
      id: "edu1",
      school: "Virtual University of Pakistan",
      degree: "ADP in Web Design & Development",
      field: "Web Engineering",
      startDate: "2017",
      endDate: "2022",
      notes: "Graduated with Distinction",
      attested: true,
      attestingBody: "MOFA – UAE Ministry of Foreign Affairs",
    },
  ],
  skills: [
    { id: "s1", name: "JavaScript" },
    { id: "s2", name: "PostgreSQL" },
    { id: "s3", name: "Odoo.sh Platform Management" },
    { id: "s4", name: "iOS Companion Apps" },
    { id: "s5", name: "ERP Process Optimization" },
    { id: "s6", name: "Database Administration" },
    { id: "s7", name: "Team Leadership & Workforce Management" },
    { id: "s8", name: "Financial Reporting & Analysis" },
  ],
  languages: [
    { id: "l1", name: "English", level: "professional" },
    { id: "l2", name: "Arabic", level: "elementary" },
    { id: "l3", name: "Urdu", level: "native" },
  ],
  certifications: [
    {
      id: "c1",
      name: "Google Project Management Professional Certificate",
      issuer: "Google",
      date: "Sep 2025",
    },
    {
      id: "c2",
      name: "McKinsey Forward Program",
      issuer: "McKinsey.org",
      date: "April 2025",
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Hisaab",
      link: "usehisaab.com",
      bullets: [
        "Built an app for expats to manage their expenses, splits, sharing accommodation or group sharing, plus loans management inside with notifications",
      ],
    },
    {
      id: "p2",
      name: "Long Link Stress Test",
      link: "github.com/abdullah/very-long-repository-name-for-wrap-testing",
      bullets: ["Verifies long URLs neither hyphenate nor overflow narrow columns"],
    },
  ],
  settings: { templateId: "classic" },
};

const TEMPLATE_IDS = [
  "classic",
  "modern",
  "executive",
  "ats-clean",
  "exec-split",
  "corp-sidebar",
  "professional",
  "professional-photo",
  "onyx",
  "sandstone",
];

async function main() {
  const outDir = join(process.cwd(), ".smoke-pdfs");
  mkdirSync(outDir, { recursive: true });
  for (const templateId of TEMPLATE_IDS) {
    const data: CvData = {
      ...fixture,
      settings: { ...fixture.settings, templateId },
    };
    const doc = createElement(CVDocument, { data, plan: "pro", templateId });
    const file = join(outDir, `${templateId}.pdf`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ReactPDF.renderToFile(doc as any, file);
    console.log(`rendered ${file}`);
  }
}

main().catch((err) => {
  console.error("smoke render failed:", err);
  process.exit(1);
});
