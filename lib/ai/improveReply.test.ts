import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { askWithOneRetry, readImproveReply, type ImproveReply } from "./improveReply";
import {
  NOTHING_TO_SUGGEST,
  describeRetryAfter,
  nothingToSuggestMessage,
} from "./improveOutcome";

const text = (t: string, extra: Record<string, unknown> = {}) => ({
  content: [{ type: "text", text: t }],
  ...extra,
});

describe("readImproveReply", () => {
  it("returns the strings of a clean JSON array", () => {
    assert.deepEqual(readImproveReply(text('["Led a team", "Cut costs"]')), {
      kind: "results",
      results: ["Led a team", "Cut costs"],
    });
  });

  it("reads through a thinking block and a markdown fence", () => {
    const reply = {
      content: [
        { type: "thinking", thinking: "", signature: "x" },
        { type: "text", text: '```json\n["One", "Two"]\n```' },
      ],
    };
    assert.deepEqual(readImproveReply(reply), { kind: "results", results: ["One", "Two"] });
  });

  it("folds placeholder variants into the one token", () => {
    const reply = readImproveReply(text('["Grew revenue by [X]% over {{ months }} months"]'));
    assert.equal(reply.kind, "results");
    if (reply.kind === "results") assert.match(reply.results[0], /\{\{number\}\}/);
  });

  it("drops non-strings and blanks", () => {
    assert.deepEqual(readImproveReply(text('["Real", 3, null, "  ", {"a":1}]')), {
      kind: "results",
      results: ["Real"],
    });
  });

  it("treats a refusal as a decline, whatever text came with it", () => {
    assert.deepEqual(readImproveReply({ stop_reason: "refusal", content: [] }), {
      kind: "declined",
    });
    assert.deepEqual(readImproveReply(text('["x"]', { stop_reason: "refusal" })), {
      kind: "declined",
    });
  });

  it("treats an empty list as a decline — the model had nothing to add", () => {
    assert.deepEqual(readImproveReply(text("[]")), { kind: "declined" });
    assert.deepEqual(readImproveReply(text('["", "   "]')), { kind: "declined" });
  });

  it("marks what it cannot read as unusable", () => {
    for (const reply of [
      null,
      {},
      { content: "not an array" },
      text(""),
      text("I'm sorry, I can't help with that."),
      // cut off at max_tokens mid-array
      text('["Led a team of {{number}}", "Reduc', { stop_reason: "max_tokens" }),
      text('{"results": "none"}'),
      text("] nonsense ["),
    ]) {
      assert.deepEqual(readImproveReply(reply), { kind: "unusable" }, JSON.stringify(reply));
    }
  });
});

describe("askWithOneRetry", () => {
  const ok: ImproveReply = { kind: "results", results: ["a"] };
  const bad: ImproveReply = { kind: "unusable" };

  const run = async (replies: Array<{ kind: string }>, mayRetry: boolean | (() => boolean) = true) => {
    const attempts: number[] = [];
    let gateCalls = 0;
    const out = await askWithOneRetry(
      async (n) => {
        attempts.push(n);
        return replies[attempts.length - 1];
      },
      () => {
        gateCalls += 1;
        return typeof mayRetry === "function" ? mayRetry() : mayRetry;
      },
    );
    return { out, attempts, gateCalls };
  };

  it("asks once when the first reply is usable", async () => {
    const r = await run([ok]);
    assert.deepEqual(r.attempts, [1]);
    assert.equal(r.gateCalls, 0);
    assert.deepEqual(r.out, ok);
  });

  it("does not ask again after a decline", async () => {
    const r = await run([{ kind: "declined" }, ok]);
    assert.deepEqual(r.attempts, [1]);
    assert.deepEqual(r.out, { kind: "declined" });
  });

  it("does not ask again after an upstream failure", async () => {
    const r = await run([{ kind: "upstream" }, ok]);
    assert.deepEqual(r.attempts, [1]);
    assert.deepEqual(r.out, { kind: "upstream" });
  });

  it("asks exactly once more after an unusable reply", async () => {
    const r = await run([bad, ok]);
    assert.deepEqual(r.attempts, [1, 2]);
    assert.equal(r.gateCalls, 1);
    assert.deepEqual(r.out, ok);
  });

  it("never asks a third time", async () => {
    const r = await run([bad, bad, ok]);
    assert.deepEqual(r.attempts, [1, 2]);
    assert.deepEqual(r.out, bad);
  });

  it("keeps the first reply when the gate says no", async () => {
    const r = await run([bad, ok], false);
    assert.deepEqual(r.attempts, [1]);
    assert.equal(r.gateCalls, 1);
    assert.deepEqual(r.out, bad);
  });
});

describe("improve outcome wording", () => {
  it("has a sentence for every type and a safe default", () => {
    for (const type of ["bullets", "skills", "summary"] as const) {
      const message = nothingToSuggestMessage(type);
      assert.match(message, /^Nothing to suggest/);
      assert.match(message, /try again\.$/);
    }
    assert.equal(nothingToSuggestMessage(undefined), nothingToSuggestMessage("bullets"));
  });

  it("describes a reset time roughly, and stays silent without one", () => {
    assert.equal(describeRetryAfter(undefined), null);
    assert.equal(describeRetryAfter(null), null);
    assert.equal(describeRetryAfter(0), null);
    assert.equal(describeRetryAfter(Number.NaN), null);
    assert.equal(describeRetryAfter(1), "in about a minute");
    assert.equal(describeRetryAfter(45), "in about a minute");
    assert.equal(describeRetryAfter(90), "in about 2 minutes");
    assert.equal(describeRetryAfter(25 * 60), "in about 25 minutes");
    assert.equal(describeRetryAfter(59 * 60 + 1), "in about an hour");
    assert.equal(describeRetryAfter(80 * 60), "in about an hour");
    assert.equal(describeRetryAfter(3 * 3600), "in about 3 hours");
    assert.equal(describeRetryAfter(19 * 3600), "in about 19 hours");
    assert.equal(describeRetryAfter(23.5 * 3600), "tomorrow");
  });
});

describe("the route uses them (source contract)", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "ai-improve", "route.ts"),
    "utf8",
  );

  it("answers a decline with the shared code, never 'Internal server error'", () => {
    assert.match(route, /NOTHING_TO_SUGGEST/);
    assert.match(route, /askWithOneRetry/);
    assert.doesNotMatch(route, /Internal server error/);
    assert.doesNotMatch(route, /Failed to parse AI response/);
    assert.equal(NOTHING_TO_SUGGEST, "nothing_to_suggest");
  });

  it("charges the spend guard for the second attempt", () => {
    const retryGate = route.slice(route.indexOf("askWithOneRetry"));
    assert.match(retryGate, /takeSpendUnits\(1\)/);
  });
});
