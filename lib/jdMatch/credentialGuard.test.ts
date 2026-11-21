/**
 * Tests for the JD Match licence guard (lib/jdMatch/credentialGuard.ts) and
 * the bank lookup behind it (isCredentialTerm in lib/data/domainSkills.ts).
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { jdAddNeedsCredentialGuard } from "./credentialGuard";
import { isCredentialTerm } from "../data/domainSkills";

describe("isCredentialTerm", () => {
  test("recognises a credential by its bank name", () => {
    for (const name of ["PMP", "NEBOSH IGC", "RERA Broker Card", "DHA Licence (Dubai)", "CIPD"]) {
      assert.equal(isCredentialTerm(name), true, name);
    }
  });

  test("recognises a credential by an alias, in any case", () => {
    for (const alias of ["dha licence", "HAAD", "Project Management Professional", "  nebosh  "]) {
      assert.equal(isCredentialTerm(alias), true, alias);
    }
  });

  test("does not treat skills, tools or government systems as credentials", () => {
    for (const name of ["Excel", "Salesforce", "Ejari", "Tasheel", "Negotiation", "Opera PMS", ""]) {
      assert.equal(isCredentialTerm(name), false, name);
    }
  });
});

describe("jdAddNeedsCredentialGuard", () => {
  test("guards everything the advert lists as a certification, known or not", () => {
    assert.equal(jdAddNeedsCredentialGuard("certifications", "PMP"), true);
    assert.equal(jdAddNeedsCredentialGuard("certifications", "Some Regional Board Licence"), true);
  });

  test("guards a known credential the extractor filed under another bucket", () => {
    assert.equal(jdAddNeedsCredentialGuard("hardSkills", "PMP"), true);
    assert.equal(jdAddNeedsCredentialGuard("keywords", "DHA Licence"), true);
    assert.equal(jdAddNeedsCredentialGuard("tools", "NEBOSH"), true);
  });

  test("leaves ordinary skills and tools one tap away", () => {
    assert.equal(jdAddNeedsCredentialGuard("hardSkills", "Budgeting"), false);
    assert.equal(jdAddNeedsCredentialGuard("tools", "Power BI"), false);
    assert.equal(jdAddNeedsCredentialGuard("softSkills", "Teamwork"), false);
    assert.equal(jdAddNeedsCredentialGuard("keywords", "Ejari"), false);
  });
});
