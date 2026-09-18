/**
 * Tests for pasting a list of skills (lib/skills/paste.ts).
 *
 * The bug being fixed: the search box strips commas and line breaks, so a
 * pasted "Excel, SAP, Negotiation" became ONE skill that printed on the CV.
 * The negative tests matter as much: a paste must never slip a licence past
 * the "I hold it" guard, and must never turn CV sentences into skills.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  MAX_PASTE_ADDS,
  planPastedSkills,
  splitPastedText,
} from "./paste";

const names = (plan: ReturnType<typeof planPastedSkills>) =>
  plan?.add.map((s) => s.name) ?? [];

describe("splitPastedText", () => {
  test("comma list — the reported bug", () => {
    assert.deepEqual(splitPastedText("Excel, SAP, Negotiation"), ["Excel", "SAP", "Negotiation"]);
  });

  test("line-separated list with bullets, dashes and numbering", () => {
    const text = "• Excel\n- Vendor Management\n* Tally\n1. Payroll\n2) Budgeting\n— Forecasting";
    assert.deepEqual(splitPastedText(text), [
      "Excel", "Vendor Management", "Tally", "Payroll", "Budgeting", "Forecasting",
    ]);
  });

  test("LinkedIn-style middle dots and pipes", () => {
    assert.deepEqual(splitPastedText("Excel · SAP | Negotiation"), ["Excel", "SAP", "Negotiation"]);
  });

  test("commas inside parentheses do not split", () => {
    assert.deepEqual(splitPastedText("Microsoft Office (Word, Excel), Tally"), [
      "Microsoft Office (Word/Excel)",
      "Tally",
    ]);
  });

  test("slash is NOT a separator — CI/CD stays whole", () => {
    assert.deepEqual(splitPastedText("CI/CD, Docker"), ["CI/CD", "Docker"]);
  });

  test("a 'Label:' prefix is dropped, a bare heading disappears", () => {
    assert.deepEqual(
      splitPastedText("Technical Skills:\nTools: Excel, Power BI\nLanguages: Python"),
      ["Excel", "Power BI", "Python"],
    );
  });

  test("list tails like 'etc.' are not skills", () => {
    assert.deepEqual(splitPastedText("Excel, Word, PowerPoint, etc."), ["Excel", "Word", "PowerPoint"]);
  });

  test("a skill that starts with O is not eaten as a bullet", () => {
    assert.deepEqual(splitPastedText("O Level Chemistry, Excel"), ["O Level Chemistry", "Excel"]);
  });

  test("C++, C# and Node.js survive cleaning", () => {
    assert.deepEqual(splitPastedText("C++, C#, Node.js."), ["C++", "C#", "Node.js"]);
  });
});

describe("planPastedSkills", () => {
  test("a single term is not a list — returns null so the box pastes normally", () => {
    assert.equal(planPastedSkills("Excel", []), null);
    assert.equal(planPastedSkills("  Excel.  ", []), null);
  });

  test("adds each piece in order, keeping the user's wording", () => {
    assert.deepEqual(names(planPastedSkills("Excel, SAP, Negotiation", [])), ["Excel", "SAP", "Negotiation"]);
  });

  test("skips what is already on the list, case-insensitively", () => {
    const plan = planPastedSkills("excel, Tally", ["Excel"]);
    assert.deepEqual(names(plan), ["Tally"]);
    assert.deepEqual(plan?.duplicates, [{ name: "excel" }]);
  });

  test("an alias of a held skill is a duplicate, and says what it matched", () => {
    const plan = planPastedSkills("SFDC, Tally", ["Salesforce"]);
    assert.deepEqual(names(plan), ["Tally"]);
    assert.deepEqual(plan?.duplicates, [{ name: "SFDC", as: "Salesforce" }]);
  });

  test("repeats within one paste are added once", () => {
    const plan = planPastedSkills("Excel, excel, EXCEL, Tally", []);
    assert.deepEqual(names(plan), ["Excel", "Tally"]);
    assert.equal(plan?.duplicates.length, 2);
  });

  test("licences are NEVER added directly — they go to the guard", () => {
    const plan = planPastedSkills("Excel, CFA, Chartered Financial Analyst", []);
    assert.deepEqual(names(plan), ["Excel"]);
    // The alias of the same credential is caught as a repeat, not queued twice.
    assert.deepEqual(plan?.credentials, [{ name: "CFA" }]);
  });

  test("a licence already held is a duplicate, not a second guard prompt", () => {
    const plan = planPastedSkills("CFA, Excel", ["CFA"]);
    assert.deepEqual(plan?.credentials, []);
    assert.deepEqual(plan?.duplicates, [{ name: "CFA" }]);
  });

  test("sentences from a pasted CV are reported, not added", () => {
    const plan = planPastedSkills(
      "Excel\nManaged a team of 12 across three warehouses in Jebel Ali\nTally",
      [],
    );
    assert.deepEqual(names(plan), ["Excel", "Tally"]);
    assert.equal(plan?.tooLong.length, 1);
  });

  test("bank matches get a category; unknown skills get none, like a typed add", () => {
    const plan = planPastedSkills("Salesforce, Zzq Custom Thing", []);
    assert.equal(plan?.add[0].category, "technical");
    assert.equal(plan?.add[1].category, undefined);
  });

  test("a huge paste is capped, and the rest is reported rather than dropped", () => {
    const many = Array.from({ length: MAX_PASTE_ADDS + 5 }, (_, i) => `Skill${i}`).join(", ");
    const plan = planPastedSkills(many, []);
    assert.equal(plan?.add.length, MAX_PASTE_ADDS);
    assert.equal(plan?.overLimit.length, 5);
  });
});
