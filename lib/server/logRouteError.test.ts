/**
 * Tests for the AI failure log line (lib/server/logRouteError.ts).
 *
 * The invariant being guarded: only Anthropic's own error body is printed
 * verbatim. Any other error (a JSON.parse of model output, a payload check)
 * can carry CV text in its message, so it is reduced to its error name.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { logAiFailure } from "./logRouteError";

function capture(fn: () => void): string[] {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return lines;
}

describe("logAiFailure", () => {
  test("prints the Anthropic status and body", () => {
    const lines = capture(() =>
      logAiFailure("api/x", "upstream", new Error('Anthropic API error: 401 — {"type":"authentication_error"}')),
    );
    assert.deepEqual(lines, ['[api/x] ai_upstream Anthropic API error: 401 — {"type":"authentication_error"}']);
  });

  test("never prints another error's message (it may hold CV text)", () => {
    const lines = capture(() =>
      logAiFailure("api/x", "internal", new SyntaxError("Unexpected token in JSON: Layla Haddad, passport X123")),
    );
    assert.deepEqual(lines, ["[api/x] ai_internal SyntaxError"]);
    assert.ok(!lines[0].includes("Layla"));
  });

  test("kind only when there is no error", () => {
    assert.deepEqual(capture(() => logAiFailure("spendGuard", "spend_cap")), ["[spendGuard] ai_spend_cap"]);
  });

  test("caps the upstream body at 300 characters", () => {
    const long = `Anthropic API error: 529 — ${"x".repeat(1000)}`;
    const [line] = capture(() => logAiFailure("api/x", "upstream", new Error(long)));
    assert.equal(line.length, "[api/x] ai_upstream ".length + 300);
  });
});
