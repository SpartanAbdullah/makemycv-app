/**
 * Tests for the toast queue's "slot" rule (lib/store/uiStore.ts).
 *
 * Action toasts (Undo) are never displaced by a later toast, which is right
 * for independent actions and wrong for an action that only applies to the
 * latest event: two imports in a row left two "Undo" buttons on screen, the
 * older of which could no longer undo anything (2026-11).
 */

import { test, describe, beforeEach } from "node:test";
import { strict as assert } from "node:assert";

import { useUiStore } from "./uiStore";

const texts = () => useUiStore.getState().toasts.map((t) => t.text);

describe("toast slots (key)", () => {
  beforeEach(() => useUiStore.setState({ toasts: [] }));

  test("a new toast in the same slot replaces the one on screen", () => {
    const { pushToast } = useUiStore.getState();
    pushToast("Merged 4 sections", { key: "import", actionLabel: "Undo", onAction: () => {} });
    pushToast("Imported 6 sections", { key: "import", actionLabel: "Undo", onAction: () => {} });
    assert.deepEqual(texts(), ["Imported 6 sections"]);
  });

  test("toasts without a slot keep the existing rules", () => {
    const { pushToast } = useUiStore.getState();
    pushToast("Role removed", { actionLabel: "Undo", onAction: () => {} });
    pushToast("Language removed", { actionLabel: "Undo", onAction: () => {} });
    assert.deepEqual(texts(), ["Role removed", "Language removed"], "independent undos both stay");
  });

  test("a slotted toast does not displace an unrelated action toast", () => {
    const { pushToast } = useUiStore.getState();
    pushToast("Role removed", { actionLabel: "Undo", onAction: () => {} });
    pushToast("Imported 6 sections", { key: "import", actionLabel: "Undo", onAction: () => {} });
    assert.deepEqual(texts(), ["Role removed", "Imported 6 sections"]);
  });
});
