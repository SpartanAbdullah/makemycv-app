// Parser regression guard (audit Wave 3, Prompt 4 step 0).
//
// Runs the heuristic text parser against the fixtures in __fixtures__/ and
// asserts which fields each one yields. The fixtures are EXTRACTED-TEXT
// snapshots of four representative CV shapes — (a) clean single-column
// ATS-style, (b) two-column layout as pdf.js linearizes it, (c) a
// Word-export with UAE fields, (d) a scanned PDF's near-empty text layer —
// because PDF text extraction itself (pdfjs-dist + worker) is browser-only
// and is covered by manual QA; everything downstream of extraction is pure
// TypeScript and runs here in Node.
//
// Usage:  npm run test:parser
//   (compiles lib/importers/textParser.ts to .parser-test-build/ with tsc,
//    then runs this script — no new dependencies, per the wave-3 rules)
//
// DUMP=1 npm run test:parser   prints the full ParsedDocument per fixture.
//
// Every parser change must keep this file green or consciously extend it —
// a fixture regression blocks the commit.

const fs = require("node:fs");
const path = require("node:path");

// Reuses the shared .test-build/ output from tsconfig.test.json rather than a
// dedicated .parser-test-build/. One compile now covers every lib/ suite
// including this one (2026-08-02, audit A-W5-016).
const { parseTextToDocument } = require(
  path.join(__dirname, "..", ".test-build", "importers", "textParser.js"),
);

const FIXTURE_DIR = path.join(__dirname, "..", "__fixtures__");

const read = (name) =>
  fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");

let failures = 0;
let passes = 0;
const check = (fixture, label, cond, actual) => {
  if (cond) {
    passes++;
    console.log(`PASS  [${fixture}] ${label}`);
  } else {
    failures++;
    console.log(`FAIL  [${fixture}] ${label}` + (actual !== undefined ? ` — got: ${JSON.stringify(actual)}` : ""));
  }
};

const run = (name) => {
  const doc = parseTextToDocument(read(name));
  if (process.env.DUMP) {
    console.log(`\n===== ${name} =====`);
    console.log(JSON.stringify(doc, null, 2));
  }
  return doc;
};

// Inline-text variant of `run` for targeted single-behaviour checks that don't
// warrant a whole fixture file. Same parser, same reporting.
const runText = (label, text) => {
  const doc = parseTextToDocument(text);
  if (process.env.DUMP) {
    console.log(`\n===== ${label} (inline) =====`);
    console.log(JSON.stringify(doc, null, 2));
  }
  return doc;
};

/* ── (a) clean single-column ATS-style ─────────────────────────────────── */
{
  const f = "clean-single-column.txt";
  const d = run(f);
  check(f, "name", d.contact.name === "Aisha Khan", d.contact.name);
  check(f, "email", d.contact.email === "aisha.khan@example.com", d.contact.email);
  check(f, "phone is the +971 number", (d.contact.phone ?? "").includes("971 50 123 4567"), d.contact.phone);
  check(f, "location", (d.contact.location ?? "").includes("Dubai"), d.contact.location);
  check(f, "linkedin", (d.contact.linkedin ?? "").includes("linkedin.com/in/aishakhan"), d.contact.linkedin);
  check(f, "website", (d.contact.website ?? "").includes("aishakhan.com"), d.contact.website);
  check(f, "summary captured", (d.summary ?? "").includes("8 years"), d.summary);
  check(f, "2 experience entries", d.experience.length === 2, d.experience.length);
  check(f, "exp1 role", d.experience[0]?.role === "Operations Manager", d.experience[0]?.role);
  check(f, "exp1 company", d.experience[0]?.company === "Acme Logistics LLC", d.experience[0]?.company);
  check(f, "exp1 current", d.experience[0]?.isCurrent === true, d.experience[0]?.isCurrent);
  check(f, "exp1 startDate", (d.experience[0]?.startDate ?? "").includes("2020"), d.experience[0]?.startDate);
  check(f, "exp1 has 2 bullets", (d.experience[0]?.bullets ?? []).length === 2, d.experience[0]?.bullets);
  check(f, "exp2 dates", (d.experience[1]?.startDate ?? "").includes("2016") && (d.experience[1]?.endDate ?? "").includes("2019"), [d.experience[1]?.startDate, d.experience[1]?.endDate]);
  check(f, "education degree BBA", (d.education[0]?.degree ?? "").includes("BBA"), d.education[0]?.degree);
  check(f, "education school AUS", (d.education[0]?.school ?? "").includes("American University"), d.education[0]?.school);
  check(f, "5 skills", d.skills.length === 5, d.skills);
  check(f, "3 languages, levels stripped", d.languages.length === 3 && d.languages.includes("English") && d.languages.includes("Arabic"), d.languages);
  check(f, "certification PMP/PMI/2023", d.certifications[0]?.name === "PMP" && d.certifications[0]?.issuer === "PMI" && (d.certifications[0]?.date ?? "").includes("2023"), d.certifications[0]);
  check(f, "headline extracted to contact.headline", d.contact.headline === "Senior Operations Manager", d.contact.headline);
  check(f, "headline no longer in unplaced", !(d.unplaced ?? []).includes("Senior Operations Manager"), d.unplaced);
}

