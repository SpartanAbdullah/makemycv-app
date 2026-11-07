import assert from "node:assert/strict";
import test from "node:test";
import { askForExport, parseExportCount, sentenceForExport, serializeExportCount } from "./exportAsks";

test("the first export asks for a follow, then the asks rotate", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map(askForExport),
    ["follow", "stars", "email", "follow", "stars", "email", "follow"],
  );
});

test("an out-of-range count falls back to the first ask", () => {
  assert.equal(askForExport(0), "follow");
  assert.equal(askForExport(-3), "follow");
});

test("with the service off, the sentence is always the karak line", () => {
  assert.deepEqual([1, 2, 3].map((n) => sentenceForExport(n, false)), ["karak", "karak", "karak"]);
});

test("with the service on, odd exports mention it, starting with the first", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => sentenceForExport(n, true)),
    ["service", "karak", "service", "karak", "service"],
  );
  assert.equal(sentenceForExport(0, true), "service");
});

test("the count round-trips through storage", () => {
  assert.equal(parseExportCount(serializeExportCount(4)), 4);
});

test("an unreadable record is discarded, not guessed", () => {
  for (const raw of [null, "", "not json", "4", "null", '{"count":4}', '{"v":2,"count":4}', '{"v":1,"count":-1}', '{"v":1,"count":1.5}', '{"v":1,"count":"4"}']) {
    assert.equal(parseExportCount(raw), 0, String(raw));
  }
});
