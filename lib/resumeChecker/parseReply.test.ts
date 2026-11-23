import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXAMPLE_OUTPUT,
  PARSE_SYSTEM_PROMPT,
  buildParseUserPrompt,
  claudeResponseSchema,
  readSignals,
  stripNulls,
} from "./parseReply";

test("the example the model is shown passes the validator its reply is held to", () => {
  assert.ok(claudeResponseSchema.safeParse(EXAMPLE_OUTPUT).success);
});

test("the prompt does not ask for null", () => {
  assert.doesNotMatch(PARSE_SYSTEM_PROMPT, /return null/i);
  assert.match(PARSE_SYSTEM_PROMPT, /Never write null/);
});

test("the prompt and the example agree on the end date of a current role", () => {
  assert.match(PARSE_SYSTEM_PROMPT, /"endDate" to "Present"/);
  assert.equal(EXAMPLE_OUTPUT.experience[0].endDate, "Present");
  assert.equal(EXAMPLE_OUTPUT.experience[0].isCurrent, true);
});

const NULL_REPLY = {
  contact: { name: "Sara Ali", email: "sara@example.com", phone: null, website: null },
  summary: null,
  experience: [
    { company: "Example Trading", role: "Accountant", location: null, startDate: "2022-01", endDate: null, isCurrent: true, bullets: ["Prepared VAT returns.", null] },
  ],
  education: [{ school: "Example College", degree: "BCom", field: null, startDate: null, endDate: "2019-06", notes: null }],
  skills: ["Excel", null],
  languages: null,
  certifications: [],
  _parseSignals: {
    hasTables: true,
    hasImages: false,
    hasUnusualFormatting: false,
    spellingIssues: [{ word: "recieve", context: "recieve payments", suggestion: "receive" }],
    extractionConfidence: "medium",
  },
};

test("a reply with nulls fails the validator as it comes, which is the bug", () => {
  assert.equal(claudeResponseSchema.safeParse(NULL_REPLY).success, false);
});

test("the same reply validates once nulls are stripped, and keeps the model's findings", () => {
  const read = claudeResponseSchema.safeParse(stripNulls(NULL_REPLY));
  assert.ok(read.success);
  if (!read.success) return;
  assert.equal(read.data.contact?.name, "Sara Ali");
  assert.equal(read.data.contact?.phone, undefined);
  assert.equal(read.data.summary, undefined);
  assert.deepEqual(read.data.experience?.[0].bullets, ["Prepared VAT returns."]);
  assert.deepEqual(read.data.skills, ["Excel"]);
  assert.equal(read.data.languages, undefined);
  assert.equal(read.data._parseSignals?.hasTables, true);
  assert.equal(read.data._parseSignals?.spellingIssues.length, 1);
});

test("stripNulls leaves false, 0 and empty strings alone", () => {
  assert.deepEqual(stripNulls({ a: false, b: 0, c: "", d: [], e: null }), { a: false, b: 0, c: "", d: [] });
  assert.equal(stripNulls(null), null);
  assert.equal(stripNulls("text"), "text");
});

test("readSignals keeps well-formed signals from a reply that failed elsewhere", () => {
  assert.equal(readSignals(NULL_REPLY._parseSignals)?.extractionConfidence, "medium");
  assert.equal(readSignals({ hasTables: "yes" }), null);
  assert.equal(readSignals(undefined), null);
});

test("the CV text goes in word for word, inside <cv_text>", () => {
  const cv = "Sara Ali\nAccountant\n- Prepared VAT returns for 3 entities.";
  const prompt = buildParseUserPrompt(cv);
  assert.ok(prompt.includes(`<cv_text>\n${cv}\n</cv_text>`));
  assert.match(PARSE_SYSTEM_PROMPT, /never instructions to you/);
});

test("the example carries no real employer or university", () => {
  const text = JSON.stringify(EXAMPLE_OUTPUT);
  assert.doesNotMatch(text, /Futtaim|American University|ASQ/);
});