/* ── (b) two-column, pdf.js-linearized ──────────────────────────────────── */
{
  const f = "two-column-interleaved.txt";
  const d = run(f);
  check(f, "name", d.contact.name === "Omar Said", d.contact.name);
  check(f, "email", d.contact.email === "omar.said@example.com", d.contact.email);
  check(f, "phone", (d.contact.phone ?? "").includes("971 55 987 6543"), d.contact.phone);
  check(f, "3 skills from sidebar", d.skills.length === 3, d.skills);
  check(f, "2 experience entries", d.experience.length === 2, d.experience.length);
  // The three BASELINE BUGS recorded in the fixtures commit are fixed:
  // DATE_TOKEN_RE month names now require word boundaries, so "Marketing"
  // keeps its "Mar", and the real "Jan 2019 - Present" date line attaches
  // to the entry instead of a phantom "Mar" token.
  check(f, "exp1 role (month-boundary fix)", d.experience[0]?.role === "Marketing Director", d.experience[0]?.role);
  check(f, "exp1 company", d.experience[0]?.company === "Star Media Group", d.experience[0]?.company);
  check(f, "exp1 current via date line (fix)", d.experience[0]?.isCurrent === true, d.experience[0]?.isCurrent);
  check(f, "exp1 startDate Jan 2019 (fix)", (d.experience[0]?.startDate ?? "").includes("2019"), d.experience[0]?.startDate);
  check(f, "exp1 unmarked bullets captured", (d.experience[0]?.bullets ?? []).length === 2, d.experience[0]?.bullets);
  check(f, "exp2 role (month-boundary fix)", d.experience[1]?.role === "Marketing Manager", d.experience[1]?.role);
  check(f, "exp2 dates 2014-2018", (d.experience[1]?.startDate ?? "").includes("2014") && (d.experience[1]?.endDate ?? "").includes("2018"), [d.experience[1]?.startDate, d.experience[1]?.endDate]);
  check(f, "education entry exists (degree carries MA)", (d.education[0]?.degree ?? "").includes("MA"), d.education[0]);
  check(f, "2 languages", d.languages.length === 2, d.languages);
}

/* ── (c) Word-export with UAE fields ────────────────────────────────────── */
{
  const f = "word-export-uae.txt";
  const d = run(f);
  check(f, "name", d.contact.name === "Imran Patel", d.contact.name);
  check(f, "email from labeled line", d.contact.email === "imran.patel@example.com", d.contact.email);
  check(f, "00971 phone normalized to +971 form", d.contact.phone === "+971 52 444 8899", d.contact.phone);
  check(f, "location without the 'Location:' label", d.contact.location === "Sharjah, UAE", d.contact.location);
  // UAE labeled fields (new in the wave-3 parser work)
  check(f, "uae nationality", d.uae?.nationality === "Indian", d.uae);
  // Values are mapped onto the builder's select options (WP-2): the raw
  // "Employment visa (transferable)" / "30 days" / "UAE Light Vehicle" used to
  // be stored verbatim, which the UAE Essentials selects could not display.
  check(f, "uae visa status → option", d.uae?.visaStatus === "Employment visa", d.uae?.visaStatus);
  check(f, "uae notice period → option", d.uae?.availability === "30 days notice", d.uae?.availability);
  check(f, "uae driving licence → option", d.uae?.drivingLicense === "Light Vehicle", d.uae?.drivingLicense);
  check(f, "summary", (d.summary ?? "").includes("6 years"), d.summary);
  check(f, "2 experience entries", d.experience.length === 2, d.experience.length);
  check(f, "exp1 role/company split on double-space", d.experience[0]?.role === "Procurement Specialist" && d.experience[0]?.company === "BuildCo Contracting LLC", [d.experience[0]?.role, d.experience[0]?.company]);
  check(f, "exp1 dates from own line", (d.experience[0]?.startDate ?? "").includes("2021") && d.experience[0]?.isCurrent === true, [d.experience[0]?.startDate, d.experience[0]?.isCurrent]);
  check(f, "exp1 unmarked bullets", (d.experience[0]?.bullets ?? []).length === 2, d.experience[0]?.bullets);
  check(f, "education degree + school", (d.education[0]?.degree ?? "").includes("B.Sc") && (d.education[0]?.school ?? "").includes("Mumbai"), d.education[0]);
  check(f, "4 skills via semicolons", d.skills.length === 4, d.skills);
  check(f, "2 languages, levels stripped", d.languages.length === 2 && d.languages.includes("English") && d.languages.includes("Hindi"), d.languages);
  // Projects section is no longer silently discarded (new in wave 3)
  check(f, "2 projects kept", (d.projects ?? []).length === 2, d.projects);
  check(f, "project 1 name + detail-as-bullet", (d.projects?.[0]?.name ?? "") === "Dubai Hills Mall fit-out" && (d.projects?.[0]?.bullets ?? []).length === 1, d.projects?.[0]);
  check(f, "headline extracted to contact.headline", d.contact.headline === "Procurement Specialist", d.contact.headline);
  check(f, "headline no longer in unplaced", !(d.unplaced ?? []).includes("Procurement Specialist"), d.unplaced);
}

/* ── (d) scanned / near-empty text layer ────────────────────────────────── */
{
  const f = "scanned-low-text.txt";
  const d = run(f);
  check(f, "no experience", d.experience.length === 0, d.experience);
  check(f, "no education", d.education.length === 0, d.education);
  check(f, "no skills", d.skills.length === 0, d.skills);
  check(f, "no summary", (d.summary ?? "") === "", d.summary);
  check(f, "no email/phone", !d.contact.email && !d.contact.phone, d.contact);
  check(f, "garbage lines preserved in unplaced (not invented as fields)", (d.unplaced ?? []).length === 2, d.unplaced);
}

