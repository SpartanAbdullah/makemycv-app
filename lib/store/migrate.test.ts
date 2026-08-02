/**
 * Tests for the storage migrator (v1 → v2 → v3).
 *
 * Run with a TypeScript-aware Node test runner. With `tsx` installed
 * as a dev dep:
 *
 *   node --test --import tsx lib/store/migrate.test.ts
 *
 * or via the repo's own harness: `npm run test:migrate`.
 *
 * The tests use only the Node 18+ built-in `node:test` + `node:assert`,
 * so they are reviewable as code without execution.
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  CURRENT_VERSION,
  migrate,
  migrateLanguageLevel,
  type CanonicalLanguageLevel,
} from "./migrate";
import { LANGUAGE_LEVELS } from "../language";

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
  test("maps every known source value to a canonical target", () => {
    const expected: Record<string, CanonicalLanguageLevel> = {
      // canonical → itself
      elementary: "elementary",
      conversational: "conversational",
      professional: "professional",
      full_professional: "full_professional",
      native: "native",
      // pre-v2 vocabulary, per lib/language.ts's own CEFR labels
      beginner: "elementary",
      intermediate: "conversational",
      advanced: "professional",
      // written by the old, broken v1→v2 step
      fluent: "professional",
    };
    for (const [source, target] of Object.entries(expected)) {
      assert.equal(
        migrateLanguageLevel(source),
        target,
        `'${source}' should map to '${target}'`
      );
    }
  });

  // THE core guarantee of this module. A migration may lower or preserve a
  // stated proficiency; it must never raise one, because that puts a claim on
  // someone's CV that they never made and cannot see.
  test("NEVER raises a stated proficiency", () => {
    const rank: Record<CanonicalLanguageLevel, number> = {
      elementary: 0,
      conversational: 1,
      professional: 2,
      full_professional: 3,
      native: 4,
    };
    // Where each legacy value genuinely sits, from lib/language.ts's labels.
    const sourceRank: Record<string, number> = {
      elementary: 0,
      beginner: 0,
      conversational: 1,
      intermediate: 1,
      professional: 2,
      advanced: 2,
      fluent: 2,
      full_professional: 3,
      native: 4,
    };
    for (const [source, expectedRank] of Object.entries(sourceRank)) {
      const mapped = migrateLanguageLevel(source);
      assert.ok(mapped, `'${source}' should map to something`);
      assert.ok(
        rank[mapped] <= expectedRank,
        `'${source}' (rank ${expectedRank}) was RAISED to '${mapped}' (rank ${rank[mapped]})`
      );
    }
  });

  test("every mapped value is selectable in the UI's LANGUAGE_LEVELS", () => {
    // Regression guard for the 'fluent' defect: the migration must never write
    // a value the dropdown cannot select and the formatter cannot render.
    const selectable = new Set<string>(
      LANGUAGE_LEVELS.map((l) => l.value as string)
    );
    for (const source of [
      "elementary",
      "conversational",
      "professional",
      "full_professional",
      "native",
      "beginner",
      "intermediate",
      "advanced",
      "fluent",
    ]) {
      const mapped = migrateLanguageLevel(source);
      assert.ok(mapped, `'${source}' should map to something`);
      assert.ok(
        selectable.has(mapped),
        `'${source}' → '${mapped}', which LANGUAGE_LEVELS cannot select`
      );
    }
  });

  test("normalises case", () => {
    assert.equal(migrateLanguageLevel("NATIVE"), "native");
    assert.equal(migrateLanguageLevel("Full_Professional"), "full_professional");
  });

  test("preserves missing / empty as undefined", () => {
    assert.equal(migrateLanguageLevel(undefined), undefined);
    assert.equal(migrateLanguageLevel(null), undefined);
    assert.equal(migrateLanguageLevel(""), undefined);
  });

  test("unrecognised string is DROPPED, not defaulted", () => {
    // Asserting a mid-range level for a value we cannot interpret is the same
    // fabrication this mapping exists to prevent. Empty is recoverable; a
    // fabricated C1 on a submitted CV is not.
    assert.equal(migrateLanguageLevel("expert"), undefined);
    assert.equal(migrateLanguageLevel("c2"), undefined);
    assert.equal(migrateLanguageLevel("garbage-text"), undefined);
  });

  test("non-string input is DROPPED, not defaulted", () => {
    assert.equal(migrateLanguageLevel(7), undefined);
    assert.equal(migrateLanguageLevel({ x: 1 }), undefined);
    assert.equal(migrateLanguageLevel(true), undefined);
  });

  test("v2→v3 repairs a stored 'fluent' end to end", () => {
    const v2Payload = {
      version: 2,
      personal: {},
      languages: [{ id: "l1", name: "German", level: "fluent" }],
    };
    const r = migrate(v2Payload);
    assert.equal(r.outcome.status, "migrated");
    const langs = (r.data as unknown as { languages: { level: string }[] })
      .languages;
    assert.equal(langs[0].level, "professional");
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

  test("current-version payload → skipped, identity-passthrough, no double-migration", () => {
    const already = { ...v1Payload(), version: CURRENT_VERSION };
    // sentinel — a canonical value that must NOT be touched by a second pass
    already.languages = [{ id: "l1", name: "X", level: "full_professional" }];
    const r = migrate(already);
    assert.deepEqual(r.outcome, { status: "skipped", version: CURRENT_VERSION });
    // Same object reference handed back; no transforms applied.
    assert.equal(r.data, already as unknown);
    assert.equal(
      (r.data as { languages: { level: string }[] }).languages[0].level,
      "full_professional"
    );
  });

  test("a v2 payload is carried forward to v3 rather than skipped", () => {
    // v2 stopped being current on 2026-08-02; its language levels may contain
    // the unrenderable "fluent", so it must NOT be treated as up to date.
    const v2 = { ...v1Payload(), version: 2 };
    v2.languages = [{ id: "l1", name: "X", level: "fluent" }];
    const r = migrate(v2);
    assert.equal(r.outcome.status, "migrated");
    assert.equal((r.outcome as { from: number }).from, 2);
    assert.equal((r.outcome as { to: number }).to, CURRENT_VERSION);
    assert.equal(
      (r.data as { languages: { level: string }[] }).languages[0].level,
      "professional"
    );
  });

  test("future-version payload → skipped, returned as-is", () => {
    const future = { ...v1Payload(), version: 99 };
    const r = migrate(future);
    assert.equal(r.outcome.status, "skipped");
    assert.equal((r.outcome as { version: number }).version, 99);
  });
});

describe("migrate — v1 → v3 transforms", () => {
  test("stamps version = CURRENT_VERSION on a clean v1 payload", () => {
    const r = migrate(v1Payload());
    assert.deepEqual(r.outcome, {
      status: "migrated",
      from: 1,
      to: CURRENT_VERSION,
    });
    assert.equal((r.data as unknown as { version: number }).version, CURRENT_VERSION);
  });

  test("language levels are canonicalised without being raised", () => {
    const r = migrate(v1Payload());
    const langs = (r.data as unknown as {
      languages: { name: string; level?: string }[];
    }).languages;
    // full_professional is PRESERVED — the old migration flattened it to
    // "professional" and silently discarded C2.
    assert.equal(
      langs.find((l) => l.name === "English")?.level,
      "full_professional"
    );
    assert.equal(langs.find((l) => l.name === "Arabic")?.level, "native");
    // elementary stays elementary — the old migration RAISED it to
    // "conversational".
    assert.equal(langs.find((l) => l.name === "French")?.level, "elementary");
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
