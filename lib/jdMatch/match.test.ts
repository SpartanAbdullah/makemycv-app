/**
 * Sanity checks for the deterministic JD matcher (lib/jdMatch/match.ts).
 *
 * There is no test framework in package.json — these use only the Node 18+
 * built-in `node:test` + `node:assert`, mirroring lib/store/migrate.test.ts.
 *
 * Run via the npm script (compiles to CommonJS, then runs node --test):
 *
 *   npm run test:jdmatch
 *
 * They guard the three properties the matcher must never regress on:
 *  1. present terms match (SAP, Lean Six Sigma),
 *  2. absent terms are reported missing (PMP),
 *  3. single tokens respect word boundaries ("java" must NOT match
 *     "javascript"), and the small alias map works ("Microsoft Excel" ↔
 *     "Excel").
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { matchRequirementsToCv, skillVariantMatch } from "./match";
import type { JdRequirements } from "./types";
import type { CvData } from "../types/cv";

/** Minimal but type-complete CvData with controllable text. */
function makeCv(opts: { bullets: string[]; skills: string[] }): CvData {
  return {
    personal: {
      firstName: "Test",
      lastName: "User",
      headline: "Process Excellence Manager",
      email: "",
      phone: "",
      location: "Dubai",
      website: "",
      linkedin: "",
      summary: "",
    },
    experience: [
      {
        id: "exp-1",
        company: "Acme FZE",
        role: "Process Excellence Manager",
        location: "Dubai",
        startDate: "",
        endDate: "",
        isCurrent: true,
        bullets: opts.bullets,
      },
    ],
    education: [],
    skills: opts.skills.map((name, i) => ({ id: `sk-${i}`, name })),
    languages: [],
    certifications: [],
    projects: [],
    settings: { templateId: "classic" },
  };
}

const cv = makeCv({
  bullets: [
    "Led SAP ERP rollout and Lean Six Sigma process improvements across UAE sites.",
  ],
  skills: ["JavaScript", "Excel"],
});

const requirements: JdRequirements = {
  jobTitle: "Process Excellence Manager",
  hardSkills: ["Lean Six Sigma", "Java", "JavaScript"],
  tools: ["SAP", "Microsoft Excel"],
  certifications: ["PMP"],
  softSkills: [],
  keywords: [],
};

const result = matchRequirementsToCv(requirements, cv);
const matchedOf = (term: string) =>
  result.terms.find((t) => t.term === term)?.matched;

describe("matchRequirementsToCv", () => {
  test("present multi-word and single-token terms match", () => {
    assert.equal(matchedOf("Lean Six Sigma"), true, "Lean Six Sigma present");
    assert.equal(matchedOf("SAP"), true, "SAP present in a bullet");
    assert.equal(matchedOf("JavaScript"), true, "JavaScript present as a skill");
  });

  test("absent terms are reported missing", () => {
    assert.equal(matchedOf("PMP"), false, "PMP is not anywhere in the CV");
  });

  test("single tokens respect word boundaries (java !== javascript)", () => {
    // "javascript" is in the corpus; the requirement "Java" must NOT match it.
    assert.equal(matchedOf("Java"), false, "Java must not match javascript");
  });

  test("alias map: Microsoft Excel matches an 'Excel' skill", () => {
    assert.equal(matchedOf("Microsoft Excel"), true, "Excel alias matches");
  });

  test("score is a weighted 0–100 integer with a band", () => {
    assert.ok(
      Number.isInteger(result.score) &&
        result.score >= 0 &&
        result.score <= 100,
      `score in range: ${result.score}`,
    );
    assert.ok(
      ["strong", "good", "partial", "low"].includes(result.band),
      `band valid: ${result.band}`,
    );
    // 4 of 6 terms matched, but weighting differs by category — just assert
    // the count rollup is internally consistent.
    assert.equal(
      result.matchedCount,
      result.terms.filter((t) => t.matched).length,
    );
    assert.equal(result.totalRequirements, result.terms.length);
  });
});