/* ── (e) glued-pipe UAE export (regression for the 2026-06 import fixes) ──── */
{
  const f = "glued-uae-export.txt";
  const d = run(f);
  // Bug 3/4 — headline is the tagline under the name, not a seeded role+company.
  check(f, "headline = tagline under name", d.contact.headline === "Odoo Administrator", d.contact.headline);
  check(f, "headline not in unplaced", !(d.unplaced ?? []).includes("Odoo Administrator"), d.unplaced);
  // Bug 3 — glued pipe "Role| Company" splits into role + company.
  check(f, "exp1 role split off glued pipe", d.experience[0]?.role === "Odoo Administrator", d.experience[0]?.role);
  check(f, "exp1 company split off glued pipe", d.experience[0]?.company === "Interior360 General Trading LLC", d.experience[0]?.company);
  check(f, "exp1 current", d.experience[0]?.isCurrent === true, d.experience[0]?.isCurrent);
  // Bug 1 — attestation folds into the education entry, no phantom degree.
  check(f, "single education entry (no attestation entry)", d.education.length === 1, d.education.length);
  check(f, "education degree BBA", (d.education[0]?.degree ?? "").includes("BBA"), d.education[0]?.degree);
  check(f, "education school Karachi", (d.education[0]?.school ?? "").includes("Karachi"), d.education[0]?.school);
  check(f, "education attested flag", d.education[0]?.attested === true, d.education[0]?.attested);
  check(f, "education attesting body = MOFA dropdown label", d.education[0]?.attestingBody === "MOFA – UAE Ministry of Foreign Affairs", d.education[0]?.attestingBody);
  check(f, "attestation text not in school/degree of a second entry", d.education.every((e) => !/attested/i.test(e.school ?? "") && !/attested/i.test(e.degree ?? "")), d.education);
  // Bug 2 — bare-domain project link lands in link, name stays clean.
  check(f, "1 project", (d.projects ?? []).length === 1, d.projects?.length);
  check(f, "project name without the link", d.projects?.[0]?.name === "Hisaab", d.projects?.[0]?.name);
  check(f, "project link = bare domain", d.projects?.[0]?.link === "usehisaab.com", d.projects?.[0]?.link);
  check(f, "project description kept as bullet", (d.projects?.[0]?.bullets ?? []).length === 1, d.projects?.[0]?.bullets);
}

/* ── (f) two-column MERGED headers — languages/certs must NOT become skills ──
   Founder bug 2026-06: pdf.js glued "Languages" + "Certifications" onto one
   line, so the section boundary was missed and the interleaved languages and
   certifications all imported as Skills. The content-based rescue must fix it. */
{
  const f = "two-column-merged-headers.txt";
  const d = run(f);
  const has = (arr, sub) => arr.some((x) => String(x).toLowerCase().includes(sub.toLowerCase()));
  const skillsLc = d.skills.map((s) => s.toLowerCase());
  // The merged "Languages Certifications" header is dropped, not a skill.
  check(f, "merged header dropped from skills", !has(d.skills, "languages certifications"), d.skills);
  // Real skills survive.
  check(f, "real skills kept (Odoo + SQL)", has(d.skills, "Odoo") && has(d.skills, "SQL"), d.skills);
  // No language / cert / date / domain artifacts left in skills.
  check(f, "no language entries left in skills", !skillsLc.some((s) => /^(?:english|arabic|urdu)\b/.test(s)), d.skills);
  check(f, "no certificate left in skills", !has(d.skills, "certificate"), d.skills);
  check(f, "bare date dropped from skills", !d.skills.includes("April 2025"), d.skills);
  check(f, "issuer domain dropped from skills", !has(d.skills, "mckinsey.org"), d.skills);
  // Languages routed to the languages field (names only).
  check(f, "languages = English/Arabic/Urdu", ["English", "Arabic", "Urdu"].every((l) => d.languages.includes(l)), d.languages);
  // The clear certificate routes to certifications.
  check(f, "Google PM certificate routed to certifications", d.certifications.some((c) => /project management professional certificate/i.test(c.name)), d.certifications);
  // A bare "... Program" is NOT auto-classified as a cert (would over-fire on
  // real skills like "Affiliate Program"); it stays a skill for the user.
  check(f, "borderline 'Forward Program' stays a skill (not guessed as a cert)", !d.certifications.some((c) => /forward program/i.test(c.name)) && has(d.skills, "Forward Program"), { skills: d.skills, certs: d.certifications });
}

/* ── (g) clean CV — rescue must NOT fire (no merged header) ──────────────────
   Guards the review findings: languages-as-skills ("Arabic", "English") and a
   real "Affiliate Program" skill must stay in Skills on a cleanly-parsed CV. */
{
  const f = "clean-skills-no-rescue.txt";
  const d = run(f);
  const has = (arr, sub) => arr.some((x) => String(x).toLowerCase().includes(sub.toLowerCase()));
  check(f, "language-named skills stay in skills", has(d.skills, "Arabic") && has(d.skills, "English"), d.skills);
  check(f, "languages NOT invented from skills", (d.languages ?? []).length === 0, d.languages);
  check(f, "'Affiliate Program' stays a skill", has(d.skills, "Affiliate Program"), d.skills);
  check(f, "'Affiliate Program' not moved to certifications", !d.certifications.some((c) => /affiliate program/i.test(c.name)), d.certifications);
  check(f, "real skills intact (Salesforce, Customer Service)", has(d.skills, "Salesforce") && has(d.skills, "Customer Service"), d.skills);
}

