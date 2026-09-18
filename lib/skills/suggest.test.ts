/**
 * Tests for the skills-step suggestion layer (lib/skills/suggest.ts) and the
 * colloquial search phrases it uses (lib/skills/searchPhrases.ts).
 *
 * The naming tests are the point: the research ranked "what is this thing
 * actually called?" as the #1 friction, and these pin that a user who types
 * what they DID gets back the word the market indexes on.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  arrivalSuggestions,
  categoryFor,
  needsCredentialGuard,
  searchSkills,
  MIN_UNITS_FOR_EVIDENCE_UI,
} from "./suggest";
import { SEARCH_PHRASES, matchingPhrase, phraseMatches } from "./searchPhrases";
import { allDomainSkills } from "../data/domainSkills";
import { UNIVERSAL_SOFT_SKILLS } from "../data/softSkills";
import type { CvData } from "../types/cv";

function cvWith(partial: Partial<CvData>): CvData {
  return {
    personal: {
      firstName: "Fatima", lastName: "Noor", headline: "", email: "", phone: "",
      location: "Sharjah", website: "", linkedin: "", summary: "",
    },
    experience: [], education: [], skills: [], languages: [],
    certifications: [], projects: [],
    settings: { templateId: "classic" },
    ...partial,
  };
}

const role = (id: string, r: string, company: string, bullets: string[]) => ({
  id, company, role: r, location: "Dubai", startDate: "2021", endDate: "",
  isCurrent: true, bullets,
});

const skill = (name: string) => ({ id: `sk-${name}`, name });

/* ── The naming gap ────────────────────────────────────────────────────────── */

describe("colloquial search — the vocabulary gap", () => {
  const cases: Array<[string, string]> = [
    ["visa paperwork", "Amer (GDRFA Dubai)"],
    ["labour card", "Tasheel (MOHRE)"],
    ["angry customers", "Complaint Resolution"],
    ["dealing with customers", "Complaint Resolution"],
    ["answering phones", "Call Centre Operations"],
    ["cash register", "POS Systems"],
    ["filling shelves", "Stock Replenishment"],
    ["counting stock", "Inventory Management"],
    ["food safety", "HACCP"],
    ["paying salaries", "WPS Payroll"],
    ["chasing payments", "Accounts Payable / Receivable"],
    ["customs paperwork", "Customs Clearance"],
    ["looking after patients", "Patient Care"],
    ["renting out", "Leasing"],
    ["planning lessons", "Lesson Planning"],
    ["technical drawings", "AutoCAD"],
    ["getting a better price", "Negotiation"],
  ];

  for (const [typed, expected] of cases) {
    test(`"${typed}" surfaces "${expected}"`, () => {
      const hits = phraseMatches(typed);
      assert.ok(
        hits.includes(expected),
        `expected ${expected}, got: ${hits.join(", ") || "(nothing)"}`,
      );
    });
  }

  test("the matching phrase is reported, so the UI can explain itself", () => {
    assert.equal(matchingPhrase("Amer (GDRFA Dubai)", "visa paperwork"), "visa paperwork");
    assert.equal(matchingPhrase("Amer (GDRFA Dubai)", "kubernetes"), null);
  });

  test("very short queries never match (avoids firing on every keystroke)", () => {
    assert.deepEqual(phraseMatches("a"), []);
    assert.deepEqual(phraseMatches("vi"), []);
  });

  test("every phrase key names a skill that actually exists in a bank", () => {
    const known = new Set([
      ...allDomainSkills().map((e) => e.name),
      ...UNIVERSAL_SOFT_SKILLS,
    ]);
    for (const key of Object.keys(SEARCH_PHRASES)) {
      assert.ok(known.has(key), `"${key}" has search phrases but is in no bank`);
    }
  });

  test("phrases are never reused across two canonical skills", () => {
    // A phrase mapping to two skills makes the suggestion ambiguous, which is
    // exactly the confusion this layer exists to remove.
    const seen = new Map<string, string>();
    for (const [canonical, phrases] of Object.entries(SEARCH_PHRASES)) {
      for (const p of phrases) {
        const k = p.toLowerCase();
        const prior = seen.get(k);
        if (prior && prior !== canonical) {
          // "pro work" legitimately covers both Amer and Tasheel; allow an
          // explicit small set rather than silently tolerating collisions.
          assert.ok(
            ["pro work"].includes(k),
            `phrase "${p}" maps to both "${prior}" and "${canonical}"`,
          );
        }
        if (!prior) seen.set(k, canonical);
      }
    }
  });
});