/* ── Variant / abbreviation matching (founder request 2026-06) ─────────────── */
const variantCv = makeCv({
  bullets: ["Administered the company's Odoo ERP rollout across the UAE."],
  skills: ["M365", "Odoo ERP Administration", "Power BI"],
});
const variantReq: JdRequirements = {
  jobTitle: "ERP Administrator",
  hardSkills: ["Microsoft 365", "Odoo Administration", "Java"],
  tools: [],
  certifications: [],
  softSkills: [],
  keywords: [],
};
const vres = matchRequirementsToCv(variantReq, variantCv);
const vMatched = (t: string) => vres.terms.find((x) => x.term === t)?.matched;

describe("variant / abbreviation matching", () => {
  test("abbreviation: 'Microsoft 365' matches a CV skill 'M365'", () => {
    assert.equal(vMatched("Microsoft 365"), true);
  });

  test("extra generic word: 'Odoo Administration' matches 'Odoo ERP Administration'", () => {
    assert.equal(vMatched("Odoo Administration"), true);
  });

  test("still respects boundaries: 'Java' does NOT match (no java in CV)", () => {
    assert.equal(vMatched("Java"), false);
  });

  test("skillVariantMatch direct: positive cases", () => {
    assert.equal(skillVariantMatch("M365", "Microsoft 365"), true);
    assert.equal(skillVariantMatch("Odoo Administration", "Odoo ERP Administration"), true);
    assert.equal(skillVariantMatch("Excel", "Microsoft Excel"), true);
    assert.equal(skillVariantMatch("Project Manager", "Project Management"), true); // stem manage
  });

  test("skillVariantMatch direct: negative cases (no false positives)", () => {
    assert.equal(skillVariantMatch("Java", "JavaScript"), false);
    assert.equal(skillVariantMatch("Data Engineering", "Data Management"), false);
    assert.equal(skillVariantMatch("Python", "PyTorch"), false);
    // Stem-collapse must not bridge two unrelated single words: "Manager" and
    // "Management" share only the stem "manage", never a verbatim anchor.
    assert.equal(skillVariantMatch("Manager", "Management"), false);
    assert.equal(skillVariantMatch("Developer", "Development"), false);
  });
});

/* ── Punctuation must not glue unrelated words into a phrase ─────────────────
 *
 * normalizeText used to flatten every punctuation mark to a space, so the
 * substring check in corpusHas bridged clause boundaries: "washing machine;
 * learning curve" became "washing machine learning curve", which literally
 * contains "machine learning". Recorded as a known bug in
 * docs/jd-match-evidence-pass.md — a false "your CV already covers this" is
 * the costliest error this feature can make. */