/* ── (h) "to date" is a current-role marker ──────────────────────────────────
   UAE CVs write open-ended roles as "Jan 2020 – to date" / "March 2022 to
   date" as often as "Present". PRESENT_RE matched "todate" and "till date"
   but not the two-word form, so those roles imported with isCurrent: false. */
{
  const f = "to-date (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Operations Manager | Acme LLC    March 2022 to date",
    "• Led a team of 12 across 3 sites",
    "",
  ].join("\n"));
  check(f, "'to date' marks the role current", d.experience[0]?.isCurrent === true, d.experience[0]);
  check(f, "'to date' still yields the start date", (d.experience[0]?.startDate ?? "").includes("2022"), d.experience[0]?.startDate);
  check(f, "role survives the 'to date' strip", d.experience[0]?.role === "Operations Manager", d.experience[0]?.role);
}
{
  const f = "to-date-dash (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Procurement Lead | BuildCo LLC",
    "Jan 2020 – to date",
    "• Negotiated AED 12M in supplier contracts",
    "",
  ].join("\n"));
  check(f, "'– to date' on its own date line marks current", d.experience[0]?.isCurrent === true, d.experience[0]);
}
{
  const f = "to-present (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Sales Manager | Gulf Retail LLC    Feb 2021 to present",
    "• Grew regional revenue by 22%",
    "",
  ].join("\n"));
  check(f, "'to present' still marks current", d.experience[0]?.isCurrent === true, d.experience[0]);
}
{
  // Guard on the lookbehind: "up to date" must NOT mark a role current. On
  // two-column PDFs pdf.js drops bullet glyphs, so this line can reach the
  // header path where isCurrent is decided.
  const f = "up-to-date-guard (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Records Officer | Docs LLC    Jan 2018 - Dec 2019",
    "Kept compliance records up to date",
    "",
  ].join("\n"));
  check(f, "'up to date' does not mark the role current", d.experience.every((e) => e.isCurrent !== true), d.experience);
}

/* ── (i) numeric date formats keep their month ───────────────────────────────
   DATE_TOKEN_RE matched "Jan 2024" and a bare "2024" but no numeric form, so
   "01/2024 - 12/2024" produced two indistinguishable "2024" tokens and the
   month was lost. MM/YYYY, MM-YYYY and ISO YYYY-MM now parse as one token
   each — without disturbing a plain year range. */
{
  const f = "numeric-slash-dates (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Project Engineer | BuildCo LLC    01/2024 - 12/2024",
    "• Delivered 4 fit-out packages",
    "",
  ].join("\n"));
  check(f, "MM/YYYY start keeps the month", d.experience[0]?.startDate === "01/2024", d.experience[0]?.startDate);
  check(f, "MM/YYYY end keeps the month", d.experience[0]?.endDate === "12/2024", d.experience[0]?.endDate);
}
{
  const f = "numeric-dash-dates (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Site Engineer | Gulf Contracting LLC",
    "03-2019 to 07-2021",
    "• Supervised 30 subcontractor staff",
    "",
  ].join("\n"));
  check(f, "MM-YYYY start keeps the month", d.experience[0]?.startDate === "03-2019", d.experience[0]?.startDate);
  check(f, "MM-YYYY end keeps the month", d.experience[0]?.endDate === "07-2021", d.experience[0]?.endDate);
}
{
  const f = "iso-dates (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Analyst | Emirates NBD    2021-03 – 2024-09",
    "• Cut month-end close from 8 days to 5",
    "",
  ].join("\n"));
  check(f, "ISO YYYY-MM start keeps the month", d.experience[0]?.startDate === "2021-03", d.experience[0]?.startDate);
  check(f, "ISO YYYY-MM end keeps the month", d.experience[0]?.endDate === "2024-09", d.experience[0]?.endDate);
}
{
  // Regression guard: a bare year RANGE must still parse as two years, not
  // get half-consumed by the new numeric alternatives.
  const f = "year-range-unchanged (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Buyer | Al Noor Trading    2018 - 2021",
    "• Sourced 200+ SKUs",
    "",
  ].join("\n"));
  check(f, "plain year range still yields two years", d.experience[0]?.startDate === "2018" && d.experience[0]?.endDate === "2021", [d.experience[0]?.startDate, d.experience[0]?.endDate]);
}

/* ── (j) "Personal Details" is a section, not skills overflow ────────────────
   The heading matched no SECTION_PATTERN, so currentSection stayed on
   whatever came before it (usually Skills) and every line underneath became
   a phantom skill: "Nationality: Indian", "Visa Status: Employment Visa". */
{
  const f = "personal-details (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "fatima.noor@example.com | +971 50 222 3344",
    "",
    "Skills",
    "Sourcing, Cost Control, SAP MM",
    "",
    "Personal Details",
    "Nationality: Indian",
    "Visa Status: Employment Visa",
    "Marital Status: Married",
    "",
  ].join("\n"));
  const skillsLc = d.skills.map((s) => s.toLowerCase());
  check(f, "3 real skills only", d.skills.length === 3, d.skills);
  check(f, "nationality is not a skill", !skillsLc.some((s) => s.includes("nationality")), d.skills);
  check(f, "visa status is not a skill", !skillsLc.some((s) => s.includes("visa")), d.skills);
  check(f, "marital status is not a skill", !skillsLc.some((s) => s.includes("marital")), d.skills);
  check(f, "nothing leaked into experience", d.experience.length === 0, d.experience);
  check(f, "nationality harvested to uae fields", d.uae?.nationality === "Indian", d.uae);
  check(f, "visa status harvested to uae fields", d.uae?.visaStatus === "Employment visa", d.uae);
  check(f, "unrecognised personal line preserved in unplaced", (d.unplaced ?? []).includes("Marital Status: Married"), d.unplaced);
}
{
  // "Personal Information" / "Personal Data" are the same block under
  // different names, and the block often sits directly under the name — the
  // contact sweep must not stop at it.
  const f = "personal-information-top (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "Procurement Specialist",
    "",
    "Personal Information",
    "Email: fatima.noor@example.com",
    "Phone: +971 50 222 3344",
    "Nationality: Indian",
    "",
    "Skills",
    "Sourcing, Cost Control",
    "",
  ].join("\n"));
  check(f, "name still harvested above the block", d.contact.name === "Fatima Noor", d.contact.name);
  check(f, "headline still harvested above the block", d.contact.headline === "Procurement Specialist", d.contact.headline);
  check(f, "email harvested from under the block", d.contact.email === "fatima.noor@example.com", d.contact.email);
  check(f, "phone harvested from under the block", (d.contact.phone ?? "").includes("971 50 222 3344"), d.contact.phone);
  check(f, "the heading itself is never the name", d.contact.name !== "Personal Information", d.contact.name);
  check(f, "skills unaffected", d.skills.length === 2, d.skills);
}

