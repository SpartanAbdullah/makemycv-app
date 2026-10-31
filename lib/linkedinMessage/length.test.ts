/**
 * Tests for the LinkedIn message length enforcement (lib/linkedinMessage/length.ts)
 * — backlog E5: the 60–90-word brief came back as 101 / 102 words in both e2e runs.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { splitSentences, trimToWordLimit } from "./length";
import { countWords } from "./prompt";
import { MESSAGE_WORDS } from "./payload";

const sentence = (n: number, tag: string) => `${Array.from({ length: n - 1 }, (_, i) => `${tag.toUpperCase()}${i}`).join(" ")} end.`;

describe("splitSentences", () => {
  test("splits on . ! ? and keeps closing quotes with the sentence", () => {
    assert.deepEqual(splitSentences('I closed month-end in 5 days. Shall we talk? "Yes." Great!'), [
      "I closed month-end in 5 days.",
      "Shall we talk?",
      '"Yes."',
      "Great!",
    ]);
  });
  test("a decimal mid-sentence does not split, and the text before it stays in the sentence", () => {
    assert.deepEqual(splitSentences("Cut costs by 2.5 per cent in Q1. Based in Dubai."), [
      "Cut costs by 2.5 per cent in Q1.",
      "Based in Dubai.",
    ]);
  });
  test("currency amounts with a decimal (AED 1.2M) do not split", () => {
    assert.deepEqual(splitSentences("I managed a budget of AED 1.2M across three sites. Happy to share my CV."), [
      "I managed a budget of AED 1.2M across three sites.",
      "Happy to share my CV.",
    ]);
  });
  test("an abbreviation followed by a lower-case word does not split", () => {
    assert.deepEqual(splitSentences("I ran audits, e.g. the annual stock count. Open to a call."), [
      "I ran audits, e.g. the annual stock count.",
      "Open to a call.",
    ]);
  });
  test("a trailing fragment without punctuation is its own sentence", () => {
    assert.deepEqual(splitSentences("First one. And a dangling tail"), ["First one.", "And a dangling tail"]);
  });
});

describe("trimToWordLimit", () => {
  test("a message within the limit is returned unchanged and not marked trimmed", () => {
    const text = `${sentence(40, "a")} ${sentence(40, "b")}`;
    assert.deepEqual(trimToWordLimit(text, 90), { text, trimmed: false });
    assert.equal(countWords(text), 80);
  });

  test("the production shape — 102 words in four sentences — drops a body sentence and keeps the closing next step", () => {
    const text = `${sentence(30, "a")} ${sentence(30, "b")} ${sentence(30, "c")} ${sentence(12, "d")}`;
    assert.equal(countWords(text), 102);
    const out = trimToWordLimit(text, MESSAGE_WORDS.max);
    assert.equal(out.trimmed, true);
    assert.equal(countWords(out.text), 72);
    assert.ok(out.text.startsWith("A0"));
    assert.ok(out.text.includes("D0"), "the closing sentence is kept");
    assert.ok(!out.text.includes("C0"), "the third sentence is dropped whole");
  });

  test("keeps the paragraph break when the kept sentences span two paragraphs", () => {
    const text = `${sentence(30, "a")} ${sentence(30, "b")}\n\n${sentence(20, "c")} ${sentence(30, "d")}`;
    const out = trimToWordLimit(text, 90);
    assert.equal(out.trimmed, true);
    assert.equal(countWords(out.text), 90);
    assert.ok(out.text.includes("\n\n"), "paragraph break preserved");
    assert.ok(!out.text.includes("C0"));
    assert.ok(out.text.includes("D0"));
  });

  test("never cuts mid-sentence when a boundary exists — even when that leaves a short message", () => {
    const text = `${sentence(50, "a")} ${sentence(50, "b")}`;
    const out = trimToWordLimit(text, 90);
    assert.equal(countWords(out.text), 50);
    assert.equal(out.text, sentence(50, "a"));
  });

  test("a decimal is never a cut point", () => {
    const first = "I cut freight costs by 2.5 per cent, worth AED 1.2M a year.";
    const text = `${first} ${sentence(75, "a")} ${sentence(10, "b")}`;
    const out = trimToWordLimit(text, 90);
    assert.equal(out.trimmed, true);
    assert.equal(out.text, `${first} ${sentence(10, "b")}`);
  });

  test("fallback: one sentence over the limit is cut at the word limit and closed with a full stop", () => {
    const text = sentence(95, "a");
    const out = trimToWordLimit(text, 90);
    assert.equal(out.trimmed, true);
    assert.equal(countWords(out.text), 90);
    assert.ok(out.text.endsWith("."));
    assert.ok(!/[,;:]\.$/.test(out.text));
  });

  test("placeholders survive the cut", () => {
    const text = `${sentence(30, "a")} I saved {{number}}% on freight. ${sentence(50, "c")} ${sentence(12, "d")}`;
    const out = trimToWordLimit(text, 90);
    assert.ok(out.text.includes("{{number}}"));
    assert.ok(!out.text.includes("C0"));
    assert.ok(countWords(out.text) <= 90);
  });
});