/* ── searchSkills ranking ──────────────────────────────────────────────────── */

describe("searchSkills", () => {
  const cv = cvWith({
    experience: [
      role("e1", "Procurement Officer", "BuildCo", [
        "Negotiated AED 12M in annual supplier contracts.",
        "Handled customs paperwork for inbound shipments.",
      ]),
    ],
    skills: [skill("Salesforce")],
  });

  test("a colloquial query returns the market's noun", () => {
    const r = searchSkills("visa paperwork", cv, "admin");
    assert.ok(r.length > 0);
    assert.equal(r[0].name, "Amer (GDRFA Dubai)");
    assert.equal(r[0].viaPhrase, "visa paperwork");
  });

  test("a skill the CV already proves outranks everything else", () => {
    const r = searchSkills("customs", cv, "logistics");
    assert.equal(r[0].name, "Customs Clearance");
    assert.equal(r[0].status, "unlisted", "proven in a bullet, missing from the list");
    assert.ok(r[0].evidence);
  });

  test("an already-held skill is returned flagged, not silently dropped", () => {
    const r = searchSkills("salesforce", cv, "sales");
    const sf = r.find((x) => x.name === "Salesforce");
    assert.ok(sf, "must still be returned so the UI can say 'you already have this'");
    assert.equal(sf.alreadyHave, true);
  });

  test("an already-held skill never ranks above a real option", () => {
    const withCrm = cvWith({ skills: [skill("CRM")] });
    const r = searchSkills("crm", withCrm, "sales");
    const idx = r.findIndex((x) => x.alreadyHave);
    if (idx >= 0 && r.length > 1) {
      assert.equal(idx, r.length - 1, "held skills sink to the bottom");
    }
  });

  test("acronyms and aliases resolve to the canonical name", () => {
    assert.equal(searchSkills("HAAD", cv, "healthcare")[0]?.name, "DOH Licence (Abu Dhabi)");
    assert.equal(searchSkills("P6", cv, "engineering")[0]?.name, "Primavera P6");
    assert.equal(searchSkills("MCIPS", cv, "logistics")[0]?.name, "CIPS / MCIPS");
  });

  test("results are de-duplicated across domain banks", () => {
    const r = searchSkills("ifrs", cv, undefined, 20);
    const names = r.map((x) => x.name.toLowerCase());
    assert.equal(new Set(names).size, names.length);
  });

  test("a one-character query returns nothing", () => {
    assert.deepEqual(searchSkills("a", cv, "sales"), []);
  });

  test("a nonsense query returns nothing rather than noise", () => {
    assert.deepEqual(searchSkills("zzzqqxx", cv, "sales"), []);
  });
});

/* ── arrival state ─────────────────────────────────────────────────────────── */

