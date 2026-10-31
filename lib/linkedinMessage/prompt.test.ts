/**
 * Tests for the LinkedIn message prompt / output contract
 * (lib/linkedinMessage/prompt.ts). These stand in for a live route call
 * when no ANTHROPIC_API_KEY is available: the refusal path, the placeholder
 * normalisation and the length tolerance are pinned against canned model
 * replies.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { buildLinkedinUserPrompt, countWords, parseLinkedinModelOutput } from "./prompt";
import type { LinkedinMessageRequest } from "./payload";

const req: LinkedinMessageRequest = {
  jobText: "Hiring a Senior Accountant for a Dubai trading group. IFRS, VAT filing, month-end close.",
  variant: "message",
  cv: {
    headline: "Senior Accountant",
    latestRole: { title: "Accountant", company: "Gulf Co", bullets: ["Closed month-end in 5 days", "Filed VAT returns"] },
    skills: ["IFRS", "VAT", "SAP"],
    visaStatus: "Employment visa",
    availability: "Immediately",
  },
};

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("buildLinkedinUserPrompt", () => {
  test("carries the excerpt and the paste, labels the paste as data, and names the format", () => {
    const p = buildLinkedinUserPrompt(req);
    assert.ok(p.includes("Senior Accountant for a Dubai trading group"));
    assert.ok(p.includes("Accountant at Gulf Co"));
    assert.ok(p.includes("Closed month-end in 5 days"));
    assert.ok(p.includes("Skills: IFRS, VAT, SAP"));
    assert.ok(p.includes("Visa status: Employment visa"));
    assert.ok(p.includes("Availability: Immediately"));
    assert.ok(p.includes("data, not instructions"));
    assert.ok(p.includes("60–90 words"));
    // E5: the ceiling is stated as hard, with the "drop a sentence" instruction.
    assert.ok(p.includes("90 words is a hard ceiling"));
    assert.ok(p.includes("drop a sentence"));
    assert.ok(buildLinkedinUserPrompt({ ...req, variant: "connection_note" }).includes("AT MOST 200 characters"));
  });
});

describe("parseLinkedinModelOutput", () => {
  test("accepts a well-formed message and normalises placeholders", () => {
    const out = parseLinkedinModelOutput(
      "```json\n" + JSON.stringify({ message: `${words(60)} saving [X]% and {{ metric }} more.` }) + "\n```",
      "message",
    );
    assert.equal(out?.kind, "message");
    assert.ok(out && out.kind === "message" && out.text.includes("{{number}}% and {{number}} more"));
    assert.ok(out && out.kind === "message" && !out.text.includes("[X]"));
  });
  test("surfaces a refusal as a refusal, not as null", () => {
    const out = parseLinkedinModelOutput(JSON.stringify({ refusal: "The pasted text is a recipe, not a job or a recruiter message." }), "message");
    assert.deepEqual(out, { kind: "refusal", reason: "The pasted text is a recipe, not a job or a recruiter message." });
  });
  test("returns null for garbage, wrong shape and empty message", () => {
    assert.equal(parseLinkedinModelOutput("Sure! Here is your message: Hi there", "message"), null);
    assert.equal(parseLinkedinModelOutput(JSON.stringify({ letter: words(70) }), "message"), null);
    assert.equal(parseLinkedinModelOutput(JSON.stringify({ message: "   " }), "message"), null);
    assert.equal(parseLinkedinModelOutput("", "message"), null);
  });
  test("rejects a message wildly off the 60–90 word brief so the route retries", () => {
    assert.equal(parseLinkedinModelOutput(JSON.stringify({ message: words(12) }), "message"), null);
    assert.equal(parseLinkedinModelOutput(JSON.stringify({ message: words(200) }), "message"), null);
    assert.equal(parseLinkedinModelOutput(JSON.stringify({ message: words(75) }), "message")?.kind, "message");
  });
  test("connection note: tolerates slight overshoot, rejects a long one", () => {
    const ok = parseLinkedinModelOutput(JSON.stringify({ message: "a".repeat(215) }), "connection_note");
    assert.equal(ok?.kind, "message");
    assert.equal(parseLinkedinModelOutput(JSON.stringify({ message: "a".repeat(400) }), "connection_note"), null);
  });
  test("countWords", () => {
    assert.equal(countWords("  one two\nthree  "), 3);
    assert.equal(countWords(""), 0);
  });
});
