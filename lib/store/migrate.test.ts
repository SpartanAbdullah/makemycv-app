/**
 * Tests for the v1 → v2 storage migrator.
 *
 * Run with a TypeScript-aware Node test runner. With `tsx` installed
 * as a dev dep:
 *
 *   node --test --import tsx lib/store/migrate.test.ts
 *
 * No test framework is in package.json yet — the tests use only the
 * Node 18+ built-in `node:test` + `node:assert`. They are reviewable
 * as code without execution.
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  CURRENT_VERSION,
  migrate,
  migrateLanguageLevel,
  type V2LanguageLevel,
} from "./migrate";

// A minimal but complete v1-shaped payload for reuse across tests.
const v1Payload = () => ({
  personal: {
    firstName: "Aisha",
    lastName: "Al-Marri",
    headline: "Senior Operations Manager",
    email: "aisha@example.com",
    phone: "+971 50 000 0000",
    location: "Dubai",
    website: "aisha.example",
    linkedin: "linkedin.com/in/aisha",
    summary: "10y in regional ops.",
    nationality: "Emirati",
    drivingLicense: "UAE Light Vehicle License",
  },
  experience: [
    {
      id: "e1",
      company: "A regional bank",
      role: "Ops Manager",
      location: "Dubai",
      startDate: "2020-01",
      endDate: "",
      isCurrent: true,
      bullets: ["Did things"],
    },
  ],
  education: [
    {
      id: "ed1",
      school: "AUS",
      degree: "BBA",
      field: "Finance",
      startDate: "2014-09",
      endDate: "2018-06",
      attested: true,
      attestingBody: "MOFA UAE",
    },
  ],
  skills: [{ id: "s1", name: "Excel", level: "advanced" }],
  languages: [
    { id: "l1", name: "English", level: "full_professional" },
    { id: "l2", name: "Arabic", level: "native" },
    { id: "l3", name: "French", level: "elementary" },
  ],
  certifications: [
    { id: "c1", name: "PMP", issuer: "PMI", date: "2019-04-15" },
  ],
  projects: [
    { id: "p1", name: "X", bullets: ["did stuff"] },
  ],
  settings: { templateId: "classic" },
});

// ─── language level mapping ───────────────────────────────────────────

describe("migrateLanguageLevel", () => {
  test("maps each of the 8 v1 source values to a valid v2 target", () => {
    const expected: Record<string, V2LanguageLevel> = {
      elementary: "conversational",
      conversational: "conversational",
      professional: "professional",
      full_professional: "professional",
      native: "native",
      beginner: "conversational",
      intermediate: "professional",
      advanced: "fluent",
    };
    for (const [source, target] of Object.entries(expected)) {
      assert.equal(
        migrateLanguageLevel(source),
        target,
        `'${source}' should map to '${target}'`
      );
    }
  });

  test("passes through values that are already v2-shape", () => {
    for (const v of ["native", "fluent", "professional", "conversational"]) {
      assert.equal(migrateLanguageLevel(v), v);
    }
  });

  test("normalises case (UPPER / Mixed → lowercase v2 value)", () => {
    assert.equal(migrateLanguageLevel("NATIVE"), "native");
    assert.equal(migrateLanguageLevel("Full_Professional"), "professional");
  });

  test("preserves missing / empty as undefined (not 'no level filled' → fallback)", () => {
    assert.equal(migrateLanguageLevel(undefined), undefined);
    assert.equal(migrateLanguageLevel(null), undefined);
    assert.equal(migrateLanguageLevel(""), undefined);
  });

  test("unmapped string value falls back to 'conversational' + warns", () => {
    assert.equal(migrateLanguageLevel("expert"), "conversational");
    assert.equal(migrateLanguageLevel("c2"), "conversational");
    assert.equal(migrateLanguageLevel("garbage-text"), "conversational");
  });

  test("non-string input falls back to 'conversational' + warns", () => {
    assert.equal(migrateLanguageLevel(7), "conversational");
    assert.equal(migrateLanguageLevel({ x: 1 }), "conversational");
    assert.equal(migrateLanguageLevel(true), "conversational");
  });
});

// ─── public migrate() entry ────────────────────────────────────────────

describe("migrate — version routing", () => {
  test("null / undefined input → fresh outcome, data null", () => {
    assert.deepEqual(migrate(null), { data: null, outcome: { status: "fresh" } });
    assert.deepEqual(migrate(undefined), { data: null, outcome: { status: "fresh" } });
  });

  test("non-object input (string / number / array) → failed, data null", () => {
    for (const bad of ["a string", 42, [1, 2, 3], true]) {
      const r = migrate(bad);
      assert.equal(r.data, null);
      assert.equal(r.outcome.status, "failed");
    }
  });

  test("v2 payload (already migrated) → skipped, identity-passthrough, no double-migration", () => {
    const already = { ...v1Payload(), version: 2 };
    // sentinel — should NOT be normalised by a second pass
    already.languages = [{ id: "l1", name: "X", level: "advanced" }];
    const r = migrate(already);
    assert.deepEqual(r.outcome, { status: "skipped", version: 2 });
    // Same object reference handed back; no transforms applied.
    assert.equal(r.data, already as unknown);
    assert.equal((r.data as { languages: { level: string }[] }).languages[0].level, "advanced");
  });

  test("future-version payload (e.g. v3) → skipped, returned as-is", () => {
    const future = { ...v1Payload(), version: 99 };
    const r = migrate(future);
    assert.equal(r.outcome.status, "skipped");
    assert.equal((r.outcome as { version: number }).version, 99);
  });
});

describe("migrate — v1 → v2 transforms", () => {
  test("stamps version = CURRENT_VERSION on a clean v1 payload", () => {
    const r = migrate(v1Payload());
    assert.deepEqual(r.outcome, { status: "migrated", from: 1, to: 2 });
    assert.equal((r.data as unknown as { version: number }).version, CURRENT_VERSION);
  });

  test("language enum tightening applies to all entries", () => {
    const r = migrate(v1Payload());
    const langs = (r.data as unknown as {
      languages: { name: string; level?: string }[];
    }).languages;
    assert.equal(langs.find((l) => l.name === "English")?.level, "professional"); // full_professional → professional
    assert.equal(langs.find((l) => l.name === "Arabic")?.level, "native");
    assert.equal(langs.find((l) => l.name === "French")?.level, "conversational"); // elementary → conversational
  });

  test("language entry with no level is preserved without a level key", () => {
    const p = v1Payload();
    p.languages.push({ id: "l4", name: "Urdu" } as never);
    const r = migrate(p);
    const langs = (r.data as unknown as {
      languages: { name: string; level?: string }[];
    }).languages;
    const urdu = langs.find((l) => l.name === "Urdu");
    assert.ok(urdu);
    assert.equal("level" in urdu, false);
  });

  test("personal.openTo defaults to []", () => {
    const r = migrate(v1Payload());
    assert.deepEqual(
      (r.data as unknown as { personal: { openTo: unknown } }).personal.openTo,
      []
    );
  });

  test("personal.fullNameArabic / emiratesIdYear default to ''", () => {
    const r = migrate(v1Payload());
    const p = (r.data as unknown as {
      personal: { fullNameArabic: string; emiratesIdYear: string };
    }).personal;
    assert.equal(p.fullNameArabic, "");
    assert.equal(p.emiratesIdYear, "");
  });

  test("enum-typed new fields stay omitted (visaStatus / emiratesId / noticePeriod)", () => {
    const r = migrate(v1Payload());
    const p = (r.data as unknown as { personal: Record<string, unknown> }).personal;
    assert.equal("visaStatus" in p, false);
    assert.equal("emiratesId" in p, false);
    assert.equal("noticePeriod" in p, false);
  });

  test("top-level boardRoles + awards default to []", () => {
    const r = migrate(v1Payload());
    const d = r.data as unknown as { boardRoles: unknown; awards: unknown };
    assert.deepEqual(d.boardRoles, []);
    assert.deepEqual(d.awards, []);
  });

  test("scopeBand stays omitted (T3-only opt-in)", () => {
    const r = migrate(v1Payload());
    assert.equal("scopeBand" in (r.data as object), false);
  });

  test("does not overwrite existing user values for the new fields", () => {
    const p = v1Payload();
    (p.personal as Record<string, unknown>).openTo = ["Dubai", "Remote"];
    (p.personal as Record<string, unknown>).fullNameArabic = "عائشة المري";
    (p as Record<string, unknown>).boardRoles = [{ role: "Director" }];
    const r = migrate(p);
    const d = r.data as unknown as {
      personal: { openTo: string[]; fullNameArabic: string };
      boardRoles: unknown[];
    };
    assert.deepEqual(d.personal.openTo, ["Dubai", "Remote"]);
    assert.equal(d.personal.fullNameArabic, "عائشة المري");
    assert.equal(d.boardRoles.length, 1);
  });
});

describe("migrate — data preservation (no accidental loss)", () => {
  test("every v1 field not listed in the transform table carries through unchanged", () => {
    const original = v1Payload();
    const r = migrate(original);
    const d = r.data as unknown as ReturnType<typeof v1Payload> & {
      version: number;
    };

    // personal — non-transformed fields verbatim
    assert.equal(d.personal.firstName, "Aisha");
    assert.equal(d.personal.lastName, "Al-Marri");
    assert.equal(d.personal.headline, "Senior Operations Manager");
    assert.equal(d.personal.email, "aisha@example.com");
    assert.equal(d.personal.phone, "+971 50 000 0000");
    assert.equal(d.personal.summary, "10y in regional ops.");
    assert.equal(d.personal.nationality, "Emirati");
    // drivingLicense free-text preserved (rename was rejected as cosmetic)
    assert.equal(d.personal.drivingLicense, "UAE Light Vehicle License");

    // experience — isCurrent + endDate INTENTIONALLY untouched (Task 5)
    assert.equal(d.experience[0].isCurrent, true);
    assert.equal(d.experience[0].endDate, "");
    assert.equal(d.experience[0].company, "A regional bank");

    // education — UAE attestation fields preserved
    assert.equal(d.education[0].attested, true);
    assert.equal(d.education[0].attestingBody, "MOFA UAE");

    // certifications — date INTENTIONALLY untouched (Task 5)
    assert.equal(d.certifications[0].date, "2019-04-15");
    assert.equal(d.certifications[0].name, "PMP");

    // projects + settings preserved
    assert.equal(d.projects[0].name, "X");
    assert.equal(d.settings.templateId, "classic");
  });

  test("input is not mutated", () => {
    const input = v1Payload();
    const before = JSON.stringify(input);
    migrate(input);
    assert.equal(JSON.stringify(input), before);
  });
});

describe("migrate — integrity under transform failure", () => {
  test("if a transform throws, returned payload is NOT stamped v2", () => {
    // Build a v1-shaped payload whose `personal` getter throws when read,
    // so the spread `{ ...payload }` inside migrateV1ToV2 fails before
    // the version stamp is reached.
    const evil: Record<string, unknown> = {};
    Object.defineProperty(evil, "personal", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error("boom");
      },
    });

    const r = migrate(evil);
    assert.equal(r.outcome.status, "failed");
    // The catch path returns the original payload — and since the
    // version stamp is the LAST line of migrateV1ToV2, it never ran.
    // We can't read evil.personal (it would throw) but we can read
    // evil.version safely.
    assert.notEqual((r.data as unknown as { version?: number })?.version, 2);
  });

  test("failed-outcome data is the original payload, not blanked", () => {
    const evil: Record<string, unknown> = { sentinel: "still here" };
    Object.defineProperty(evil, "personal", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error("boom");
      },
    });
    const r = migrate(evil);
    assert.equal(r.outcome.status, "failed");
    assert.equal((r.data as unknown as { sentinel: string })?.sentinel, "still here");
  });
});