/* ── (k) date of birth is harvested, not left to pollute a section ──────────
   UAE_LABEL_PATTERNS had no DOB entry, so "DOB: 15 Mar 1990" was never
   consumed and fell through into whatever section was open. */
{
  const cases = [
    ["Date of Birth: 15 March 1990", "15 March 1990"],
    ["DOB: 15 Mar 1990", "15 Mar 1990"],
    ["D.O.B.: 15/03/1990", "15/03/1990"],
    ["Date of Birth - 15/03/1990", "15/03/1990"],
    ["Birth Date: 15-03-1990", "15-03-1990"],
  ];
  for (const [line, expected] of cases) {
    const f = `dob (inline: ${line})`;
    const d = runText(f, [
      "Fatima Noor",
      "fatima.noor@example.com",
      "",
      "Skills",
      "Sourcing, Cost Control",
      "",
      "Personal Details",
      line,
      "",
    ].join("\n"));
    check(f, `dateOfBirth = ${expected}`, d.uae?.dateOfBirth === expected, d.uae);
    check(f, "DOB line is not a skill", d.skills.length === 2, d.skills);
  }
}

/* ── (l) language proficiency levels survive the import ─────────────────────
   stripLanguageLevel threw the qualifier away, so CvLanguage.level — which
   has always existed — was empty on every imported CV. UAE recruiters screen
   on Arabic proficiency specifically, so this was the most-screened signal in
   the section going missing. */
{
  const f = "language-levels (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Languages",
    "Arabic - Native",
    "English (Professional Working)",
    "French — Conversational",
    "Hindi (Elementary)",
    "Urdu",
    "",
  ].join("\n"));
  const byName = Object.fromEntries((d.languageDetails ?? []).map((l) => [l.name, l.level]));
  check(f, "Arabic -> native", byName.Arabic === "native", d.languageDetails);
  check(f, "English (Professional Working) -> professional", byName.English === "professional", d.languageDetails);
  check(f, "French -> conversational", byName.French === "conversational", d.languageDetails);
  check(f, "Hindi -> elementary", byName.Hindi === "elementary", d.languageDetails);
  check(f, "bare 'Urdu' gets NO invented level", "Urdu" in byName && byName.Urdu === undefined, d.languageDetails);
  check(f, "names list unchanged in shape", JSON.stringify(d.languages) === JSON.stringify(["Arabic", "English", "French", "Hindi", "Urdu"]), d.languages);
  check(f, "languageDetails is index-aligned with languages", (d.languageDetails ?? []).map((l) => l.name).join("|") === (d.languages ?? []).join("|"), [d.languages, d.languageDetails]);
}
{
  // "Mother tongue" and "Fluent" are the other two spellings UAE CVs use.
  const f = "language-levels-variants (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Languages",
    "Malayalam (Mother Tongue), English - Fluent, Arabic (Basic)",
    "",
  ].join("\n"));
  const byName = Object.fromEntries((d.languageDetails ?? []).map((l) => [l.name, l.level]));
  check(f, "Mother Tongue -> native", byName.Malayalam === "native", d.languageDetails);
  check(f, "Fluent -> professional (canonical set has no \"fluent\")", byName.English === "professional", d.languageDetails);
  check(f, "Basic -> elementary", byName.Arabic === "elementary", d.languageDetails);
}
{
  // The two-column rescue path also has a level in hand — it only reclassifies
  // entries that carry a qualifier — so it must keep it too.
  const f = "two-column-merged-headers.txt";
  const d = run(f);
  const byName = Object.fromEntries((d.languageDetails ?? []).map((l) => [l.name, l.level]));
  check(f, "rescued English keeps 'professional' (C1)", byName.English === "professional", d.languageDetails);
  check(f, "rescued Arabic keeps 'elementary' (A1-A2)", byName.Arabic === "elementary", d.languageDetails);
  check(f, "rescued Urdu keeps 'native' (Native / Bilingual)", byName.Urdu === "native", d.languageDetails);
}
{
  const f = "clean-single-column.txt";
  const d = run(f);
  const byName = Object.fromEntries((d.languageDetails ?? []).map((l) => [l.name, l.level]));
  check(f, "English (Fluent) -> professional (canonical set has no \"fluent\")", byName.English === "professional", d.languageDetails);
  check(f, "Arabic (Native) -> native", byName.Arabic === "native", d.languageDetails);
  check(f, "bare Urdu keeps no level", "Urdu" in byName && byName.Urdu === undefined, d.languageDetails);
}

/* ── (m) adversarial-review regressions (2026-08-24) ─────────────────────────
   Each of these was found by an adversarial pass over the ten accuracy fixes
   and reproduced against the shipped build before being fixed. */

