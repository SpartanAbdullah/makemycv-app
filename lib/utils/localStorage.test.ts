// Backup export/restore round-trip.
//
// This is the product's ONLY recovery path: the CV lives in one browser's
// localStorage with no account and no server copy. If exportCvJson ->
// readCvBackup ever stops round-tripping, a user who follows our own advice
// ("keep a backup") gets a file that cannot restore. Hence a test.
//
// Run: npm run test:backup

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { exportCvJson, readCvBackup } from "./localStorage";
import { CURRENT_VERSION } from "../store/migrate";
import type { CvData } from "../types/cv";

const sample = {
  personal: {
    firstName: "Aisha",
    lastName: "Khan",
    email: "aisha@example.com",
    phone: "+971500000000",
  },
  experience: [
    { id: "e1", title: "Analyst", company: "DIFC Bank", bullets: ["Did a thing"] },
  ],
  education: [{ id: "d1", degree: "BBA", institution: "AUD" }],
  skills: [{ id: "s1", name: "Excel" }],
  languages: [{ id: "l1", name: "Arabic", level: "native" }],
  certifications: [],
  projects: [],
  settings: { templateId: "classic" },
} as unknown as CvData;

describe("backup round-trip", () => {
  test("export -> read restores an identical CV", () => {
    const restored = readCvBackup(exportCvJson(sample));
    assert.equal(restored.ok, true);
    if (!restored.ok) return;
    assert.deepEqual(restored.data.personal, sample.personal);
    assert.deepEqual(restored.data.experience, sample.experience);
    assert.deepEqual(restored.data.skills, sample.skills);
    assert.deepEqual(restored.data.languages, sample.languages);
  });

  test("an uploaded photo survives the round-trip", () => {
    // personal.photo is the field the builder was silently dropping (audit
    // A-W1-014). If a backup loses it, the backup is worse than useless —
    // it restores a CV the user believes is complete.
    const withPhoto = {
      ...sample,
      personal: {
        ...sample.personal,
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==",
        showPhoto: true,
      },
    } as unknown as CvData;
    const restored = readCvBackup(exportCvJson(withPhoto));
    assert.equal(restored.ok, true);
    if (!restored.ok) return;
    assert.equal(
      restored.data.personal.photo,
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==",
    );
    assert.equal(restored.data.personal.showPhoto, true);
  });

  test("export stamps the current schema version", () => {
    const parsed = JSON.parse(exportCvJson(sample));
    assert.equal(parsed.version, CURRENT_VERSION);
  });

  test("a current-version backup is not re-migrated on restore", () => {
    const restored = readCvBackup(exportCvJson(sample));
    assert.equal(restored.ok, true);
    if (!restored.ok) return;
    assert.equal(restored.migratedFrom, null);
  });

  test("a legacy (v1) backup restores and reports the upgrade", () => {
    const legacy = JSON.stringify({
      ...sample,
      languages: [{ id: "l1", name: "German", level: "intermediate" }],
      // no `version` key at all — how pre-v2 payloads looked
    });
    const restored = readCvBackup(legacy);
    assert.equal(restored.ok, true);
    if (!restored.ok) return;
    assert.equal(restored.migratedFrom, 1);
  });

  test("malformed JSON is rejected, not silently swallowed", () => {
    const r = readCvBackup("{ not json");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, "unreadable");
  });

  test("valid JSON that is not a CV is rejected", () => {
    // Restoring is destructive — picking the wrong file must NOT blank the
    // builder. These are all things a user could plausibly pick by mistake.
    for (const notACv of [
      '{"hello":"world"}',
      "[]",
      "null",
      '"a string"',
      '{"personal":{},"experience":[]}', // partial — missing education/skills
    ]) {
      const r = readCvBackup(notACv);
      assert.equal(r.ok, false, `expected rejection for ${notACv}`);
    }
  });
});
