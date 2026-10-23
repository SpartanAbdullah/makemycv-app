/**
 * Tests for the cover-letter payload (lib/coverLetter/payload.ts).
 *
 * The contract being pinned: only an EXCERPT of the CV leaves the browser
 * (no contact details, no photo, no education), limits are enforced on both
 * sides, and a CV with nothing to say is rejected before any AI call.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  COVER_LETTER_LIMITS,
  buildCoverLetterRequest,
  buildCvExcerpt,
  parseCoverLetterRequest,
} from "./payload";
import type { CvData } from "../types/cv";

const cv: CvData = {
  personal: {
    firstName: "Test",
    lastName: "Candidate",
    headline: "Operations Manager",
    email: "secret@example.com",
    phone: "+971 50 000 0000",
    location: "Dubai",
    website: "",
    linkedin: "",
    summary: "Operations manager with eight years in UAE logistics.",
    visaStatus: "Employment visa",
    availability: "30 days notice",
    photo: "data:image/png;base64,AAAA",
  },
  experience: [
    { id: "a", company: "", role: "", location: "", startDate: "", endDate: "", isCurrent: false, bullets: [""] },
    { id: "b", company: "Example LLC", role: "Operations Manager", location: "Dubai", startDate: "Jan 2021", endDate: "", isCurrent: true, bullets: ["One", "Two", "Three", "Four", "Five", ""] },
  ],
  education: [{ id: "e", school: "Uni", degree: "BBA", field: "", startDate: "2012", endDate: "2016" }],
  skills: Array.from({ length: 15 }, (_, i) => ({ id: String(i), name: `Skill ${i}` })),
  languages: [],
  certifications: [],
  projects: [],
  settings: { templateId: "classic", accentColor: "#000", fontScale: 1, fontFamily: "sans", sectionOrder: [], photoShape: "round" },
};

describe("buildCvExcerpt", () => {
  test("skips the blank stub role and caps bullets and skills", () => {
    const x = buildCvExcerpt(cv);
    assert.equal(x.latestRole?.company, "Example LLC");
    assert.equal(x.latestRole?.period, "Jan 2021 – Present");
    assert.equal(x.latestRole?.bullets.length, COVER_LETTER_LIMITS.bullets);
    assert.equal(x.skills.length, COVER_LETTER_LIMITS.skills);
  });
  test("never includes contact details or the photo", () => {
    const json = JSON.stringify(buildCvExcerpt(cv));
    assert.equal(json.includes("secret@example.com"), false);
    assert.equal(json.includes("+971"), false);
    assert.equal(json.includes("base64"), false);
    assert.equal(json.includes("Candidate"), false); // last name not needed either
  });
});

describe("buildCoverLetterRequest / parseCoverLetterRequest", () => {
  test("round-trips through the server parser with limits enforced", () => {
    const req = buildCoverLetterRequest(cv, {
      company: " Gulf Trading Co ",
      jobTitle: "Operations Manager",
      hiringManager: "Ms. Ali",
      jobText: "x".repeat(10_000),
    });
    assert.equal(req.company, "Gulf Trading Co");
    assert.equal(req.jobText.length, COVER_LETTER_LIMITS.jobTextChars);
    const parsed = parseCoverLetterRequest(JSON.parse(JSON.stringify(req)));
    assert.ok(parsed);
    assert.equal(parsed.cv.latestRole?.title, "Operations Manager");
    assert.equal(parsed.hiringManager, "Ms. Ali");
  });
  test("rejects missing company/title and an empty CV", () => {
    assert.equal(parseCoverLetterRequest({ company: "", jobTitle: "x", cv: {} }), null);
    assert.equal(parseCoverLetterRequest({ company: "A", jobTitle: "x", cv: { skills: [] } }), null);
    assert.equal(parseCoverLetterRequest("nope"), null);
  });
  test("ignores non-string junk in arrays", () => {
    const parsed = parseCoverLetterRequest({ company: "A", jobTitle: "B", cv: { skills: ["ok", 5, null, "also"] } });
    assert.deepEqual(parsed?.cv.skills, ["ok", "also"]);
  });
});
