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
  check(f, "uae visa status", d.uae?.visaStatus === "Employment visa (transferable)", d.uae?.visaStatus);
  check(f, "uae notice period", d.uae?.availability === "30 days", d.uae?.availability);
  check(f, "uae driving licence", d.uae?.drivingLicense === "UAE Light Vehicle", d.uae?.drivingLicense);
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

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
