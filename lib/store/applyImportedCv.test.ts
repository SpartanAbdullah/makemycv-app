/**
 * Tests for what an import does to the CV (applyImportedCv in
 * lib/store/cvStore.ts) and for undoing it.
 *
 * The 2026-11 audit found two ways an import lost data without saying so:
 * "Merge" discarded every imported UAE detail on a CV whose UAE step had
 * never been opened (O4), and "Replace" — the default — overwrote the whole
 * CV with no way back (O3).
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { applyImportedCv, defaultCvData, useCvStore } from "./cvStore";
import { isCvEmpty } from "../utils/cvContent";
import type { CvData } from "../types/cv";

const typed = (): CvData => ({
  ...defaultCvData,
  personal: {
    ...defaultCvData.personal,
    firstName: "Sara",
    lastName: "Khan",
    email: "sara@example.com",
  },
  experience: [
    {
      id: "e1",
      company: "Al Noor Trading",
      role: "Sales Executive",
      location: "Dubai, UAE",
      startDate: "2022",
      endDate: "",
      isCurrent: true,
      bullets: ["Managed 40 retail accounts"],
    },
  ],
  skills: [{ id: "s1", name: "Negotiation" }],
  languages: [{ id: "l1", name: "English", level: "professional" }],
  certifications: [{ id: "c1", name: "PMP", issuer: "PMI" }],
});

const imported = (): Partial<CvData> => ({
  personal: {
    firstName: "Sarah",
    lastName: "",
    headline: "Senior Sales Executive",
    email: "other@example.com",
    phone: "+971 50 000 0000",
    location: "",
    website: "",
    linkedin: "",
    summary: "",
    nationality: "Pakistani",
    visaStatus: "Employment visa",
    availability: "30 days notice",
    drivingLicense: "Light Vehicle",
    dateOfBirth: "15/03/1990",
  },
  experience: [
    {
      id: "e2",
      company: "Gulf Retail",
      role: "Sales Associate",
      location: "Sharjah, UAE",
      startDate: "2019",
      endDate: "2022",
      isCurrent: false,
      bullets: ["Served 60 customers a day"],
    },
  ],
  education: [
    { id: "d1", school: "University of Karachi", degree: "BBA", field: "", startDate: "2014", endDate: "2018" },
  ],
  skills: [
    { id: "s2", name: "negotiation" },
    { id: "s3", name: "CRM" },
  ],
  languages: [
    { id: "l2", name: "ENGLISH", level: "native" },
    { id: "l3", name: "Urdu", level: "native" },
  ],
  certifications: [
    { id: "c2", name: "pmp", issuer: "PMI" },
    { id: "c3", name: "CIPS", issuer: "CIPS" },
  ],
});

describe("applyImportedCv — merge", () => {
  test("fills UAE details that were never set on the CV (audit O4)", () => {
    const current = typed();
    // The premise of the bug: these keys do not exist on a hand-typed CV.
    assert.equal("visaStatus" in current.personal, false);

    const out = applyImportedCv(current, imported(), "merge");
    assert.equal(out.personal.nationality, "Pakistani");
    assert.equal(out.personal.visaStatus, "Employment visa");
    assert.equal(out.personal.availability, "30 days notice");
    assert.equal(out.personal.drivingLicense, "Light Vehicle");
    assert.equal(out.personal.dateOfBirth, "15/03/1990");
  });

  test("fills blank details and never overwrites one the user typed", () => {
    const out = applyImportedCv(typed(), imported(), "merge");
    assert.equal(out.personal.firstName, "Sara", "typed name kept");
    assert.equal(out.personal.email, "sara@example.com", "typed email kept");
    assert.equal(out.personal.headline, "Senior Sales Executive", "blank headline filled");
    assert.equal(out.personal.phone, "+971 50 000 0000", "blank phone filled");
    assert.equal(out.personal.lastName, "Khan", "a blank import value fills nothing");
  });

  test("treats a whitespace-only field as empty", () => {
    const current = typed();
    current.personal.headline = "   ";
    assert.equal(
      applyImportedCv(current, imported(), "merge").personal.headline,
      "Senior Sales Executive",
    );
  });

  test("keeps the user's entries and appends the imported ones", () => {
    const out = applyImportedCv(typed(), imported(), "merge");
    assert.deepEqual(out.experience.map((e) => e.id), ["e1", "e2"]);
  });

  test("drops the seeded blank cards instead of leaving them above the import", () => {
    // typed() still carries defaultCvData's blank education card.
    const out = applyImportedCv(typed(), imported(), "merge");
    assert.deepEqual(out.education.map((e) => e.id), ["d1"]);
  });

  test("does not add a skill, language or certification already held by name", () => {
    const out = applyImportedCv(typed(), imported(), "merge");
    assert.deepEqual(out.skills.map((s) => s.name), ["Negotiation", "CRM"]);
    assert.deepEqual(out.languages.map((l) => l.name), ["English", "Urdu"]);
    assert.equal(out.languages[0].level, "professional", "the user's own level is kept");
    assert.deepEqual(out.certifications.map((c) => c.name), ["PMP", "CIPS"]);
  });

  test("merging the same file twice does not double the lists", () => {
    const once = applyImportedCv(typed(), imported(), "merge");
    const twice = applyImportedCv(once, imported(), "merge");
    assert.deepEqual(twice.skills, once.skills);
    assert.deepEqual(twice.languages, once.languages);
    assert.deepEqual(twice.certifications, once.certifications);
  });
});

describe("applyImportedCv — replace", () => {
  test("takes the imported document and keeps the user's template settings", () => {
    const current = typed();
    current.settings = { ...current.settings, templateId: "ats-clean", accentColor: "#123456" };
    const out = applyImportedCv(current, imported(), "replace");
    assert.equal(out.personal.firstName, "Sarah");
    assert.deepEqual(out.experience.map((e) => e.id), ["e2"]);
    assert.equal(out.settings.templateId, "ats-clean");
    assert.equal(out.settings.accentColor, "#123456");
  });

  test("does not carry the previous photo into the imported document", () => {
    const current = typed();
    current.personal.photo = "data:image/jpeg;base64,AAAA";
    current.personal.showPhoto = true;
    const out = applyImportedCv(current, imported(), "replace");
    assert.equal(out.personal.photo, undefined);
  });
});

describe("isCvEmpty (decides the import review's default)", () => {
  test("a fresh builder is empty; a CV with anything typed is not", () => {
    assert.equal(isCvEmpty(defaultCvData), true);
    assert.equal(isCvEmpty(typed()), false);
    assert.equal(
      isCvEmpty({ ...defaultCvData, skills: [{ id: "s", name: "Excel" }] }),
      false,
    );
  });
});

describe("import undo (store)", () => {
  test("undoImport puts back the CV an import replaced", () => {
    const before = typed();
    useCvStore.setState({ data: before, parseSignals: null, scoreBaseline: null, importUndo: null });

    useCvStore.getState().importCvVersion(imported(), "replace");
    assert.equal(useCvStore.getState().data.personal.firstName, "Sarah");
    assert.deepEqual(useCvStore.getState().importUndo?.data, before);

    assert.equal(useCvStore.getState().undoImport(), true);
    assert.deepEqual(useCvStore.getState().data, before);
    assert.equal(useCvStore.getState().importUndo, null);
  });

  test("undoImport restores the score baseline and parse signals too", () => {
    const baseline = { total: 71, grade: "good" as const, capturedAt: 1, rubric: 3 };
    useCvStore.setState({ data: typed(), parseSignals: null, scoreBaseline: baseline, importUndo: null });

    useCvStore.getState().importCvVersion(imported(), "merge");
    // What the import flows do next: new signals, then a fresh baseline.
    useCvStore.setState({ scoreBaseline: { ...baseline, total: 40 } });

    useCvStore.getState().undoImport();
    assert.deepEqual(useCvStore.getState().scoreBaseline, baseline);
    assert.equal(useCvStore.getState().parseSignals, null);
  });

  test("there is nothing to undo before any import, or after reset", () => {
    useCvStore.setState({ importUndo: null });
    assert.equal(useCvStore.getState().undoImport(), false);

    useCvStore.setState({ data: typed() });
    useCvStore.getState().importCvVersion(imported(), "replace");
    useCvStore.getState().reset();
    assert.equal(useCvStore.getState().undoImport(), false);
  });
});
