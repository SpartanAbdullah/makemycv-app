/**
 * AI skill suggestions may not name a product the candidate never mentioned
 * (2026-11-23, prompt review follow-up).
 *
 * The skills prompt says "name a specific product or system ONLY if it
 * appears in the experience above". A prompt is a request, not a guarantee:
 * the live check on 23 Nov still got "AutoCAD" for a site engineer who had
 * typed no tool at all. This is the check behind the request. A suggestion
 * that names a known product is dropped unless the candidate's own text
 * (headline, role titles, bullets, existing skills) names that product, or
 * another name of the same product family.
 *
 * Only brand and product names are listed. General categories ("ERP systems",
 * "CRM", "CAD software", "POS") are what the prompt asks for instead, so they
 * always pass. The builder's own skill chips (lib/data/domainSkills.ts) remain
 * the way to add a product in one tap: there the user is the one asserting it.
 *
 * Pure and dependency-free.
 */

/** Each group is one product family: any of its names in the input allows all of them. */
const PRODUCT_GROUPS: string[][] = [
  ["Microsoft Office", "MS Office", "Office 365", "Microsoft 365", "M365", "Excel", "Microsoft Word", "MS Word", "PowerPoint", "Outlook"],
  ["Power BI"],
  ["Tableau"],
  ["Salesforce", "SFDC"],
  ["HubSpot"],
  ["Zoho"],
  ["Microsoft Dynamics", "MS Dynamics", "Dynamics 365", "Dynamics CRM"],
  ["Zendesk"],
  ["Freshdesk"],
  ["Google Ads", "AdWords"],
  ["Meta Ads", "Facebook Ads", "Instagram Ads", "Meta Business Suite"],
  ["Google Analytics", "GA4"],
  ["SEMrush"],
  ["Ahrefs"],
  ["Mailchimp"],
  ["Canva"],
  ["Adobe", "Photoshop", "Illustrator", "InDesign", "Premiere Pro"],
  ["WordPress"],
  ["Shopify"],
  ["SAP", "S/4HANA", "SuccessFactors"],
  ["Oracle", "Primavera", "P6", "Opera PMS", "Oracle Opera", "Micros", "Simphony"],
  ["Odoo"],
  ["QuickBooks"],
  ["Xero"],
  ["Tally"],
  ["Zoho Books"],
  ["EmaraTax", "Emara Tax"],
  ["Workday"],
  ["Bayzat"],
  ["Tasheel", "Tas-heel"],
  ["TAMM"],
  ["Ejari"],
  ["Bayut"],
  ["Property Finder"],
  ["Dubizzle"],
  ["AutoCAD", "Auto CAD"],
  ["Revit"],
  ["Navisworks"],
  ["ETABS"],
  ["STAAD"],
  ["SolidWorks"],
  ["SketchUp"],
  ["MS Project", "Microsoft Project"],
  ["Python"],
  ["JavaScript", "TypeScript"],
  ["React.js", "ReactJS", "React"],
  ["Node.js", "NodeJS"],
  ["MySQL"],
  ["PostgreSQL"],
  ["AWS", "Amazon Web Services"],
  ["Azure"],
  ["Google Cloud", "GCP"],
  ["Docker"],
  ["Kubernetes", "K8s"],
  ["GitHub"],
  ["GitLab"],
  ["Jira"],
  ["Trello"],
  ["Asana"],
  ["Cerner"],
  ["Malaffi"],
  ["Google Classroom"],
  ["Seesaw"],
  ["Amadeus"],
  ["Galileo"],
  ["Sabre"],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-name match: "SAP" is not found in "disappear", "Excel" not in "excellent". */
const nameRe = (name: string) => new RegExp(`(?<![A-Za-z0-9])${escapeRe(name)}(?![A-Za-z0-9])`, "i");

const GROUPS = PRODUCT_GROUPS.map((names) => names.map(nameRe));

/** True when `suggestion` names a known product that `inputText` does not. */
export function namesUnmentionedProduct(suggestion: string, inputText: string): boolean {
  return GROUPS.some(
    (group) => group.some((re) => re.test(suggestion)) && !group.some((re) => re.test(inputText)),
  );
}

/** `suggestions` without those that name a product the candidate's text does not. */
export function dropUnmentionedProducts(suggestions: string[], inputText: string): string[] {
  return suggestions.filter((s) => !namesUnmentionedProduct(s, inputText));
}

/** Everything the candidate typed that a skills request carries, as one text. */
export function skillsInputText(input: {
  headline: string;
  experienceRoles: { title: string; company: string; bullets: string[] }[];
  existingSkills: string[];
}): string {
  return [
    input.headline,
    ...input.experienceRoles.flatMap((r) => [r.title, r.company, ...r.bullets]),
    ...input.existingSkills,
  ].join("\n");
}
