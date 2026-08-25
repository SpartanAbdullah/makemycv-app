/**
 * Tests for the skill evidence detector (lib/skills/evidence.ts).
 *
 * The precision tests are the point of this file. docs/jd-match-evidence-pass.md
 * records a previous evidence detector that was built and then REVERTED because
 * it produced false "you already prove this" claims. Its three named failures
 * are pinned below as negative tests, because a regression here does not look
 * like a bug — it looks like the product confidently lying to a job seeker.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  assessSkill,
  assessSkills,
  buildEvidenceIndex,
  describeEvidence,
  findSkillEvidence,
} from "./evidence";
import type { CvData } from "../types/cv";

function cvWith(partial: Partial<CvData>): CvData {
  return {
    personal: {
      firstName: "Imran",
      lastName: "Sheikh",
      headline: "",
      email: "",
      phone: "",
      location: "Dubai",
      website: "",
      linkedin: "",
      summary: "",
    },
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    settings: { templateId: "classic" },
    ...partial,
  };
}

const role = (
  id: string,
  roleTitle: string,
  company: string,
  bullets: string[],
): CvData["experience"][number] => ({
  id,
  company,
  role: roleTitle,
  location: "Dubai",
  startDate: "2021",
  endDate: "",
  isCurrent: true,
  bullets,
});

const skill = (name: string): CvData["skills"][number] => ({ id: `sk-${name}`, name });

/* ── Precision: the failures that got the last detector reverted ───────────── */

describe("precision — the reverted detector's own failure cases", () => {
  const trap = cvWith({
    experience: [
      role("e1", "Facilities Supervisor", "Acme FZE", [
        "Operated the washing machine; learning curve was steep at first.",
        "Attended a network event; met an engineer from the main contractor.",
        "Owned financial close; a junior analyst supported the reconciliation.",
      ]),
    ],
  });

  test('"washing machine; learning curve" does NOT evidence Machine Learning', () => {
    assert.equal(findSkillEvidence(trap, { name: "Machine Learning" }), null);
  });

  test('"network event; met an engineer" does NOT evidence Network Engineering', () => {
    assert.equal(findSkillEvidence(trap, { name: "Network Engineering" }), null);
  });

  test('"financial close; a junior analyst" does NOT evidence Financial Analysis', () => {
    assert.equal(findSkillEvidence(trap, { name: "Financial Analysis" }), null);
  });

  test("a sentence boundary is not bridgeable either", () => {
    const cv = cvWith({
      experience: [
        role("e1", "Technician", "Acme", ["Serviced the machine. Learning the codes took a week."]),
      ],
    });
    assert.equal(findSkillEvidence(cv, { name: "Machine Learning" }), null);
  });

  test("a field seam is not bridgeable — two bullets are not one sentence", () => {
    const cv = cvWith({
      experience: [
        role("e1", "Technician", "Acme", [
          "Maintained the washing machine",
          "Learning new procedures took two weeks",
        ]),
      ],
    });
    assert.equal(findSkillEvidence(cv, { name: "Machine Learning" }), null);
  });

  test("we accept the recall cost: a reworded skill is NOT claimed as evidence", () => {
    // This is a deliberate miss, documented in the module header. Detecting it
    // needs semantics, and a false positive costs far more than this miss.
    const cv = cvWith({
      experience: [
        role("e1", "IT Lead", "Acme", ["Managing the company's IT infrastructure day to day."]),
      ],
    });
    assert.equal(findSkillEvidence(cv, { name: "Infrastructure Management" }), null);
  });

  test("a term is never evidenced by the skills list itself", () => {
    const cv = cvWith({ skills: [skill("Primavera P6")] });
    assert.equal(findSkillEvidence(cv, { name: "Primavera P6" }), null);
  });
});

/* ── Recall: the cases that must work ──────────────────────────────────────── */