// (m1) A short label plus a numeric range must not be classed as a date-only
// line — that DELETED the employer, folded its bullets into the previous role
// and pushed its dates onto the NEXT one.
{
  const f = "short-label-numeric-range (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Senior Analyst | HSBC | 2015 - 2018",
    "• Built the risk model",
    "FAB 09/2019 - 05/2021",
    "• Led the migration programme",
    "Head of Data",
    "• Owned the warehouse",
    "",
  ].join("\n"));
  check(f, "3 entries — the FAB role is not deleted", d.experience.length === 3, d.experience.map((e) => e.role));
  const fab = d.experience.find((e) => `${e.role ?? ""}${e.company ?? ""}`.includes("FAB"));
  check(f, "FAB entry exists", Boolean(fab), d.experience);
  check(f, "FAB keeps its own dates", (fab?.startDate ?? "") === "09/2019" && (fab?.endDate ?? "") === "05/2021", [fab?.startDate, fab?.endDate]);
  const head = d.experience.find((e) => (e.role ?? "").includes("Head of Data"));
  check(f, "the NEXT role did not inherit FAB's dates", !head?.startDate, head);
}
{
  // Guard the other direction: a genuine date-only line still is one.
  const f = "date-only-still-detected (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Experience",
    "Procurement Lead | BuildCo LLC",
    "03-2019 to 07-2021",
    "• Negotiated AED 12M in supplier contracts",
    "",
  ].join("\n"));
  check(f, "'03-2019 to 07-2021' is still a date-only line", d.experience.length === 1 && d.experience[0]?.startDate === "03-2019" && d.experience[0]?.endDate === "07-2021", d.experience);
}

// (m2) Stripping a trailing "to date" left the separator glued to the company.
{
  const cases = [
    ["Senior Accountant – Al Futtaim Group – Jan 2020 to date", "Al Futtaim Group"],
    ["Accountant - ADNOC - 2018 to date", "ADNOC"],
    ["Nurse at NMC Royal Hospital at Jan 2020 to date", "NMC Royal Hospital"],
  ];
  for (const [line, company] of cases) {
    const f = `to-date-separator (inline: ${company})`;
    const d = runText(f, ["Fatima Noor", "", "Experience", line, "• Delivered the handover", ""].join("\n"));
    check(f, `company === "${company}" (no dangling separator)`, d.experience[0]?.company === company, d.experience[0]);
    check(f, "still marked current", d.experience[0]?.isCurrent === true, d.experience[0]?.isCurrent);
  }
}

// (m3) Only the five canonical CvLanguage levels may be emitted — lib/language.ts:
// "A level that cannot be selected here must never be stored".
{
  const f = "canonical-language-levels (inline)";
  const CANONICAL = ["elementary", "conversational", "professional", "full_professional", "native"];
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Languages",
    "English (Fluent)",
    "Spanish - Advanced",
    "German (Beginner)",
    "Italian (Intermediate)",
    "Arabic (Full Professional)",
    "Urdu (Native)",
    "",
  ].join("\n"));
  const details = d.languageDetails ?? [];
  const byName = Object.fromEntries(details.map((l) => [l.name, l.level]));
  check(f, "every emitted level is canonical", details.every((l) => l.level === undefined || CANONICAL.includes(l.level)), details);
  check(f, "Fluent -> professional", byName.English === "professional", details);
  check(f, "Advanced -> professional", byName.Spanish === "professional", details);
  check(f, "Beginner -> elementary", byName.German === "elementary", details);
  check(f, "Intermediate -> conversational", byName.Italian === "conversational", details);
  check(f, "Full Professional -> full_professional", byName.Arabic === "full_professional", details);
  check(f, "Native -> native", byName.Urdu === "native", details);
}

// (m4) LinkedIn's "Limited Working" is the rung BELOW professional. Reading the
// bare word "working" as professional inflated it two rungs on a submitted CV.
{
  const f = "limited-working (inline)";
  const d = runText(f, [
    "Fatima Noor",
    "",
    "Languages",
    "Hindi (Limited Working)",
    "Tagalog (Limited Working Proficiency)",
    "English (Professional Working)",
    "",
  ].join("\n"));
  const byName = Object.fromEntries((d.languageDetails ?? []).map((l) => [l.name, l.level]));
  check(f, "Limited Working -> conversational, NOT professional", byName.Hindi === "conversational", d.languageDetails);
  check(f, "Limited Working Proficiency -> conversational", byName.Tagalog === "conversational", d.languageDetails);
  check(f, "Professional Working is still professional", byName.English === "professional", d.languageDetails);
}

// (m5) "Personal Profile" / "Personal Summary" are summary headings. They
// matched no pattern at all, so the summary fell into the previous section.
{
  for (const heading of ["Personal Profile", "Personal Summary", "Personal Statement"]) {
    const f = `summary-heading (inline: ${heading})`;
    const d = runText(f, [
      "Fatima Noor",
      "fatima.noor@example.com",
      "",
      heading,
      "Procurement specialist with 6 years in construction materials sourcing across the UAE.",
      "",
      "Skills",
      "Sourcing, Cost Control",
      "",
    ].join("\n"));
    check(f, "summary captured", (d.summary ?? "").includes("6 years"), d.summary);
    check(f, "summary did not leak into skills", d.skills.length === 2, d.skills);
  }
}

/* ── (r) ROUND TRIP: the builder's own Classic export (WP-2, audit F17/F24) ──
   __fixtures__/builder-classic-export.txt is the pdf.js line reconstruction of
   a PDF the builder produced. The checker must read every UAE essential the
   builder printed, and the values must be the exact select options so a
   "Fix in Builder" import lands cleanly. */
{
  const f = "builder-classic-export.txt";
  const d = run(f);
  check(f, "name", d.contact.name === "Test Candidate", d.contact.name);
  check(f, "email", d.contact.email === "test.candidate@example.com", d.contact.email);
  check(f, "visa from compound line", d.uae?.visaStatus === "Employment visa", d.uae);
  check(f, "availability from 'Available:' alias", d.uae?.availability === "30 days notice", d.uae);
  check(f, "licence from 'DL:' alias", d.uae?.drivingLicense === "Light Vehicle", d.uae);
  check(f, "nationality from compound line", d.uae?.nationality === "Pakistani", d.uae);
  check(f, "compound UAE line is not in unplaced", !(d.unplaced ?? []).some((l) => /Available:/.test(l)), d.unplaced);
  check(f, "experience role", d.experience[0]?.role === "Operations Manager", d.experience[0]);
  check(f, "experience bullets", (d.experience[0]?.bullets ?? []).length === 2, d.experience[0]?.bullets);
  check(f, "skills", d.skills.includes("Fleet management"), d.skills);
}

