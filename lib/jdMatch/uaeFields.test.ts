/**
 * UAE Essentials fields as JD requirements (lib/jdMatch/uaeFields.ts).
 * Built-in node:test only; picked up by `npm run test:unit`.
 *
 * Invariants:
 *  1. licence and availability requirements are recognised, ordinary skills are not,
 *  2. a filled field answers the requirement it states and nothing more,
 *  3. an empty field answers nothing.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { uaeFieldFor, uaeFieldPhrases } from "./uaeFields";
import { termAppearsIn } from "./match";

describe("uaeFieldFor", () => {
  test("recognises driving-licence requirements in both spellings", () => {
    assert.equal(uaeFieldFor("Valid UAE driving licence"), "drivingLicense");
    assert.equal(uaeFieldFor("UAE driving license"), "drivingLicense");
    assert.equal(uaeFieldFor("Driver's license"), "drivingLicense");
  });

  test("recognises availability requirements", () => {
    assert.equal(uaeFieldFor("Immediate joiners"), "availability");
    assert.equal(uaeFieldFor("available immediately"), "availability");
    assert.equal(uaeFieldFor("Short notice period"), "availability");
  });

  test("leaves ordinary requirements alone", () => {
    for (const term of ["Key account management", "SAP", "Negotiation", "Immediate supervisor reporting", "Fleet driving"]) {
      assert.equal(uaeFieldFor(term), null, term);
    }
  });
});

describe("uaeFieldPhrases", () => {
  const covers = (personal: { drivingLicense?: string; availability?: string }, term: string) =>
    uaeFieldPhrases(personal).some((phrase) => termAppearsIn(phrase, term));

  test("an empty CV answers nothing", () => {
    assert.deepEqual(uaeFieldPhrases({}), []);
    assert.deepEqual(uaeFieldPhrases({ drivingLicense: "None", availability: "" }), []);
  });

  test("a UAE licence answers a UAE-licence requirement", () => {
    assert.ok(covers({ drivingLicense: "Light Vehicle" }, "Valid UAE driving licence"));
    assert.ok(covers({ drivingLicense: "Light Vehicle" }, "driving license"));
  });

  test("an international licence does not answer a UAE-licence requirement", () => {
    assert.ok(covers({ drivingLicense: "International licence" }, "driving licence"));
    assert.ok(!covers({ drivingLicense: "International licence" }, "UAE driving licence"));
  });

  test("only Immediate answers an immediate-joiner requirement", () => {
    assert.ok(covers({ availability: "Immediate" }, "Immediate joiners"));
    assert.ok(!covers({ availability: "30 days notice" }, "Immediate joiners"));
    assert.ok(covers({ availability: "30 days notice" }, "notice period"));
  });
});
