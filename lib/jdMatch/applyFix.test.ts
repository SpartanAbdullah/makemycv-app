/**
 * Sanity checks for the JD Match Phase B apply-fix helpers (applyFix.ts).
 *
 * No test framework in package.json — built-in node:test + node:assert only,
 * mirroring lib/jdMatch/match.test.ts. Run via: npm run test:applyfix
 *
 * Guards the invariants Phase B depends on:
 *  - add-skill / add-cert dedupe case-insensitively and never mutate the input,
 *  - a no-op returns the SAME reference (so the store skips the write),
 *  - bullet rewrite replaces the right index and is a no-op on bad targets,
 *  - blank inputs are rejected (never fabricate an empty skill/cert/bullet).
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  addCertificationToCv,
  addSkillToCv,
  applyBulletRewrite,
  hasCertification,
  hasSkill,
} from "./applyFix";
import type { CvData } from "../types/cv";

function makeCv(): CvData {
  return {
    personal: {
      firstName: "Aisha",
      lastName: "Al-Marri",
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
        bullets: ["Led the rollout across 4 UAE sites.", "Reduced cost by 18%."],
      },
    ],
    education: [],
    skills: [{ id: "s1", name: "Excel" }],
    languages: [],
    certifications: [{ id: "c1", name: "Lean Six Sigma", issuer: "ASQ" }],
    projects: [],
    settings: { templateId: "classic" },
  };
}

describe("addSkillToCv", () => {
  test("appends a new intermediate-level skill", () => {
    const cv = makeCv();
    const next = addSkillToCv(cv, "Power BI");
    assert.equal(next.skills.length, 2);
    const added = next.skills.find((s) => s.name === "Power BI");
    assert.ok(added, "skill added");
    assert.equal(added?.level, "intermediate");
    assert.ok(added?.id, "has an id");
  });

  test("dedupes case-insensitively and returns the SAME reference", () => {
    const cv = makeCv();
    const next = addSkillToCv(cv, "excel"); // already present as "Excel"
    assert.equal(next, cv, "no-op returns same reference");
    assert.equal(next.skills.length, 1);
  });

  test("blank term is a no-op", () => {
    const cv = makeCv();
    assert.equal(addSkillToCv(cv, "   "), cv);
  });

  test("does not mutate the input CV", () => {
    const cv = makeCv();
    addSkillToCv(cv, "Kubernetes");
    assert.equal(cv.skills.length, 1, "input untouched");
  });
});

describe("addCertificationToCv", () => {
  test("appends a certification with a blank issuer", () => {
    const cv = makeCv();
    const next = addCertificationToCv(cv, "PMP");
    assert.equal(next.certifications.length, 2);
    const added = next.certifications.find((c) => c.name === "PMP");
    assert.equal(added?.issuer, "", "issuer is never invented");
  });

  test("dedupes case-insensitively (same reference)", () => {
    const cv = makeCv();
    assert.equal(addCertificationToCv(cv, "lean six sigma"), cv);
  });
});

describe("applyBulletRewrite", () => {
  test("replaces the targeted bullet in place", () => {
    const cv = makeCv();
    const next = applyBulletRewrite(cv, "exp-1", 1, "Reduced operating cost by 18% via Lean Six Sigma.");
    assert.equal(next.experience[0].bullets[1], "Reduced operating cost by 18% via Lean Six Sigma.");
    assert.equal(next.experience[0].bullets[0], "Led the rollout across 4 UAE sites.", "sibling untouched");
    assert.equal(next.experience[0].bullets.length, 2, "no bullet added");
  });

  test("unknown experience id is a no-op", () => {
    const cv = makeCv();
    assert.equal(applyBulletRewrite(cv, "nope", 0, "x"), cv);
  });

  test("out-of-range index is a no-op", () => {
    const cv = makeCv();
    assert.equal(applyBulletRewrite(cv, "exp-1", 9, "x"), cv);
    assert.equal(applyBulletRewrite(cv, "exp-1", -1, "x"), cv);
  });

  test("blank or identical text is a no-op", () => {
    const cv = makeCv();
    assert.equal(applyBulletRewrite(cv, "exp-1", 0, "   "), cv);
    assert.equal(applyBulletRewrite(cv, "exp-1", 0, "Led the rollout across 4 UAE sites."), cv);
  });

  test("does not mutate the input CV", () => {
    const cv = makeCv();
    applyBulletRewrite(cv, "exp-1", 0, "Totally new text.");
    assert.equal(cv.experience[0].bullets[0], "Led the rollout across 4 UAE sites.");
  });
});

describe("predicates", () => {
  test("hasSkill / hasCertification are case-insensitive", () => {
    const cv = makeCv();
    assert.equal(hasSkill(cv, "EXCEL"), true);
    assert.equal(hasSkill(cv, "Power BI"), false);
    assert.equal(hasCertification(cv, "lean six sigma"), true);
    assert.equal(hasCertification(cv, "PMP"), false);
  });
});
