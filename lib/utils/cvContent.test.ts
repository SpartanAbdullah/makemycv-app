/**
 * Tests for the questions the import screens ask of the CV
 * (lib/utils/cvContent.ts).
 *
 * An automated review of PR #45 (2026-11-21) found three ways an import could
 * still lose something a person had entered:
 *   1. the "is there a CV here?" test ignored contact details, languages, the
 *      UAE details and the photo, so a CV holding only those was replaced by
 *      default, with the choice hidden and no Undo offered;
 *   2. Merge dropped a job or education card that had only dates, a location
 *      or a note typed into it;
 *   3. the import's Undo stayed on offer after later edits and threw them
 *      away. (The store half of that is tested in applyImportedCv.test.ts.)
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { defaultCvData } from "../store/cvStore";
import type { CvData } from "../types/cv";
import {
  hasTypedContent,
  hasUserEnteredData,
  isCvEmpty,
  sameCvContent,
  sameSectionContent,
} from "./cvContent";

const withPersonal = (extra: Partial<CvData["personal"]>): CvData => ({
  ...defaultCvData,
  personal: { ...defaultCvData.personal, ...extra },
});

describe("hasUserEnteredData (may this CV be replaced without asking?)", () => {
  test("a fresh builder has nothing to lose", () => {
    assert.equal(hasUserEnteredData(defaultCvData), false);
  });

  test("blank and whitespace-only values are not data", () => {
    assert.equal(hasUserEnteredData(withPersonal({ email: "   ", phone: "", nationality: undefined })), false);
  });

  test("a single contact detail is enough", () => {
    for (const extra of [
      { email: "sara@example.com" },
      { phone: "+971 50 000 0000" },
      { location: "Dubai" },
      { linkedin: "linkedin.com/in/sara" },
      { website: "sara.example" },
    ]) {
      assert.equal(hasUserEnteredData(withPersonal(extra)), true, JSON.stringify(extra));
      // …although there is still nothing for JD Match to match against.
      assert.equal(isCvEmpty(withPersonal(extra)), true, JSON.stringify(extra));
    }
  });

  test("the UAE details and the photo count", () => {
    for (const extra of [
      { visaStatus: "Residence visa" },
      { availability: "Immediate" },
      { drivingLicense: "UAE (Light vehicle)" },
      { nationality: "Pakistani" },
      { dateOfBirth: "15/03/1990" },
      { country: "UAE" },
      { photo: "data:image/png;base64,AAAA" },
    ] as Array<Partial<CvData["personal"]>>) {
      assert.equal(hasUserEnteredData(withPersonal(extra)), true, JSON.stringify(extra));
    }
  });

  test("the photo switch on its own is not data", () => {
    assert.equal(hasUserEnteredData(withPersonal({ showPhoto: true })), false);
  });

  test("a language counts", () => {
    const cv = { ...defaultCvData, languages: [{ id: "l1", name: "Arabic" }] } as CvData;
    assert.equal(hasUserEnteredData(cv), true);
    assert.equal(isCvEmpty(cv), true);
  });

  test("a job card with only dates or a location counts", () => {
    const blank = defaultCvData.experience[0];
    for (const patch of [{ startDate: "2021" }, { endDate: "2023" }, { location: "Sharjah" }]) {
      const cv = { ...defaultCvData, experience: [{ ...blank, ...patch }] };
      assert.equal(hasUserEnteredData(cv), true, JSON.stringify(patch));
    }
  });

  test("an education card with only dates or notes counts", () => {
    const blank = defaultCvData.education[0];
    for (const patch of [{ startDate: "2014" }, { endDate: "2018" }, { notes: "First class" }]) {
      const cv = { ...defaultCvData, education: [{ ...blank, ...patch }] };
      assert.equal(hasUserEnteredData(cv), true, JSON.stringify(patch));
    }
  });

  test("a ticked box on an otherwise empty card is not data", () => {
    const cv = {
      ...defaultCvData,
      experience: [{ ...defaultCvData.experience[0], isCurrent: true }],
    };
    assert.equal(hasUserEnteredData(cv), false);
  });

  test("design settings are not data — an import keeps them either way", () => {
    const cv = { ...defaultCvData, settings: { ...defaultCvData.settings, templateId: "onyx" } };
    assert.equal(hasUserEnteredData(cv), false);
  });
});

describe("hasTypedContent", () => {
  test("ignores generated ids, booleans and blank strings", () => {
    assert.equal(hasTypedContent({ id: "abc-123", name: "", on: true, list: ["", "  "] }), false);
    assert.equal(hasTypedContent(defaultCvData.experience[0]), false);
    assert.equal(hasTypedContent(defaultCvData.education[0]), false);
    assert.equal(hasTypedContent(null), false);
    assert.equal(hasTypedContent(undefined), false);
  });

  test("finds text at any depth", () => {
    assert.equal(hasTypedContent({ id: "x", bullets: ["", "Led a team"] }), true);
    assert.equal(hasTypedContent([{ id: "x", nested: { deeper: [" a "] } }]), true);
  });

  test("covers a field nobody has listed", () => {
    // The point of being generic: a field added to a CV type later counts.
    assert.equal(hasTypedContent({ ...defaultCvData.personal, somethingNew: "typed" }), true);
  });
});

describe("sameCvContent (a real edit, or a form writing back what it was given?)", () => {
  const role = {
    id: "e1",
    company: "Al Noor Trading",
    role: "Sales Executive",
    location: "",
    startDate: "2022",
    endDate: "",
    isCurrent: false,
    bullets: ["Managed 40 retail accounts", ""],
  };

  test("the same values are the same, whatever the key order", () => {
    const shuffled = Object.fromEntries(Object.entries(role).reverse());
    assert.equal(sameCvContent(role, shuffled), true);
  });

  test("an absent field, an empty one and false are the same", () => {
    const sparse = { id: "e1", company: "Al Noor Trading", role: "Sales Executive", startDate: "2022", bullets: ["Managed 40 retail accounts"] };
    assert.equal(sameCvContent(role, sparse), true);
    assert.equal(sameCvContent({ a: undefined, b: null, c: "", d: false, e: [] }, {}), true);
  });

  test("padding spaces are not an edit", () => {
    assert.equal(sameCvContent({ name: " Sara " }, { name: "Sara" }), true);
  });

  test("a typed character is an edit", () => {
    assert.equal(sameCvContent(role, { ...role, role: "Sales Executives" }), false);
    assert.equal(sameCvContent(role, { ...role, location: "Dubai" }), false);
    assert.equal(sameCvContent(role, { ...role, isCurrent: true }), false);
    assert.equal(sameCvContent(role, { ...role, bullets: ["Managed 40 retail accounts", "Grew sales"] }), false);
    assert.equal(sameCvContent([role], [role, { ...role, id: "e2" }]), false);
  });

  test("reordering a list is an edit", () => {
    assert.equal(sameCvContent(["a", "b"], ["b", "a"]), false);
  });

  test("a different template is an edit", () => {
    const s = defaultCvData.settings;
    assert.equal(sameCvContent(s, { ...s }), true);
    assert.equal(sameCvContent(s, { ...s, templateId: "onyx" }), false);
  });
});

describe("sameSectionContent (what the store's updateSection compares)", () => {
  const s = defaultCvData.settings;

  test("the job field the app guesses from the headline is not an edit", () => {
    // PersonalStep.maybeInferDomain writes this when the headline box loses
    // focus. Nobody typed anything.
    assert.equal(sameSectionContent("settings", s, { ...s, domain: "sales", domainSource: "inferred" }), true);
    assert.equal(
      sameSectionContent(
        "settings",
        { ...s, domain: "sales", domainSource: "inferred" },
        { ...s, domain: undefined, domainSource: "inferred" },
      ),
      true,
    );
  });

  test("a job field the user picked is an edit", () => {
    assert.equal(sameSectionContent("settings", s, { ...s, domain: "sales", domainSource: "user" }), false);
    assert.equal(
      sameSectionContent(
        "settings",
        { ...s, domain: "sales", domainSource: "inferred" },
        { ...s, domain: "finance", domainSource: "user" },
      ),
      false,
    );
  });

  test("every other settings change is an edit, guessed field or not", () => {
    assert.equal(
      sameSectionContent("settings", s, { ...s, templateId: "onyx", domain: "sales", domainSource: "inferred" }),
      false,
    );
    assert.equal(sameSectionContent("settings", s, { ...s, accentColor: "#000000" }), false);
  });

  test("other sections are compared whole", () => {
    assert.equal(
      sameSectionContent("personal", defaultCvData.personal, { ...defaultCvData.personal, headline: "Accountant" }),
      false,
    );
    // a key that happens to be called `domain` elsewhere is not special
    assert.equal(sameSectionContent("personal", { domain: "a" }, { domain: "b" }), false);
  });
});

describe("the import screens ask the right question (source contract)", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

  test("none of them decides with isCvEmpty", () => {
    for (const file of [
      ["components", "import", "MappingReview.tsx"],
      ["components", "builder", "ImportFromReportBanner.tsx"],
      ["components", "builder", "BuilderShell.tsx"],
    ]) {
      const src = read(...file);
      assert.match(src, /hasUserEnteredData\(/, `${file.join("/")} must use hasUserEnteredData`);
      assert.doesNotMatch(src, /isCvEmpty/, `${file.join("/")} must not use isCvEmpty`);
    }
  });

  test("JD Match still asks whether there is anything to match", () => {
    assert.match(read("components", "jdmatch", "JdMatchPanel.tsx"), /isCvEmpty\(/);
  });
});