describe("recall — literal and alias hits", () => {
  const cv = cvWith({
    personal: {
      ...cvWith({}).personal,
      headline: "Senior Financial Analyst",
      summary: "Nine years across banking and FMCG, including IFRS reporting.",
    },
    experience: [
      role("e1", "Senior Financial Analyst", "Emirates NBD", [
        "Reduced month-end close from 8 days to 5 by automating journals in SAP FICO.",
        "Built Power BI dashboards adopted by 40+ stakeholders.",
      ]),
    ],
    certifications: [{ id: "c1", name: "NEBOSH IGC", issuer: "NEBOSH" }],
    projects: [{ id: "p1", name: "Ejari Migration", bullets: ["Moved 1,200 tenancy contracts."] }],
  });

  test("finds a term in an experience bullet", () => {
    const e = findSkillEvidence(cv, { name: "SAP FICO" });
    assert.ok(e);
    assert.equal(e.source.kind, "experienceBullet");
    assert.match(e.snippet, /month-end close/);
  });

  test("finds a term in the summary", () => {
    const e = findSkillEvidence(cv, { name: "IFRS" });
    assert.ok(e);
    assert.equal(e.source.kind, "summary");
  });

  test("finds a term in a project name", () => {
    const e = findSkillEvidence(cv, { name: "Ejari" });
    assert.ok(e);
    assert.equal(e.source.kind, "projectName");
  });

  test("an alias matches, and reports which spelling was found", () => {
    const e = findSkillEvidence(cv, { name: "NEBOSH IGC", aliases: ["NEBOSH"] });
    assert.ok(e);
    assert.equal(e.source.kind, "certification");
    assert.equal(e.matchedTerm, "NEBOSH IGC");
  });

  test("the alias is reported when only the alias is present", () => {
    const haad = cvWith({
      experience: [role("e1", "Staff Nurse", "NMC", ["Held a valid HAAD licence throughout."])],
    });
    const e = findSkillEvidence(haad, {
      name: "DOH Licence (Abu Dhabi)",
      aliases: ["DOH", "HAAD"],
    });
    assert.ok(e);
    assert.equal(e.matchedTerm, "HAAD");
  });

  test("matching is case-insensitive", () => {
    const e = findSkillEvidence(cv, { name: "power bi" });
    assert.ok(e);
  });

  test("a weak alias never evidences from prose, but still counts as listed", () => {
    // "React"/"Node" are ordinary English words. Same distinction the JD
    // matcher draws — a word is a claim in a skills list, just a word in a
    // sentence.
    const reactish = { name: "React.js", aliases: ["ReactJS"], weakAliases: ["React"] };

    const prose = cvWith({
      experience: [
        role("e1", "Site Supervisor", "Acme", [
          "Ability to react quickly to changing conditions on site.",
        ]),
      ],
    });
    assert.equal(findSkillEvidence(prose, reactish), null, "prose is not evidence");
    assert.equal(assessSkill(prose, reactish).status, "absent");

    // Listed under the weak spelling → recognised, so we don't re-suggest it.
    const listed = cvWith({ skills: [skill("React")] });
    assert.equal(assessSkill(listed, reactish).status, "claimed");

    // The unambiguous spelling in prose IS evidence.
    const named = cvWith({
      experience: [role("e1", "Developer", "Acme", ["Built the console in React.js."])],
    });
    assert.ok(findSkillEvidence(named, reactish));
  });

  test("a single token respects word boundaries (Java is not JavaScript)", () => {
    const js = cvWith({
      experience: [role("e1", "Developer", "Acme", ["Wrote the admin console in JavaScript."])],
    });
    assert.equal(findSkillEvidence(js, { name: "Java" }), null);
    assert.ok(findSkillEvidence(js, { name: "JavaScript" }));
  });
});

/* ── Evidence strength ordering ────────────────────────────────────────────── */

describe("strongest evidence wins", () => {
  test("a certification outranks a passing mention in the summary", () => {
    const cv = cvWith({
      personal: { ...cvWith({}).personal, summary: "Studying towards PMP this year." },
      certifications: [{ id: "c1", name: "PMP", issuer: "PMI" }],
    });
    const e = findSkillEvidence(cv, { name: "PMP" });
    assert.ok(e);
    assert.equal(e.source.kind, "certification");
  });

  test("an experience bullet outranks the headline", () => {
    const cv = cvWith({
      personal: { ...cvWith({}).personal, headline: "Odoo Administrator" },
      experience: [role("e1", "Analyst", "Acme", ["Administered Odoo across three departments."])],
    });
    const e = findSkillEvidence(cv, { name: "Odoo" });
    assert.ok(e);
    assert.equal(e.source.kind, "experienceBullet");
  });
});

/* ── The four states the UI renders ────────────────────────────────────────── */

