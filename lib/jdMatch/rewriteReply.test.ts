import { test } from "node:test";
import assert from "node:assert/strict";
import { readRewriteReply } from "./rewriteReply";

const reply = (text: string, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });
const BULLET = "Resolved guest complaints to ensure satisfaction.";

test("a clean list of rewrites is returned", () => {
  const out = readRewriteReply(reply('["Delivered customer service by resolving guest complaints."]'), BULLET);
  assert.deepEqual(out, { kind: "variants", variants: ["Delivered customer service by resolving guest complaints."] });
});

test("an empty list is the honest no, not a fault", () => {
  assert.deepEqual(readRewriteReply(reply("[]"), BULLET), { kind: "variants", variants: [] });
});

test("a model refusal is a no as well", () => {
  assert.deepEqual(readRewriteReply({ stop_reason: "refusal", content: [] }, BULLET), { kind: "variants", variants: [] });
});

test("prose, a cut-off reply and an empty reply are unusable, not a no", () => {
  assert.deepEqual(readRewriteReply(reply("I cannot add that keyword truthfully."), BULLET), { kind: "unusable" });
  assert.deepEqual(readRewriteReply(reply('["Delivered customer serv', "max_tokens"), BULLET), { kind: "unusable" });
  assert.deepEqual(readRewriteReply(reply(""), BULLET), { kind: "unusable" });
  assert.deepEqual(readRewriteReply(null, BULLET), { kind: "unusable" });
});

test("a fenced block is still read, and only two variants are kept", () => {
  const out = readRewriteReply(reply('```json\n["One rewrite.", "Two rewrite.", "Three rewrite."]\n```'), BULLET);
  assert.deepEqual(out, { kind: "variants", variants: ["One rewrite.", "Two rewrite."] });
});

test("a rewrite that adds a blank for a figure the bullet never had is dropped", () => {
  const out = readRewriteReply(
    reply('["Raised guest satisfaction by [X]% by resolving complaints.", "Delivered customer service by resolving guest complaints."]'),
    BULLET,
  );
  assert.deepEqual(out, { kind: "variants", variants: ["Delivered customer service by resolving guest complaints."] });
});

test("a blank already in the bullet may stay, in the one spelling the UI explains", () => {
  const out = readRewriteReply(reply('["Handled [X] customer service calls a day."]'), "Handled {{number}} calls a day.");
  assert.deepEqual(out, { kind: "variants", variants: ["Handled {{number}} customer service calls a day."] });
});
