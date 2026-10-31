/**
 * Pins the public "what this checks" list (lib/resumeChecker/checklist.ts)
 * to the score engine: the set of sub-signal ids on the page must equal the
 * set of `sig("<id>", …)` calls in lib/scoreEngine.ts, each id listed once,
 * and the conditional (parser-only) marking must match the engine's
 * `conditional` flag. A rule added to the engine without a line on the page,
 * or a line on the page the engine no longer checks, fails here.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { CHECKLIST, CHECKLIST_SIGNAL_COUNT } from "./checklist";

// tsconfig.test.json compiles lib/ into .test-build/; the engine source is
// read from the repo (cwd = repo root under `npm test`).
const ENGINE_SRC = fs.readFileSync(
  path.join(process.cwd(), "lib", "scoreEngine.ts"),
  "utf8",
);

function engineSignalIds(): Set<string> {
  const ids = new Set<string>();
  for (const m of ENGINE_SRC.matchAll(/\bsig\(\s*"([CSAD]\d+)"/g)) ids.add(m[1]);
  return ids;
}

function engineConditionalIds(): Set<string> {
  // Conditional signals are registered as sig("X", cat, pts, pass, sev, {…}, true).
  // The `true` sits after the issue object literal, so scan each sig(...) call
  // to its closing paren at depth 0 and look at the last argument.
  const out = new Set<string>();
  const re = /\bsig\(\s*"([CSAD]\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ENGINE_SRC))) {
    let depth = 0;
    let i = m.index + m[0].lastIndexOf("(");
    for (; i < ENGINE_SRC.length; i++) {
      const ch = ENGINE_SRC[i];
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) break;
      }
    }
    const call = ENGINE_SRC.slice(m.index, i);
    if (/,\s*true\s*,?\s*$/.test(call)) out.add(m[1]);
  }
  return out;
}

describe("checker checklist ↔ score engine", () => {
  const listed = CHECKLIST.flatMap((g) => g.items.flatMap((i) => i.ids));

  test("every engine sub-signal is listed exactly once, and nothing else is", () => {
    const engine = engineSignalIds();
    assert.ok(engine.size > 0, "engine ids found");
    assert.equal(new Set(listed).size, listed.length, "no id listed twice");
    assert.deepEqual([...new Set(listed)].sort(), [...engine].sort());
    assert.equal(CHECKLIST_SIGNAL_COUNT, engine.size);
  });

  test("parser-only marking matches the engine's conditional flag", () => {
    const conditional = engineConditionalIds();
    assert.ok(conditional.size > 0, "conditional ids found");
    for (const g of CHECKLIST) {
      for (const item of g.items) {
        const flagged = item.ids.filter((id) => conditional.has(id));
        if (item.parserOnly) {
          assert.deepEqual(flagged.sort(), [...item.ids].sort(), `${item.ids.join(",")} all conditional`);
        } else {
          assert.deepEqual(flagged, [], `${item.ids.join(",")} not conditional`);
        }
      }
    }
  });

  test("ids sit under the right category", () => {
    const prefix: Record<string, string> = { C: "content", S: "sections", A: "atsEssentials", D: "design" };
    for (const g of CHECKLIST) {
      for (const item of g.items) {
        for (const id of item.ids) assert.equal(prefix[id[0]], g.category, id);
      }
    }
  });
});
