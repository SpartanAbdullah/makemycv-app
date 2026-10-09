/**
 * Tests for reading the answer out of a Messages API response
 * (lib/server/anthropic.ts).
 *
 * The bug being prevented: Claude Haiku 5.5 thinks by default, so content[0]
 * can be a `thinking` block with empty text. Reading content[0].text made
 * every Claude route fall back to its non-AI path without an error.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { responseText } from "./anthropic";

describe("responseText", () => {
  test("skips a leading thinking block", () => {
    const data = {
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: '["a","b"]' },
      ],
    };
    assert.equal(responseText(data), '["a","b"]');
  });

  test("joins multiple text blocks in order", () => {
    const data = {
      content: [
        { type: "text", text: "{\"x\":" },
        { type: "text", text: "1}" },
      ],
    };
    assert.equal(responseText(data), '{"x":1}');
  });

  test("returns empty for a response cut off during thinking", () => {
    const data = {
      stop_reason: "max_tokens",
      content: [{ type: "thinking", thinking: "", signature: "sig" }],
    };
    assert.equal(responseText(data), "");
  });

  test("returns empty for a refusal with no content", () => {
    assert.equal(responseText({ stop_reason: "refusal", content: [] }), "");
  });

  test("returns empty for malformed payloads", () => {
    assert.equal(responseText(null), "");
    assert.equal(responseText({}), "");
    assert.equal(responseText({ content: "not an array" }), "");
    assert.equal(responseText({ content: [null, { type: "text" }] }), "");
  });
});
