import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { isCvEmpty } from "../utils/cvContent";
import { CV_SESSION_KEYS, useCvStore } from "./cvStore";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

describe("Start a new CV (reset)", () => {
  it("puts the store back to an empty CV with nothing left to undo", () => {
    const store = useCvStore.getState();
    store.updateSection("personal", {
      ...store.data.personal,
      firstName: "Amina",
      lastName: "Khan",
      phone: "+971 50 000 0000",
    });
    store.importCvVersion(
      { skills: [{ id: "s1", name: "Stakeholder management" }] } as Parameters<
        typeof store.importCvVersion
      >[0],
      "merge",
    );
    assert.equal(useCvStore.getState().data.personal.firstName, "Amina");
    assert.notEqual(useCvStore.getState().importUndo, null);

    useCvStore.getState().reset();

    const after = useCvStore.getState();
    assert.equal(after.data.personal.firstName ?? "", "");
    assert.equal(after.data.personal.phone ?? "", "");
    assert.equal(after.data.personal.summary ?? "", "");
    assert.deepEqual(after.data.skills, []);
    assert.equal(isCvEmpty(after.data), true);
    // The previous CV must not be one tap away.
    assert.equal(after.importUndo, null);
    assert.equal(after.undoImport(), false);
    assert.equal(after.parseSignals, null);
    assert.equal(after.scoreBaseline, null);
    assert.equal(after.jdTarget, null);
  });

  it("clears the session keys that hold CV-derived text, by their real names", () => {
    // The keys belong to other modules; this fails when one is renamed there
    // and the list in cvStore.ts is left behind.
    const owners: Record<(typeof CV_SESSION_KEYS)[number], string[]> = {
      "makemycv:checkerPreview": ["lib", "resumeChecker", "extractionPreview.ts"],
      "makemycv:coverLetterSeed": ["components", "coverletter", "CoverLetterPanel.tsx"],
      "makemycv:linkedinMessageSeed": ["components", "linkedin", "LinkedinMessagePanel.tsx"],
    };
    for (const key of CV_SESSION_KEYS) {
      assert.ok(read(...owners[key]).includes(`"${key}"`), `${key} not found at its owner`);
    }
    const store = read("lib", "store", "cvStore.ts");
    const resetBody = store.slice(store.indexOf("  reset: () => {"));
    assert.match(resetBody.slice(0, resetBody.indexOf("importJson:")), /clearCvSessionKeys\(\)/);
  });

  it("is reachable from the Review step, behind a dialog that offers a backup", () => {
    const review = read("components", "builder", "steps", "ReviewStep.tsx");
    assert.match(review, /<StartOverDialog/);
    const dialog = read("components", "builder", "StartOverDialog.tsx");
    assert.match(dialog, /downloadCvBackup\(/);
    assert.match(dialog, /reset\(\)/);
    // Opens with the keyboard on Cancel, not on the destructive button.
    assert.match(dialog, /cancelRef\.current\?\.focus\(\)/);
  });
});