describe("assessSkill — the four states", () => {
  const base = cvWith({
    experience: [
      role("e1", "Procurement Specialist", "BuildCo", [
        "Negotiated AED 12M in annual supplier contracts using SAP MM.",
      ]),
    ],
    skills: [skill("SAP MM"), skill("Stakeholder Management")],
  });

  test("evidenced — listed AND shown in the CV", () => {
    const a = assessSkill(base, { name: "SAP MM" });
    assert.equal(a.status, "evidenced");
    assert.ok(a.evidence);
    assert.equal(a.evidence.source.kind, "experienceBullet");
  });

  test("claimed — listed but shown nowhere else", () => {
    const a = assessSkill(base, { name: "Stakeholder Management" });
    assert.equal(a.status, "claimed");
    assert.equal(a.evidence, null);
  });

  test("unlisted — shown in the CV but missing from the skills list", () => {
    // The highest-value suggestion: the user supplied the proof, not the label.
    const a = assessSkill(base, { name: "Negotiation", aliases: ["Negotiated"] });
    assert.equal(a.status, "unlisted");
    assert.ok(a.evidence);
  });

  test("absent — neither listed nor shown", () => {
    const a = assessSkill(base, { name: "Kubernetes" });
    assert.equal(a.status, "absent");
    assert.equal(a.evidence, null);
  });

  test("listing a skill under an alias still counts as listed", () => {
    const cv = cvWith({ skills: [skill("HAAD")] });
    const a = assessSkill(cv, { name: "DOH Licence (Abu Dhabi)", aliases: ["HAAD"] });
    assert.equal(a.status, "claimed", "already on the list, just spelled differently");
  });
});

/* ── Batch + description ───────────────────────────────────────────────────── */

describe("assessSkills and describeEvidence", () => {
  const cv = cvWith({
    experience: [
      role("e1", "Senior Financial Analyst", "Emirates NBD", ["Ran IFRS 9 impairment models."]),
    ],
    skills: [skill("Excel")],
  });

  test("batch keys by canonical name and shares one index", () => {
    const out = assessSkills(cv, [
      { name: "IFRS", aliases: ["IFRS 9"] },
      { name: "Excel" },
      { name: "Kubernetes" },
    ]);
    assert.equal(out.get("IFRS")?.status, "unlisted");
    assert.equal(out.get("Excel")?.status, "claimed");
    assert.equal(out.get("Kubernetes")?.status, "absent");
  });

  test("describeEvidence names the place in the user's own words", () => {
    const e = findSkillEvidence(cv, { name: "IFRS" });
    assert.ok(e);
    assert.equal(describeEvidence(e), "your Senior Financial Analyst role at Emirates NBD");
  });

  test("describeEvidence degrades gracefully on partial entries", () => {
    const partial = cvWith({ experience: [role("e1", "", "", ["Ran IFRS 9 models."])] });
    const e = findSkillEvidence(partial, { name: "IFRS" });
    assert.ok(e);
    assert.equal(describeEvidence(e), "your experience");
  });
});

/* ── Robustness ────────────────────────────────────────────────────────────── */

describe("robustness", () => {
  test("an empty CV yields no evidence and no crash", () => {
    const empty = cvWith({});
    assert.equal(buildEvidenceIndex(empty).units.length, 0);
    assert.equal(findSkillEvidence(empty, { name: "IFRS" }), null);
    assert.equal(assessSkill(empty, { name: "IFRS" }).status, "absent");
  });

  test("blank and whitespace terms never match", () => {
    const cv = cvWith({ personal: { ...cvWith({}).personal, summary: "Some real text." } });
    assert.equal(findSkillEvidence(cv, { name: "" }), null);
    assert.equal(findSkillEvidence(cv, { name: "   " }), null);
    assert.equal(findSkillEvidence(cv, { name: "x", aliases: ["", "  "] }), null);
  });

  test("empty bullets and blank entries are skipped, not indexed", () => {
    const cv = cvWith({
      experience: [role("e1", "Analyst", "Acme", ["", "   ", "Real bullet with SQL."])],
      certifications: [{ id: "c1", name: "   ", issuer: "" }],
    });
    const index = buildEvidenceIndex(cv);
    assert.ok(index.units.every((u) => u.text.trim().length > 0));
    const e = findSkillEvidence(cv, { name: "SQL" });
    assert.ok(e);
    assert.equal(e.source.kind, "experienceBullet");
    assert.equal((e.source as { bulletIndex: number }).bulletIndex, 2, "index survives blanks");
  });
});