// (r2) Spaced colons (what some PDF extractors emit) and " | " separators.
{
  const f = "uae-compound (inline: spaced colons, pipes)";
  const d = runText(f, [
    "Sara Ali",
    "sara.ali@example.com",
    "Visa : Employment visa | Available : Immediately | DL : Valid UAE LMV licence | Nationality : Egyptian",
    "",
    "Summary",
    "Accountant with 5 years in Dubai.",
  ].join("\n"));
  check(f, "visa", d.uae?.visaStatus === "Employment visa", d.uae);
  check(f, "availability Immediately → Immediate", d.uae?.availability === "Immediate", d.uae);
  check(f, "licence LMV → Light Vehicle", d.uae?.drivingLicense === "Light Vehicle", d.uae);
  check(f, "nationality", d.uae?.nationality === "Egyptian", d.uae);
}

// (r3) Unmappable labelled values are NOT stored in the enum field — they go
// to unplaced so the review screen shows them (detect, never assert).
{
  const f = "uae-unmappable (inline)";
  const d = runText(f, [
    "Omar Khan",
    "omar.khan@example.com",
    "Visa Status: Residence visa",
    "Notice Period: Negotiable",
    "Driving Licence: Valid",
    "",
    "Summary",
    "Engineer with 4 years on UAE sites.",
  ].join("\n"));
  check(f, "unmappable visa not stored", d.uae?.visaStatus === undefined, d.uae);
  check(f, "unmappable notice not stored", d.uae?.availability === undefined, d.uae);
  check(f, "bare 'Valid' licence not stored", d.uae?.drivingLicense === undefined, d.uae);
  check(f, "all three surface in unplaced", ["Visa Status: Residence visa", "Notice Period: Negotiable", "Driving Licence: Valid"].every((l) => (d.unplaced ?? []).includes(l)), d.unplaced);
}

// (r4) Common phrasings map to the options.
{
  const f = "uae-phrasings (inline)";
  const d = runText(f, [
    "Noor Hassan",
    "noor.hassan@example.com",
    "Visa: Husband's sponsorship",
    "Notice: 1 month",
    "Driving License: Heavy vehicle",
    "",
    "Summary",
    "Nurse with 6 years in Abu Dhabi hospitals.",
  ].join("\n"));
  check(f, "husband's sponsorship → Family sponsorship", d.uae?.visaStatus === "Family sponsorship", d.uae);
  check(f, "1 month → 30 days notice", d.uae?.availability === "30 days notice", d.uae);
  check(f, "heavy vehicle", d.uae?.drivingLicense === "Heavy Vehicle", d.uae);
}

/* ── D1 (session 5, 2026-10-31): dated line under the title ─────────────
   Every role whose dates sat on the line below the title became two cards
   (card 2's Role = the city; in DOCX its Company = the first bullet). */
{
  const f = "d1-title-then-company-city-dates (inline)";
  const d = runText(f, [
    "Layla Haddad",
    "layla@example.com",
    "Experience",
    "Senior Procurement Specialist",
    "Falcon Facilities Management · Abu Dhabi · Mar 2021 - Present",
    "Ran 60+ tenders a year.",
    "Procurement Officer",
    "Oasis Build Contracting · Dubai · Jun 2017 - Feb 2021",
    "Sourced materials for 12 projects.",
  ].join("\n"));
  check(f, "2 roles, not 4", d.experience.length === 2, d.experience.map((e) => e.role));
  check(f, "role 1 title", d.experience[0]?.role === "Senior Procurement Specialist", d.experience[0]?.role);
  check(f, "role 1 company", d.experience[0]?.company === "Falcon Facilities Management", d.experience[0]?.company);
  check(f, "role 1 location", d.experience[0]?.location === "Abu Dhabi", d.experience[0]?.location);
  check(f, "role 1 dates + current", d.experience[0]?.startDate === "Mar 2021" && d.experience[0]?.isCurrent === true, d.experience[0]);
  check(f, "role 2 dates", d.experience[1]?.startDate === "Jun 2017" && d.experience[1]?.endDate === "Feb 2021", d.experience[1]);
  check(f, "bullets stay with their role", d.experience[0]?.bullets?.length === 1 && d.experience[1]?.bullets?.length === 1, d.experience.map((e) => e.bullets));
}
{
  const f = "d1-title-company-then-city-dates (inline)";
  const d = runText(f, [
    "Noor Testwell",
    "noor@example.com",
    "Experience",
    "Senior Facilities Operations Manager - Falcon Facilities Management",
    "Dubai | Mar 2021 - Present",
    "Directed hard and soft services for a 14-tower portfolio.",
    "Cut reactive work orders by 31% in 18 months.",
    "Facilities Manager - Oasis Healthcare Estates",
    "Abu Dhabi | Jan 2017 - Feb 2021",
    "Ran facilities for a 210-bed hospital.",
  ].join("\n"));
  check(f, "2 roles", d.experience.length === 2, d.experience.map((e) => e.role));
  check(f, "role 1 company kept", d.experience[0]?.company === "Falcon Facilities Management", d.experience[0]?.company);
  check(f, "city is the location, not a role", d.experience[0]?.location === "Dubai" && d.experience[1]?.location === "Abu Dhabi", d.experience.map((e) => e.location));
  check(f, "first unmarked bullet is a bullet, not the company", d.experience[0]?.bullets?.[0]?.startsWith("Directed"), d.experience[0]?.bullets);
  check(f, "role 2 dates", d.experience[1]?.startDate === "Jan 2017" && d.experience[1]?.endDate === "Feb 2021", d.experience[1]);
}
{
  // Guard: a role with no dates and no bullets followed by a DATED ROLE line
  // is two roles — the second line carries a job title, so it is not a tail.
  const f = "d1-guard-next-dated-role (inline)";
  const d = runText(f, [
    "Omar Khan",
    "omar@example.com",
    "Experience",
    "Volunteer Coordinator - Red Crescent",
    "Operations Manager | Acme LLC | Jan 2020 - Present",
    "• Built the ops team.",
  ].join("\n"));
  check(f, "stays 2 roles", d.experience.length === 2, d.experience.map((e) => e.role));
  check(f, "dates stay on the dated role", !d.experience[0]?.startDate && d.experience[1]?.startDate === "Jan 2020", d.experience.map((e) => e.startDate));
}