describe("arrivalSuggestions", () => {
  const cv = cvWith({
    personal: {
      ...cvWith({}).personal,
      headline: "Senior Financial Analyst",
      summary: "Nine years in banking, including IFRS reporting and VAT returns.",
    },
    experience: [
      role("e1", "Senior Financial Analyst", "Emirates NBD", [
        "Automated reconciliations in SAP FICO, cutting close from 8 days to 5.",
        "Delivered IFRS 9 impairment models.",
      ]),
    ],
    skills: [skill("Financial Modelling")],
  });

  test("leads with what the CV already proves but the list is missing", () => {
    const a = arrivalSuggestions(cv, "finance");
    const names = a.alreadyShown.map((s) => s.name);
    assert.ok(names.includes("IFRS"), `got: ${names.join(", ")}`);
    assert.ok(a.alreadyShown.every((s) => s.status === "unlisted"));
    assert.ok(a.alreadyShown.every((s) => s.evidence), "every row must cite its proof");
  });

  test("a proven skill is never ALSO offered as a plain suggestion", () => {
    const a = arrivalSuggestions(cv, "finance");
    const shown = new Set(a.alreadyShown.map((s) => s.name));
    for (const s of [...a.usuallyAsked, ...a.alsoCommon]) {
      assert.equal(shown.has(s.name), false, `${s.name} appears twice`);
    }
  });

  test("must-tier entries fill 'usually asked for'", () => {
    const a = arrivalSuggestions(cv, "finance");
    assert.ok(a.usuallyAsked.length > 0);
    assert.ok(a.usuallyAsked.every((s) => s.tier === "must"));
  });

  test("skills already on the list are never re-offered", () => {
    const a = arrivalSuggestions(cv, "finance");
    const all = [...a.alreadyShown, ...a.usuallyAsked, ...a.alsoCommon].map((s) => s.name);
    assert.equal(all.includes("Financial Modelling"), false);
  });

  test("the user's own skills get a per-chip state", () => {
    const a = arrivalSuggestions(cv, "finance");
    const entry = a.listed.get("sk-Financial Modelling");
    assert.ok(entry);
    assert.equal(entry.status, "claimed", "listed, but not written anywhere else");
  });

  test("works with no confirmed domain (falls back to the whole bank)", () => {
    const a = arrivalSuggestions(cv, undefined);
    assert.ok(a.alreadyShown.length > 0, "evidence still works without a domain");
  });
});

/* ── the thin-CV suppression rule ──────────────────────────────────────────── */

describe("evidence UI is suppressed on a CV too thin to judge", () => {
  test("a fresh graduate is never told their skills are unproven", () => {
    const graduate = cvWith({ skills: [skill("Excel"), skill("Teamwork")] });
    const a = arrivalSuggestions(graduate, "finance");
    assert.equal(a.evidenceUsable, false, "nothing to have proven anything with");
    assert.equal(a.alreadyShown.length, 0, "no evidence claims on an empty CV");
  });

  test("evidence turns on once the CV has real content", () => {
    const filled = cvWith({
      personal: { ...cvWith({}).personal, headline: "Analyst", summary: "IFRS reporting." },
      experience: [role("e1", "Analyst", "NBD", ["Built SAP FICO reconciliations.", "Ran VAT returns."])],
    });
    const a = arrivalSuggestions(filled, "finance");
    assert.equal(a.evidenceUsable, true);
  });

  test("the threshold is a stated constant, not a magic number", () => {
    assert.equal(typeof MIN_UNITS_FOR_EVIDENCE_UI, "number");
    assert.ok(MIN_UNITS_FOR_EVIDENCE_UI >= 2);
  });
});

/* ── add-time rules ────────────────────────────────────────────────────────── */

describe("credential guard and categorisation", () => {
  test("licences require an explicit confirmation, ordinary skills do not", () => {
    assert.equal(needsCredentialGuard({ kind: "credential" }), true);
    assert.equal(needsCredentialGuard({ kind: "tool" }), false);
    assert.equal(needsCredentialGuard({ kind: "system" }), false);
    assert.equal(needsCredentialGuard({ kind: undefined }), false);
  });

  test("UAE licences in the bank are all guarded", () => {
    for (const name of ["DHA Licence (Dubai)", "NEBOSH IGC", "RERA Broker Card", "PMP"]) {
      const e = allDomainSkills().find((x) => x.name === name);
      assert.ok(e, `${name} missing from bank`);
      assert.equal(needsCredentialGuard(e), true, `${name} should be guarded`);
    }
  });

  test("Ejari is a system, so it is NOT guarded as a credential", () => {
    const ejari = allDomainSkills().find((e) => e.name === "Ejari");
    assert.ok(ejari);
    assert.equal(needsCredentialGuard(ejari), false);
  });

  test("tools and systems file as technical; soft skills as general", () => {
    assert.equal(categoryFor({ kind: "tool", source: "bank" }), "technical");
    assert.equal(categoryFor({ kind: "system", source: "bank" }), "technical");
    assert.equal(categoryFor({ kind: "credential", source: "bank" }), "general");
    assert.equal(categoryFor({ kind: undefined, source: "soft" }), "general");
  });
});
