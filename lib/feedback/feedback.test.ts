import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { parseRatingSubmit, parseRatingQuote, RATING_LIMITS } from "./rating";
import { parseSubscribe, CONSENT_TEXT_VERSION } from "./subscribe";

describe("parseRatingSubmit", () => {
  test("accepts 1–5 on a known surface, rejects everything else", () => {
    assert.deepEqual(parseRatingSubmit({ stars: 5, surface: "post_export" }), { stars: 5, surface: "post_export" });
    assert.deepEqual(parseRatingSubmit({ stars: "3", surface: "post_checker" }), { stars: 3, surface: "post_checker" });
    assert.equal(parseRatingSubmit({ stars: 0, surface: "post_export" }), null);
    assert.equal(parseRatingSubmit({ stars: 6, surface: "post_export" }), null);
    assert.equal(parseRatingSubmit({ stars: 4.5, surface: "post_export" }), null);
    assert.equal(parseRatingSubmit({ stars: 4, surface: "homepage" }), null);
    assert.equal(parseRatingSubmit(null), null);
  });
});

describe("parseRatingQuote", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const token = "abcdefghijklmnopqrstuvwx";
  test("clips the quote and name, requires id + token + quote", () => {
    const q = parseRatingQuote({ id, token, quote: " a ".repeat(300), quoteConsent: true, displayName: "Sara", displayRole: "Nurse" });
    assert.ok(q);
    assert.equal(q.quote.length <= RATING_LIMITS.quote, true);
    assert.equal(q.quoteConsent, true);
    assert.equal(q.displayName, "Sara");
    assert.equal(parseRatingQuote({ id, token, quote: "" }), null);
    assert.equal(parseRatingQuote({ id: "nope", token, quote: "x" }), null);
    assert.equal(parseRatingQuote({ id, token: "short", quote: "x" }), null);
  });
  test("consent is only true when literally true", () => {
    assert.equal(parseRatingQuote({ id, token, quote: "x", quoteConsent: "yes" })?.quoteConsent, false);
  });
});

describe("parseSubscribe", () => {
  test("normalises the address and defaults the source", () => {
    assert.deepEqual(parseSubscribe({ email: "  Sara@Example.COM " }), { email: "sara@example.com", source: "blog" });
    assert.deepEqual(parseSubscribe({ email: "a@b.co", source: "post_export" }), { email: "a@b.co", source: "post_export" });
    assert.equal(parseSubscribe({ email: "not an email" }), null);
    assert.equal(parseSubscribe({ email: "a@b" }), null);
    assert.equal(parseSubscribe({}), null);
  });
  test("consent text is versioned", () => {
    assert.match(CONSENT_TEXT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  });
});
