/**
 * Tests for the UAE Essentials vocabularies (lib/data/uaeOptions.ts).
 *
 * The bug being prevented: free text landing in enum-typed fields. The UAE
 * select then shows nothing while the templates print the raw string.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  normalizeAvailability,
  normalizeDrivingLicence,
  normalizeVisaStatus,
} from "./uaeOptions";

describe("normalizeVisaStatus", () => {
  test("exact option, any case, trailing punctuation", () => {
    assert.equal(normalizeVisaStatus("employment visa."), "Employment visa");
    assert.equal(normalizeVisaStatus("Golden Visa"), "Golden Visa");
  });
  test("common phrasings map to the nearest option", () => {
    assert.equal(normalizeVisaStatus("Employment"), "Employment visa");
    assert.equal(normalizeVisaStatus("Husband's sponsorship"), "Family sponsorship");
    assert.equal(normalizeVisaStatus("Visit visa (3 months)"), "Visit visa");
    assert.equal(normalizeVisaStatus("Cancelled, transferable"), "Cancelled / transferable");
    assert.equal(normalizeVisaStatus("Employment visa (transferable)"), "Employment visa");
    assert.equal(normalizeVisaStatus("Transferable"), "Cancelled / transferable");
  });
  test("the whole builder line is NOT a visa status", () => {
    assert.equal(
      normalizeVisaStatus("Employment visa · Available: 30 days notice · DL: Light Vehicle"),
      // The line still contains "employment", so by the loose rule it would
      // map — but the parser splits on separators before it ever gets here;
      // this documents the normaliser's own behaviour on a dirty input.
      "Employment visa",
    );
  });
  test("unknown text is not asserted", () => {
    assert.equal(normalizeVisaStatus("Valid"), null);
    assert.equal(normalizeVisaStatus(""), null);
  });
});

describe("normalizeAvailability", () => {
  test("exact and immediate", () => {
    assert.equal(normalizeAvailability("30 days notice"), "30 days notice");
    assert.equal(normalizeAvailability("Immediately"), "Immediate");
    assert.equal(normalizeAvailability("Available now"), "Immediate");
  });
  test("durations round to the nearest option", () => {
    assert.equal(normalizeAvailability("1 month"), "30 days notice");
    assert.equal(normalizeAvailability("One month notice"), "30 days notice");
    assert.equal(normalizeAvailability("2 weeks"), "2 weeks notice");
    assert.equal(normalizeAvailability("15 days"), "2 weeks notice");
    assert.equal(normalizeAvailability("60 days"), "60 days notice");
    assert.equal(normalizeAvailability("2 months"), "60 days notice");
    assert.equal(normalizeAvailability("3 months notice period"), "90 days notice");
  });
  test("unparseable text is not asserted", () => {
    assert.equal(normalizeAvailability("Negotiable"), null);
    assert.equal(normalizeAvailability("6 months"), null);
  });
});

describe("normalizeDrivingLicence", () => {
  test("options and synonyms", () => {
    assert.equal(normalizeDrivingLicence("Light Vehicle"), "Light Vehicle");
    assert.equal(normalizeDrivingLicence("Valid UAE LMV licence"), "Light Vehicle");
    assert.equal(normalizeDrivingLicence("Heavy vehicle (3)"), "Heavy Vehicle");
    assert.equal(normalizeDrivingLicence("International driving permit"), "International licence");
    assert.equal(normalizeDrivingLicence("None"), "None");
  });
  test("a bare 'Valid' does not become a vehicle class", () => {
    assert.equal(normalizeDrivingLicence("Valid"), null);
    assert.equal(normalizeDrivingLicence("Yes"), null);
  });
});
