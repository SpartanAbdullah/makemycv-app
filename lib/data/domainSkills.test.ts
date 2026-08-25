/**
 * Guards the domain hard-skill / cert bank (lib/data/domainSkills.ts).
 * Built-in node:test + node:assert. Run via: npm run test:domainskills
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  allDomainSkills,
  domainHardSkills,
  domainSkillEntries,
  type DomainSkill,
} from "./domainSkills";

describe("domainHardSkills", () => {
  test("returns the domain's hard skills / certs", () => {
    const finance = domainHardSkills("finance");
    assert.ok(finance.includes("IFRS"));
    assert.ok(finance.includes("UAE VAT / FTA"));
    const healthcare = domainHardSkills("healthcare");
    assert.ok(healthcare.some((s) => s.includes("DHA")));
  });

  test("no domain / generic yields nothing (chip stays hidden)", () => {
    assert.deepEqual(domainHardSkills(undefined), []);
    assert.deepEqual(domainHardSkills("generic"), []);
  });

  test("excludes already-added skills (case-insensitive)", () => {
    const picks = domainHardSkills("it", ["python", "AWS"]);
    assert.equal(picks.includes("Python"), false);
    assert.equal(picks.includes("AWS"), false);
    assert.ok(picks.includes("Docker"));
  });

  test("respects the limit", () => {
    assert.equal(domainHardSkills("it", [], 3).length, 3);
  });

  test("every real family has a non-empty bank", () => {
    const families = [
      "sales", "marketing", "finance", "accounting", "operations", "logistics",
      "hr", "admin", "engineering", "it", "hospitality", "retail", "realestate",
      "healthcare", "education", "customerservice",
    ] as const;
    for (const f of families) {
      assert.ok(domainHardSkills(f).length > 0, `${f} should have skills`);
    }
  });
});

// --- Tier ordering ----------------------------------------------------------
//
// The user's literal question is "which skills MUST be there and which not".
// A flat tray of chips cannot answer it, so must-haves lead and the limit
// truncates the nice-to-haves first.

describe("must-have tiering", () => {
  test("must-haves come before nice-to-haves", () => {
    for (const domain of ["finance", "healthcare", "engineering", "hr"] as const) {
      const entries = domainSkillEntries(domain, [], 50);
      const lastMust = entries.map((e) => e.tier).lastIndexOf("must");
      const firstNice = entries.map((e) => e.tier).indexOf("nice");
      if (lastMust !== -1 && firstNice !== -1) {
        assert.ok(
          lastMust < firstNice,
          `${domain}: a nice-to-have sorted above a must-have`,
        );
      }
    }
  });

  test("a tight limit surfaces must-haves, not whatever was curated first", () => {
    const top3 = domainSkillEntries("healthcare", [], 3);
    assert.equal(top3.length, 3);
    assert.ok(top3.every((e) => e.tier === "must"));
  });

  test("every family has at least one must-have", () => {
    const families = [
      "sales", "marketing", "finance", "accounting", "operations", "logistics",
      "hr", "admin", "engineering", "it", "hospitality", "retail", "realestate",
      "healthcare", "education", "customerservice",
    ] as const;
    for (const f of families) {
      assert.ok(
        domainSkillEntries(f, [], 50).some((e) => e.tier === "must"),
        `${f} has no must-have — the chip tray cannot answer "which must be there"`,
      );
    }
  });
});

// --- Alias awareness --------------------------------------------------------
//
// Suggesting a skill the user has already listed under another name is the
// most common way a bank insults someone who has done the work. These are the
// exact aliases real UAE CVs use.

describe("alias-aware exclusion", () => {
  const cases: Array<[Parameters<typeof domainHardSkills>[0], string, string]> = [
    ["realestate", "RERA Certified", "RERA Broker Card"],
    ["realestate", "RERA", "RERA Broker Card"],
    ["healthcare", "HAAD", "DOH Licence (Abu Dhabi)"],
    ["healthcare", "MOH", "MOHAP Licence"],
    ["healthcare", "Dubai Health Authority", "DHA Licence (Dubai)"],
    ["healthcare", "Primary Source Verification", "DataFlow (PSV)"],
    ["engineering", "NEBOSH", "NEBOSH IGC"],
    ["engineering", "P6", "Primavera P6"],
    ["finance", "Federal Tax Authority", "UAE VAT / FTA"],
    ["finance", "Corporate Tax", "UAE Corporate Tax"],
    ["admin", "Microsoft 365", "MS Office 365"],
    ["admin", "Tas-heel", "Tasheel (MOHRE)"],
    ["it", "React.js", "React"],
    ["sales", "SFDC", "Salesforce"],
    ["hr", "Emiratization", "Emiratisation / Nafis"],
  ];

  for (const [domain, alias, canonical] of cases) {
    test(`"${alias}" suppresses "${canonical}"`, () => {
      const picks = domainHardSkills(domain, [alias], 50);
      assert.equal(
        picks.includes(canonical),
        false,
        `already had it as "${alias}"`,
      );
    });
  }

  test("alias matching is case- and whitespace-insensitive", () => {
    const picks = domainHardSkills("healthcare", ["  hAaD  "], 50);
    assert.equal(picks.includes("DOH Licence (Abu Dhabi)"), false);
  });

  test("a near-miss does NOT suppress (we only match whole aliases)", () => {
    // "DHA" must not swallow "DOH" — they are different emirates' regulators.
    const picks = domainHardSkills("healthcare", ["DHA"], 50);
    assert.equal(picks.includes("DHA Licence (Dubai)"), false);
    assert.ok(picks.includes("DOH Licence (Abu Dhabi)"), "DOH is a separate licence");
    assert.ok(picks.includes("MOHAP Licence"), "MOHAP is a separate licence");
  });
});

// --- Factual corrections ----------------------------------------------------
//
// Each of these was WRONG in the bank before 2026-08-25 and was corrected
// against the regulator. They are pinned so nobody reverts them by tidying.

describe("UAE factual corrections stay corrected", () => {
  const names = allDomainSkills().map((e) => e.name);

  test('"RERA Certified" is gone — RERA is the regulator, not a certificate', () => {
    assert.equal(names.includes("RERA Certified"), false);
    assert.ok(names.includes("RERA Broker Card"));
  });

  test("Ejari is modelled as a government system, not a credential", () => {
    const ejari = allDomainSkills().find((e) => e.name === "Ejari");
    assert.ok(ejari);
    assert.equal(ejari.kind, "system");
  });

  test("healthcare licensing is split by emirate, not shipped as Dubai-only", () => {
    const healthcare = domainSkillEntries("healthcare", [], 50).map((e) => e.name);
    assert.ok(healthcare.includes("DHA Licence (Dubai)"));
    assert.ok(healthcare.includes("DOH Licence (Abu Dhabi)"));
    assert.ok(healthcare.includes("MOHAP Licence"));
    // The mandatory step before ANY of them issues.
    assert.ok(healthcare.includes("DataFlow (PSV)"));
    // The old combined entry must not come back.
    assert.equal(healthcare.includes("DOH / MOH Licence"), false);
  });

  test("Tasheel and Amer name their own authority (they are not interchangeable)", () => {
    const admin = domainSkillEntries("admin", [], 50);
    const tasheel = admin.find((e) => e.name.startsWith("Tasheel"));
    const amer = admin.find((e) => e.name.startsWith("Amer"));
    assert.ok(tasheel && /MOHRE/.test(tasheel.name), "Tasheel is MOHRE labour");
    assert.ok(amer && /GDRFA/.test(amer.name), "Amer is GDRFA Dubai residency");
    assert.equal(admin.some((e) => e.name === "GDRFA / Amer"), false);
  });

  test("UAE Corporate Tax is carried alongside VAT", () => {
    const finance = domainSkillEntries("finance", [], 50).map((e) => e.name);
    assert.ok(finance.includes("UAE Corporate Tax"));
    assert.ok(finance.includes("UAE VAT / FTA"));
  });

  test("NEBOSH carries the certificate, not the bare brand — and no spec code", () => {
    const nebosh = allDomainSkills().find((e) => e.name.startsWith("NEBOSH"));
    assert.ok(nebosh);
    assert.equal(nebosh.name, "NEBOSH IGC");
    // A baked-in spec revision (IG 2018 / GIC 2025) would date the CV.
    assert.equal(/\b(19|20)\d{2}\b/.test(nebosh.name), false);
  });
});

// --- Data hygiene -----------------------------------------------------------

describe("bank hygiene", () => {
  const all = allDomainSkills();

  test("no entry collides with one of its own aliases", () => {
    for (const e of all) {
      const lower = (e.aliases ?? []).map((a) => a.toLowerCase().trim());
      assert.equal(
        lower.includes(e.name.toLowerCase().trim()),
        false,
        `${e.name} lists its own name as an alias`,
      );
      assert.equal(new Set(lower).size, lower.length, `${e.name} has duplicate aliases`);
    }
  });

  test("every entry has a name and a tier", () => {
    for (const e of all as DomainSkill[]) {
      assert.ok(e.name.trim().length > 0);
      assert.ok(e.tier === "must" || e.tier === "nice", `${e.name} has tier ${e.tier}`);
    }
  });

  test("names are chip-sized (long labels wrap badly and read as sentences)", () => {
    for (const e of all) {
      assert.ok(e.name.length <= 40, `"${e.name}" is ${e.name.length} chars`);
    }
  });

  test("no duplicate canonical name within a single domain", () => {
    const families = [
      "sales", "marketing", "finance", "accounting", "operations", "logistics",
      "hr", "admin", "engineering", "it", "hospitality", "retail", "realestate",
      "healthcare", "education", "customerservice",
    ] as const;
    for (const f of families) {
      const names = domainSkillEntries(f, [], 100).map((e) => e.name.toLowerCase());
      assert.equal(new Set(names).size, names.length, `${f} has a duplicate entry`);
    }
  });
});
