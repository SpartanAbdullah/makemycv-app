import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  askForExport,
  parseExportCount,
  resolveExportAsk,
  sentenceForExport,
  serializeExportCount,
  type AnswerableAsk,
} from "./exportAsks";

test("the first export points to the next step, then email, stars, follow", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(askForExport),
    ["next", "email", "stars", "follow", "next", "email", "stars", "follow", "next"],
  );
});

test("an out-of-range count falls back to the first row", () => {
  assert.equal(askForExport(0), "next");
  assert.equal(askForExport(-3), "next");
  assert.equal(askForExport(1.9), "next");
});

test("with everything askable, the shown row is the scheduled one", () => {
  const all = () => true;
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => resolveExportAsk(n, all)),
    ["next", "email", "stars", "follow", "next"],
  );
});

test("a row with nothing to ask gives way to the next one that has", () => {
  const only = (...ok: AnswerableAsk[]) => (ask: AnswerableAsk) => ok.includes(ask);
  // email already given (or switched off): its turn goes to stars
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => resolveExportAsk(n, only("stars"))),
    ["next", "stars", "stars", "follow"],
  );
  // stars already given: its turn goes to follow
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => resolveExportAsk(n, only("email"))),
    ["next", "email", "follow", "follow"],
  );
  // both off (local builds, or both answered): never an empty row
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => resolveExportAsk(n, only())),
    ["next", "follow", "follow", "follow", "next"],
  );
});

test("the first export is never an ask, whatever is switched on", () => {
  for (const canAsk of [() => true, () => false]) {
    assert.equal(resolveExportAsk(1, canAsk), "next");
    assert.equal(resolveExportAsk(0, canAsk), "next");
  }
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

// The north-star event and the card rule live in ONE function, so a second
// download button cannot count differently — or not at all, which is what
// JD Match's "Download for this job" did until 2026-11 (product audit E5).
test("every CV download is recorded through recordCvExport (source contract)", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
  const record = read("lib", "exportRecord.ts");
  assert.match(record, /track\("cv_export",/);
  assert.match(record, /track\("cv_export_started",/);

  for (const file of [
    ["components", "builder", "BuilderShell.tsx"],
    ["components", "jdmatch", "JdMatchPanel.tsx"],
  ]) {
    const src = read(...file);
    const name = file.join("/");
    assert.match(src, /recordCvExport\(/, `${name} must record its exports`);
    assert.match(src, /recordCvExportStarted\(/, `${name} must record its attempts`);
    assert.doesNotMatch(src, /track\(\s*"cv_export/, `${name} must not fire cv_export itself`);
    // …and both stop a half-finished CV at the same gate.
    assert.match(src, /getMissingItems\(/, `${name} must check for missing content`);
    assert.match(src, /getUnfilledBlanks\(/, `${name} must check for unfilled blanks`);
    assert.match(src, /<ExportGateDialog/, `${name} must show the export dialog`);
  }
});