describe("phrase boundaries (punctuation cannot be bridged)", () => {
  const mlReq = (cvOpts: { bullets: string[]; skills: string[] }) => {
    const r = matchRequirementsToCv(
      {
        jobTitle: "",
        hardSkills: ["Machine Learning"],
        tools: [],
        certifications: [],
        softSkills: [],
        keywords: [],
      },
      makeCv(cvOpts),
    );
    return r.terms.find((t) => t.term === "Machine Learning")?.matched;
  };

  test("a semicolon between the words is NOT a match", () => {
    assert.equal(
      mlReq({
        bullets: ["Operated the washing machine; learning new procedures took two weeks."],
        skills: [],
      }),
      false,
      "'washing machine; learning new procedures' must not cover machine learning",
    );
  });

  test("a comma between the words is NOT a match", () => {
    assert.equal(
      mlReq({ bullets: ["Serviced each machine, learning the fault codes as I went."], skills: [] }),
      false,
    );
  });

  test("a field seam between the words is NOT a match", () => {
    // Two separate bullets. Joined with a plain space these read as one
    // sentence and produced a literal hit.
    assert.equal(
      mlReq({
        bullets: ["Maintained the washing machine", "Learning new procedures took two weeks"],
        skills: [],
      }),
      false,
      "a phrase must not bridge two separate CV entries",
    );
  });

  test("the genuine phrase still matches", () => {
    assert.equal(
      mlReq({ bullets: ["Delivered experience in machine learning forecasting models."], skills: [] }),
      true,
    );
  });

  test("the genuine phrase still matches as a skill", () => {
    assert.equal(mlReq({ bullets: ["Ran the ops desk."], skills: ["Machine Learning"] }), true);
  });

  test("hyphens still JOIN — 'Six-Sigma' covers a 'Six Sigma' requirement", () => {
    const r = matchRequirementsToCv(
      { jobTitle: "", hardSkills: ["Six Sigma"], tools: [], certifications: [], softSkills: [], keywords: [] },
      makeCv({ bullets: ["Ran the ops desk."], skills: ["Six-Sigma"] }),
    );
    assert.equal(r.terms.find((t) => t.term === "Six Sigma")?.matched, true);
  });

  test("punctuation INSIDE a requirement does not block it", () => {
    // Asymmetry check: the JD's own brackets are formatting, not evidence
    // that the CV's words were separated.
    const r = matchRequirementsToCv(
      {
        jobTitle: "",
        hardSkills: ["Six Sigma (Green Belt)"],
        tools: [],
        certifications: [],
        softSkills: [],
        keywords: [],
      },
      makeCv({ bullets: ["Ran the ops desk."], skills: ["Six Sigma Green Belt"] }),
    );
    assert.equal(r.terms.find((t) => t.term === "Six Sigma (Green Belt)")?.matched, true);
  });

  test("single tokens still match across a boundary (the token IS there)", () => {
    const r = matchRequirementsToCv(
      { jobTitle: "", tools: ["SAP"], hardSkills: [], certifications: [], softSkills: [], keywords: [] },
      makeCv({ bullets: ["Rolled out SAP; trained 40 users."], skills: [] }),
    );
    assert.equal(r.terms.find((t) => t.term === "SAP")?.matched, true);
  });
});

/* ── Category hypernyms are one-directional (review 2026-06) ────────────────── */
//
// A JD requirement for a broad CATEGORY (CRM, ERP, SQL, project management) is
// satisfied by any specific product in the CV, but a requirement for a SPECIFIC
// product/cert must NOT be reported covered by a sibling — Salesforce ≠ HubSpot,
// SAP ≠ Odoo, the PMP certification ≠ the role title "Project Manager".
describe("category hypernyms (one-directional)", () => {
  const catCv = makeCv({
    bullets: ["Managed the HubSpot pipeline and implemented Odoo across the UAE."],
    skills: ["MySQL"],
  });
  // role title carries "Project Manager"; there is no PMP certification.
  catCv.experience[0].role = "Senior Project Manager";

  const run = (req: Partial<JdRequirements>) => {
    const r = matchRequirementsToCv(
      { jobTitle: "", hardSkills: [], tools: [], certifications: [], softSkills: [], keywords: [], ...req },
      catCv,
    );
    return (t: string) => r.terms.find((x) => x.term === t)?.matched;
  };

  test("a sibling product does NOT satisfy a specific requirement", () => {
    const m = run({ tools: ["Salesforce", "SAP"] });
    assert.equal(m("Salesforce"), false, "HubSpot must not cover Salesforce");
    assert.equal(m("SAP"), false, "Odoo must not cover SAP");
  });

  test("a specific cert is NOT satisfied by a mere role title", () => {
    const m = run({ certifications: ["PMP"] });
    assert.equal(m("PMP"), false, "the 'Project Manager' role must not cover the PMP cert");
  });

  test("the category itself IS satisfied by any member in the CV", () => {
    const m = run({ tools: ["CRM", "ERP", "SQL"] });
    assert.equal(m("CRM"), true, "HubSpot covers the CRM category");
    assert.equal(m("ERP"), true, "Odoo covers the ERP category");
    assert.equal(m("SQL"), true, "MySQL covers the SQL category");
  });
});
