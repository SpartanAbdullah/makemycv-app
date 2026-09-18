/**
 * Tests for the set-aside park list (lib/skills/setAside.ts).
 *
 * The module reads globalThis.localStorage lazily, so a minimal in-memory stub
 * exercises it in Node without a DOM — and the no-storage path (SSR, private
 * mode) is tested by removing the stub entirely.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";

import {
  clearSetAside,
  getSetAsideServerSnapshot,
  getSetAsideSnapshot,
  isSetAside,
  listSetAside,
  parkSkill,
  restoreSkill,
  subscribeSetAside,
} from "./setAside";

const KEY = "makemycv:setAsideSkills";

type Store = { [k: string]: string };

function installStorage(initial: Store = {}) {
  const map: Store = { ...initial };
  const stub = {
    getItem: (k: string) => (k in map ? map[k] : null),
    setItem: (k: string, v: string) => {
      map[k] = String(v);
    },
    removeItem: (k: string) => {
      delete map[k];
    },
    clear: () => {
      for (const k of Object.keys(map)) delete map[k];
    },
    key: (i: number) => Object.keys(map)[i] ?? null,
    get length() {
      return Object.keys(map).length;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = stub;
  return map;
}

function removeStorage() {
  delete (globalThis as { localStorage?: unknown }).localStorage;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  removeStorage();
});

describe("park and restore", () => {
  test("a parked skill is remembered and reported", () => {
    parkSkill("Primavera P6");
    assert.equal(isSetAside("Primavera P6"), true);
    assert.deepEqual(
      listSetAside().map((e) => e.name),
      ["Primavera P6"],
    );
  });

  test("putting it back forgets it", () => {
    parkSkill("Primavera P6");
    restoreSkill("Primavera P6");
    assert.equal(isSetAside("Primavera P6"), false);
    assert.deepEqual(listSetAside(), []);
  });

  test("matching is case- and whitespace-insensitive", () => {
    parkSkill("  Primavera P6  ");
    assert.equal(isSetAside("primavera p6"), true);
    restoreSkill("PRIMAVERA P6");
    assert.equal(isSetAside("Primavera P6"), false);
  });

  test("parking the same skill twice does not duplicate it", () => {
    parkSkill("Excel", 1);
    parkSkill("excel", 2);
    assert.equal(listSetAside().length, 1);
    assert.equal(listSetAside()[0].parkedAt, 2, "re-parking refreshes the timestamp");
  });

  test("most recently parked comes first", () => {
    parkSkill("A", 1);
    parkSkill("B", 2);
    parkSkill("C", 3);
    assert.deepEqual(listSetAside().map((e) => e.name), ["C", "B", "A"]);
  });

  test("blank names are ignored", () => {
    parkSkill("");
    parkSkill("   ");
    assert.deepEqual(listSetAside(), []);
  });

  test("clearSetAside empties the list", () => {
    parkSkill("A");
    parkSkill("B");
    clearSetAside();
    assert.deepEqual(listSetAside(), []);
  });
});

describe("stored payload is defensive", () => {
  test("a payload from a different shape version is discarded, not guessed at", () => {
    installStorage({ [KEY]: JSON.stringify({ v: 999, items: [{ name: "X", parkedAt: 1 }] }) });
    assert.deepEqual(listSetAside(), []);
  });

  test("an unversioned legacy payload is discarded", () => {
    installStorage({ [KEY]: JSON.stringify({ items: [{ name: "X", parkedAt: 1 }] }) });
    assert.deepEqual(listSetAside(), []);
  });

  test("malformed JSON never throws", () => {
    installStorage({ [KEY]: "{not json" });
    assert.deepEqual(listSetAside(), []);
    assert.equal(isSetAside("anything"), false);
  });

  test("junk entries inside a valid payload are filtered out", () => {
    installStorage({
      [KEY]: JSON.stringify({
        v: 1,
        items: [{ name: "Good", parkedAt: 1 }, { name: "" }, null, { parkedAt: 2 }, 42],
      }),
    });
    assert.deepEqual(listSetAside().map((e) => e.name), ["Good"]);
  });

  test("a non-array items field is discarded", () => {
    installStorage({ [KEY]: JSON.stringify({ v: 1, items: "nope" }) });
    assert.deepEqual(listSetAside(), []);
  });

  test("the written payload carries its shape version", () => {
    const map = installStorage();
    parkSkill("Excel");
    const stored = JSON.parse(map[KEY]);
    assert.equal(stored.v, 1);
    assert.ok(Array.isArray(stored.items));
  });
});

describe("React binding (useSyncExternalStore contract)", () => {
  test("the snapshot is referentially STABLE between changes", () => {
    // If getSnapshot returned a fresh array each call, React would re-render
    // forever. This is the whole reason the parsed list is cached.
    parkSkill("Excel");
    const a = getSetAsideSnapshot();
    const b = getSetAsideSnapshot();
    assert.equal(a, b, "same reference when nothing changed");
  });

  test("the snapshot changes identity after a write", () => {
    parkSkill("Excel");
    const before = getSetAsideSnapshot();
    parkSkill("SAP");
    const after = getSetAsideSnapshot();
    assert.notEqual(before, after, "a write must invalidate the cache");
    assert.deepEqual(after.map((e) => e.name), ["SAP", "Excel"]);
  });

  test("every mutation notifies subscribers", () => {
    let calls = 0;
    const unsubscribe = subscribeSetAside(() => {
      calls++;
    });
    parkSkill("Excel");
    assert.equal(calls, 1);
    restoreSkill("Excel");
    assert.equal(calls, 2);
    clearSetAside();
    assert.equal(calls, 3);
    unsubscribe();
    parkSkill("SAP");
    assert.equal(calls, 3, "no notification after unsubscribe");
  });

  test("the server snapshot is empty and stable (hydration safety)", () => {
    parkSkill("Excel");
    assert.deepEqual(getSetAsideServerSnapshot(), []);
    assert.equal(
      getSetAsideServerSnapshot(),
      getSetAsideServerSnapshot(),
      "same reference, or SSR re-renders forever",
    );
  });

  test("subscribing does not throw without a DOM", () => {
    removeStorage();
    let unsubscribe: (() => void) | null = null;
    assert.doesNotThrow(() => {
      unsubscribe = subscribeSetAside(() => {});
    });
    assert.doesNotThrow(() => unsubscribe?.());
  });
});

describe("no storage available (SSR, private mode)", () => {
  test("every function degrades quietly instead of throwing", () => {
    removeStorage();
    assert.doesNotThrow(() => parkSkill("Excel"));
    assert.doesNotThrow(() => restoreSkill("Excel"));
    assert.doesNotThrow(() => clearSetAside());
    assert.deepEqual(listSetAside(), []);
    assert.equal(isSetAside("Excel"), false);
  });

  test("a storage object that throws on access is treated as absent", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    assert.deepEqual(listSetAside(), []);
    assert.doesNotThrow(() => parkSkill("Excel"));
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  test("a storage whose setItem throws (quota) loses the park, not the app", () => {
    const stub = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    (globalThis as { localStorage?: unknown }).localStorage = stub;
    assert.doesNotThrow(() => parkSkill("Excel"));
    assert.deepEqual(listSetAside(), []);
  });
});