/* ── D2 (session 5): wrapped marked bullets in PDFs ──────────────────────── */
{
  const f = "d2-wrapped-bullets (inline)";
  const d = runText(f, [
    "Noor Testwell",
    "noor@example.com",
    "Experience",
    "Senior Facilities Operations Manager — Falcon Facilities Management",
    "Dubai | Mar 2021 - Present",
    "• Directed hard and soft services for a 14-tower portfolio with 140 technicians and 9",
    "supervisors.",
    "• Cut reactive work orders by 31% by moving 1,900 assets onto a planned-maintenance",
    "calendar in the CAFM system.",
    "• Held 99.2% SLA compliance and passed every Dubai Civil Defence inspection without a",
    "finding over 36 consecutive months, across",
    "2.4 million sq ft.",
    "Facilities Manager — Oasis Healthcare Estates",
    "Abu Dhabi | Jan 2017 - Feb 2021",
    "• Ran facilities for a 210-bed hospital",
  ].join("\n"));
  const b = d.experience[0]?.bullets ?? [];
  check(f, "2 roles", d.experience.length === 2, d.experience.map((e) => e.role));
  check(f, "3 bullets on role 1 (wraps joined)", b.length === 3, b);
  check(f, "bullet 1 ends with its wrapped tail", b[0]?.endsWith("140 technicians and 9 supervisors."), b[0]);
  check(f, "bullet 2 joined", b[1]?.endsWith("planned-maintenance calendar in the CAFM system."), b[1]);
  check(f, "three-line bullet joined (lower-case + number starts)", b[2]?.endsWith("across 2.4 million sq ft."), b[2]);
  check(f, "company not taken from a wrapped tail", d.experience[0]?.company === "Falcon Facilities Management", d.experience[0]?.company);
}
{
  // Guard: bullets WITHOUT full stops are common; the next role must not be
  // swallowed into the last bullet.
  const f = "d2-guard-unpunctuated-bullets (inline)";
  const d = runText(f, [
    "Layla Haddad",
    "layla@example.com",
    "Experience",
    "Senior Procurement Specialist",
    "Falcon Facilities Management · Abu Dhabi · Mar 2021 - Present",
    "• Ran 60+ tenders a year",
    "• Cut vendor lead time from 18 to 14 days",
    "Procurement Officer",
    "Oasis Build Contracting · Dubai · Jun 2017 - Feb 2021",
    "• Sourced materials for 12 projects",
    "Acme Trading LLC",
    "Buyer",
    "2015 - 2017",
    "• Raised purchase orders",
  ].join("\n"));
  check(f, "3 roles", d.experience.length === 3, d.experience.map((e) => e.role));
  check(f, "role 1 keeps 2 bullets", d.experience[0]?.bullets?.length === 2, d.experience[0]?.bullets);
  check(f, "role 2 title not appended to a bullet", d.experience[1]?.role === "Procurement Officer", d.experience[1]?.role);
  check(f, "company-first role not appended to a bullet", !/Acme/.test((d.experience[1]?.bullets ?? []).join(" ")), d.experience[1]?.bullets);
}

/* ── D3 (session 5): "Degree, School (2018 - 2020)" ───────────────────────
   Stripping the dates left "( - )"; its " - " split off ")" as the school. */
{
  const f = "d3-degree-comma-school-brackets (inline)";
  const d = runText(f, [
    "Noor Testwell",
    "noor@example.com",
    "Experience",
    "Operations Manager | Acme LLC (Jan 2020 – Present)",
    "• Built the ops team.",
    "Education",
    "MSc Facilities Management, Heriot-Watt University Dubai (2018 - 2020)",
    "BEng Mechanical Engineering, University of Sharjah (2010 - 2014)",
    "Master of Engineering, School of Engineering, Imperial College London [2008 to 2009]",
  ].join("\n"));
  const e = d.education;
  check(f, "3 degrees", e.length === 3, e);
  check(f, "degree 1 split from its school", e[0]?.degree === "MSc Facilities Management" && e[0]?.school === "Heriot-Watt University Dubai", e[0]);
  check(f, "degree 1 dates kept", e[0]?.startDate === "2018" && e[0]?.endDate === "2020", e[0]);
  check(f, "degree 2", e[1]?.degree === "BEng Mechanical Engineering" && e[1]?.school === "University of Sharjah", e[1]);
  check(f, "no bracket debris anywhere", !/[()[\]]/.test(e.flatMap((x) => [x.degree, x.school, x.field]).filter(Boolean).join(" ")), e);
  check(f, "school with a faculty before it", e[2]?.degree === "Master of Engineering" && /Imperial College London/.test(e[2]?.school ?? ""), e[2]);
  check(f, "experience: company without the empty bracket", d.experience[0]?.company === "Acme LLC" && d.experience[0]?.isCurrent === true, d.experience[0]);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
