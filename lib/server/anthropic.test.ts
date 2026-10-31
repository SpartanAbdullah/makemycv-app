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
import http from "node:http";

import {
  ANTHROPIC_PARSE_TIMEOUT_MS,
  ANTHROPIC_TIMEOUT_MS,
  anthropicSignal,
  isTimeoutError,
  responseText,
} from "./anthropic";

describe("anthropicSignal / isTimeoutError (2026-10-31 bounded upstream wait)", () => {
  test("caps are ordered: small routes < parse route < parse maxDuration", () => {
    assert.ok(ANTHROPIC_TIMEOUT_MS < ANTHROPIC_PARSE_TIMEOUT_MS);
    assert.ok(ANTHROPIC_PARSE_TIMEOUT_MS < 60_000);
  });

  test("a fetch against a server that never answers rejects at the cap", async () => {
    // The server accepts the connection and then says nothing — the exact
    // shape of a stalled upstream that, before the signal, held every AI
    // route open until the platform killed the function.
    const server = http.createServer(() => {
      /* never respond */
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as { port: number };
    const cap = 120;
    const started = Date.now();
    let caught: unknown = null;
    try {
      await fetch(`http://127.0.0.1:${port}/v1/messages`, {
        method: "POST",
        body: "{}",
        signal: anthropicSignal(cap),
      });
    } catch (err) {
      caught = err;
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const elapsed = Date.now() - started;
    assert.ok(caught, "fetch must reject");
    assert.ok(isTimeoutError(caught), `rejection must read as a timeout, got ${String(caught)}`);
    assert.ok(elapsed >= cap - 5, `rejected too early: ${elapsed}ms`);
    assert.ok(elapsed < cap + 1500, `rejected too late: ${elapsed}ms`);
  });

  test("isTimeoutError ignores ordinary failures", () => {
    assert.equal(isTimeoutError(new Error("Anthropic API error: 500")), false);
    assert.equal(isTimeoutError(new TypeError("fetch failed")), false);
    assert.equal(isTimeoutError(null), false);
    assert.equal(isTimeoutError("TimeoutError"), false);
    assert.equal(isTimeoutError({ name: "TimeoutError" }), true);
    assert.equal(isTimeoutError({ name: "AbortError" }), true);
  });
});

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
