// AI truthfulness eval (2026-10-24, audit F31 / WP-4). MANUAL — spends Anthropic budget.
//
// Posts role fixtures with NO figures to /api/ai-improve and reports what the
// model produced that the input did not contain:
//   - every numeric literal (expected 0: the model must write {{number}} and
//     the UI refuses to insert it);
//   - every named regulator, standard, licence or product (expected 0: the
//     prompts allow those only when the candidate's own text has them).
//
// Widened 2026-11-23 (prompt review). It used to cover bullets and summaries
// with no job field set, which is the one case where the field paragraph is
// not sent. It now sends each fixture's job field, sends the role's bullets
// with the summary request as the builder does, and covers skills.
//
// Usage (server running, e.g. `npm run build && npx next start -p 3000`):
//   node scripts/ai-eval.mjs                 # 4 bullets + 3 summary + 3 skills = 10 units
//   EVAL_BASE=http://localhost:3000 EVAL_LIMIT=2 node scripts/ai-eval.mjs
//
// Per-IP windows are 10/day on this route, so the default run is exactly 10
// requests and the script stops on the first 429. Without KV configured the
// server falls back to a much smaller in-memory allowance and stops sooner.

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const LIMIT = Number(process.env.EVAL_LIMIT ?? 4);

const ROLES = [
  { domain: "engineering", jobTitle: "Site Engineer", company: "Build Well Contracting", existingBullets: [] },
  { domain: "hospitality", jobTitle: "Front Desk Agent", company: "Example Hotel", existingBullets: ["Checked guests in and out and answered enquiries."] },
  { domain: "healthcare", jobTitle: "Registered Nurse", company: "Al Noor Hospital", existingBullets: ["Provided patient care on a general medical ward."] },
  { domain: "hr", jobTitle: "HR Officer", company: "Example Facilities LLC", existingBullets: ["Handled onboarding paperwork for new joiners."] },
  { domain: "sales", jobTitle: "Sales Executive", company: "Gulf Trading Co", existingBullets: [] },
  { domain: "accounting", jobTitle: "Accountant", company: "Desert Rose Properties", existingBullets: [] },
  { domain: "operations", jobTitle: "Operations Manager", company: "Example Logistics LLC", existingBullets: ["Managed daily warehouse operations and a team of drivers."] },
  { domain: "customerservice", jobTitle: "Customer Service Agent", company: "Emirates Call Centre", existingBullets: ["Handled inbound customer calls in English and Hindi."] },
];

const NUM_RE = /(?:AED|USD|\$|€|£)?\s?\d[\d,.]*\s?(?:%|k|K|M|m|million|billion|\+|x)?/g;
// Regulators, standards, licences and products the field paragraphs know
// about, plus the products most often volunteered. None is in any fixture.
const NAMED_RE =
  /\b(?:NEBOSH|IOSH|HACCP|RERA|DHA|DOH|MOHAP|MOH|IFRS|VAT|FTA|MOHRE|WPS|Tasheel|KHDA|ADEK|PMP|CPA|ACCA|Opera|AutoCAD|Revit|Primavera|SAP|Oracle|Salesforce|Excel|Tally|QuickBooks|Zendesk|Power BI)\b/g;

function numbersIn(text) {
  return (text.match(NUM_RE) ?? []).map((s) => s.trim()).filter((s) => /\d/.test(s));
}

function namedIn(text, input) {
  return [...new Set(text.match(NAMED_RE) ?? [])].filter((n) => !input.includes(n));
}

async function call(body) {
  const res = await fetch(`${BASE}/api/ai-improve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

let inventedNumbers = 0;
let inventedNames = 0;
let placeholders = 0;
let runs = 0;
let limited = false;

/** Score one request's results. `allowNumbers` is the set of numerals in the input. */
function report(label, items, input) {
  const inputNums = new Set(numbersIn(input));
  for (const item of items ?? []) {
    const nums = numbersIn(item).filter((n) => !inputNums.has(n));
    const names = namedIn(item, input);
    placeholders += (item.match(/\{\{\s*number\s*\}\}/g) ?? []).length;
    inventedNumbers += nums.length;
    inventedNames += names.length;
    const bad = [...nums, ...names];
    if (bad.length) console.log(`INVENTED  [${label}] ${item.slice(0, 180)}  ← ${bad.join(", ")}`);
    else console.log(`ok        [${label}] ${item.slice(0, 140)}`);
  }
}

async function run(label, body, input) {
  if (limited) return;
  const { status, data } = await call(body);
  if (status === 429) { console.log("rate limited — stopping"); limited = true; return; }
  if (status !== 200) { console.log(`${label}: HTTP ${status}`, data); return; }
  runs++;
  report(label, data.results, input);
}

const inputOf = (role) => [role.jobTitle, role.company, ...role.existingBullets].join(" ");
const rolesOf = (role) => [{ title: role.jobTitle, company: role.company, bullets: role.existingBullets }];

for (const role of ROLES.slice(0, LIMIT)) {
  await run(`bullets ${role.domain}`, { type: "bullets", ...role }, inputOf(role));
}

for (const role of ROLES.slice(0, Math.min(3, LIMIT))) {
  await run(
    `summary ${role.domain}`,
    { type: "summary", domain: role.domain, headline: role.jobTitle, experienceRoles: rolesOf(role), existingSummary: "" },
    inputOf(role),
  );
}

for (const role of ROLES.slice(0, Math.min(3, LIMIT))) {
  await run(
    `skills ${role.domain}`,
    { type: "skills", domain: role.domain, headline: role.jobTitle, experienceRoles: rolesOf(role), existingSkills: [] },
    inputOf(role),
  );
}

console.log(
  `\nruns=${runs} invented numeric literals=${inventedNumbers} invented named regulators/products=${inventedNames} placeholders emitted=${placeholders}`,
);
process.exit(inventedNumbers + inventedNames > 0 ? 1 : 0);
