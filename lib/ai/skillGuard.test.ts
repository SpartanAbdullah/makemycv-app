import { test } from "node:test";
import assert from "node:assert/strict";
import { dropUnmentionedProducts, namesUnmentionedProduct, skillsInputText } from "./skillGuard";

const siteEngineer = skillsInputText({
  headline: "Site Engineer",
  experienceRoles: [{ title: "Site Engineer", company: "Build Well Contracting", bullets: ["Supervised daily site activities."] }],
  existingSkills: ["Site Supervision"],
});

test("a product the candidate never mentioned is dropped, general skills stay", () => {
  const out = dropUnmentionedProducts(
    ["Site Supervision", "AutoCAD", "CAD software", "Primavera P6 scheduling", "Health and Safety Compliance", "Advanced Excel"],
    siteEngineer,
  );
  assert.deepEqual(out, ["Site Supervision", "CAD software", "Health and Safety Compliance"]);
});

test("a product the candidate did mention is kept, in a bullet or in their skills", () => {
  const input = skillsInputText({
    headline: "Accountant",
    experienceRoles: [{ title: "Accountant", company: "Example Trading", bullets: ["Posted entries in Tally and prepared VAT returns."] }],
    existingSkills: ["SAP FICO"],
  });
  assert.deepEqual(dropUnmentionedProducts(["Tally ERP", "SAP S/4HANA", "QuickBooks", "VAT Compliance"], input), [
    "Tally ERP",
    "SAP S/4HANA",
    "VAT Compliance",
  ]);
});

test("another name of the same product family counts as a mention", () => {
  const input = "Prepared reports in MS Office for the management team.";
  assert.equal(namesUnmentionedProduct("Microsoft Excel", input), false);
  assert.equal(namesUnmentionedProduct("Power BI", input), true);
});

test("general categories the prompt asks for always pass", () => {
  for (const s of ["ERP systems", "CRM software", "Property Management Systems (PMS)", "POS systems", "Warehouse management systems", "SQL", "Version control", "Spreadsheets"]) {
    assert.equal(namesUnmentionedProduct(s, ""), false, s);
  }
});

test("a product name inside an ordinary word is not a match", () => {
  for (const s of ["Excellent communication", "Operational planning", "Reactive maintenance", "Tallying stock counts", "Disappearing-ink handling"]) {
    assert.equal(namesUnmentionedProduct(s, ""), false, s);
  }
});

test("matching ignores case and reads names with punctuation", () => {
  assert.equal(namesUnmentionedProduct("autocad", ""), true);
  assert.equal(namesUnmentionedProduct("Node.js development", ""), true);
  assert.equal(namesUnmentionedProduct("Node.js development", "Built services in NODE.JS"), false);
  assert.equal(namesUnmentionedProduct("SAP S/4HANA", "Worked on s/4hana migration"), false);
});
