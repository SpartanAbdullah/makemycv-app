/**
 * Tests for the LinkedIn message payload (lib/linkedinMessage/payload.ts).
 *
 * The contract being pinned: only a SMALL EXCERPT of the CV leaves the
 * browser (no name, no contact details, no photo, no summary, no education),
 * the pasted job text is required and capped, limits are enforced on both
 * sides, and a CV with nothing to say is rejected before any AI call.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  LINKEDIN_MESSAGE_LIMITS,
  buildLinkedinCvExcerpt,
  buildLinkedinMessageRequest,
  jobTextIsUsable,
  parseLinkedinMessageRequest,
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
    linkedin: "linkedin.com/in/secret-handle",
    summary: "A summary that should not travel for a LinkedIn message.",
    visaStatus: "Employment visa",
    availability: "30 days notice",
    photo: "data:image/png;base64,AAAA",
  },
  experience: [
    { id: "a", company: "", role: "", location: "", startDate: "", endDate: "", isCurrent: false, bullets: [""] },
    { id: "b", company: "Example LLC", role: "Operations Manager", location: "Dubai", startDate: "Jan 2021", endDate: "", isCurrent: true, bullets: ["One", "Two", "Three", ""] },
  ],
  education: [{ id: "e", school: "Uni", degree: "BBA", field: "", startDate: "2012", endDate: "2016" }],
  skills: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Skill ${i}` })),
  languages: [],
  certifications: [],
  projects: [],
  settings: { templateId: "classic", accentColor: "#000", fontScale: 1, fontFamily: "sans", sectionOrder: [], photoShape: "round" },
};

const JOB = "Hi, I'm hiring an Operations Manager for a logistics firm in Jebel Ali. Are you open to a chat this week?";

describe("buildLinkedinCvExcerpt", () => {
  test("skips the blank stub role and caps bullets and skills", () => {
    const x = buildLinkedinCvExcerpt(cv);
    assert.equal(x.latestRole?.company, "Example LLC");
    assert.equal(x.latestRole?.bullets.length, LINKEDIN_MESSAGE_LIMITS.bullets);
    assert.deepEqual(x.latestRole?.bullets, ["One", "Two"]);
    assert.equal(x.skills.length, LINKEDIN_MESSAGE_LIMITS.skills);
    assert.equal(x.visaStatus, "Employment visa");
    assert.equal(x.availability, "30 days notice");
  });
  test("never includes name, contact details, LinkedIn handle, summary, dates or the photo", () => {
    const x = buildLinkedinCvExcerpt(cv);
    const json = JSON.stringify(x);
    assert.equal(json.includes("secret@example.com"), false);
    assert.equal(json.includes("+971"), false);
    assert.equal(json.includes("base64"), false);
    assert.equal(json.includes("secret-handle"), false);
    assert.equal(json.includes("Candidate"), false);
    assert.equal(json.includes("Test"), false);
    assert.equal(json.includes("should not travel"), false);
    assert.equal(json.includes("Jan 2021"), false);
    assert.equal(json.includes("BBA"), false);
    // Exactly these keys and nothing more — the disclosure copy lists them.
    assert.deepEqual(Object.keys(x).sort(), ["availability", "headline", "latestRole", "skills", "visaStatus"]);
    assert.deepEqual(Object.keys(x.latestRole ?? {}).sort(), ["bullets", "company", "title"]);
  });
});

describe("buildLinkedinMessageRequest / parseLinkedinMessageRequest", () => {
  test("round-trips through the server parser with limits enforced", () => {
    const req = buildLinkedinMessageRequest(cv, { jobText: JOB + " " + "x".repeat(10_000), variant: "connection_note" });
    assert.equal(req.jobText.length, LINKEDIN_MESSAGE_LIMITS.jobTextChars);
    assert.equal(req.variant, "connection_note");
    const parsed = parseLinkedinMessageRequest(JSON.parse(JSON.stringify(req)));
    assert.ok(parsed);
    assert.equal(parsed.cv.latestRole?.title, "Operations Manager");
    assert.equal(parsed.variant, "connection_note");
  });
  test("defaults an unknown variant to the message", () => {
    const parsed = parseLinkedinMessageRequest({ jobText: JOB, variant: "poem", cv: { headline: "x" } });
    assert.equal(parsed?.variant, "message");
  });
  test("rejects missing or too-short job text and an empty CV", () => {
    assert.equal(jobTextIsUsable("Sales role"), false);
    assert.equal(parseLinkedinMessageRequest({ jobText: "", cv: { headline: "x" } }), null);
    assert.equal(parseLinkedinMessageRequest({ jobText: "Sales role", cv: { headline: "x" } }), null);
    assert.equal(parseLinkedinMessageRequest({ jobText: JOB, cv: { skills: [] } }), null);
    assert.equal(parseLinkedinMessageRequest({ jobText: JOB }), null);
    assert.equal(parseLinkedinMessageRequest("nope"), null);
    assert.equal(parseLinkedinMessageRequest(null), null);
  });
  test("server re-clips oversized client payloads and ignores junk", () => {
    const parsed = parseLinkedinMessageRequest({
      jobText: JOB,
      cv: {
        headline: "h".repeat(500),
        latestRole: { title: "T", company: "C", bullets: ["a", 5, null, "b", "c", "d"] },
        skills: ["ok", 5, null, "also", "third", "fourth"],
        visaStatus: 42,
      },
    });
    assert.ok(parsed);
    assert.equal(parsed.cv.headline.length, LINKEDIN_MESSAGE_LIMITS.headline);
    assert.deepEqual(parsed.cv.latestRole?.bullets, ["a", "b"]);
    assert.deepEqual(parsed.cv.skills, ["ok", "also", "third"]);
    assert.equal(parsed.cv.visaStatus, "");
  });
});
