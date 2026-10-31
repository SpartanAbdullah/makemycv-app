import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { containsArabic, shapeArabic, toLogicalArabic } from "./arabicText";

const cps = (s: string) => Array.from(s, (c) => c.codePointAt(0)!.toString(16).toUpperCase());

describe("containsArabic", () => {
  it("detects letters, marks and presentation forms, not Latin", () => {
    assert.equal(containsArabic("مدير"), true);
    assert.equal(containsArabic("xّy"), true);
    assert.equal(containsArabic("ﻟ"), true);
    assert.equal(containsArabic("Senior Manager — Dubai"), false);
    assert.equal(containsArabic(""), false);
  });
});

describe("shapeArabic joining forms", () => {
  it("sets isolated / initial / medial / final forms of dual-joining letters", () => {
    // ب alone, ببب: initial, medial, final
    assert.deepEqual(cps(shapeArabic("ب")), ["FE8F"]);
    assert.deepEqual(cps(shapeArabic("ببب")), ["FE91", "FE92", "FE90"]);
  });

  it("right-joining letters take only final forms and break the chain", () => {
    // د joins the previous letter but not the next: م(init) د(final), then ي starts a new chain: ي(init) ر(final)
    assert.deepEqual(cps(shapeArabic("مدير")), ["FEE3", "FEAA", "FEF3", "FEAE"]);
    // و never joins forward: أول = أ(isolated) و(isolated) ل(isolated)
    assert.deepEqual(cps(shapeArabic("أول")), ["FE83", "FEED", "FEDD"]);
  });

  it("composes lam + alef into the ligature code point in the right form", () => {
    assert.deepEqual(cps(shapeArabic("لا")), ["FEFB"]); // isolated
    assert.deepEqual(cps(shapeArabic("سلام")), ["FEB3", "FEFC", "FEE1"]); // final after س, then م isolated
    // ا never joins forward, so ر and ة after it are isolated
    assert.deepEqual(cps(shapeArabic("الإدارة")), ["FE8D", "FEF9", "FEA9", "FE8D", "FEAD", "FE93"]);
    assert.deepEqual(cps(shapeArabic("لآ")), ["FEF5"]);
    assert.deepEqual(cps(shapeArabic("لأ")), ["FEF7"]);
  });

  it("looks through harakat and keeps them in place", () => {
    // محمّد: م(init) ح(medial) م(medial, shadda follows) د(final)
    assert.deepEqual(cps(shapeArabic("محمّد")), ["FEE3", "FEA4", "FEE4", "651", "FEAA"]);
  });

  it("treats tatweel as joining and ZWNJ as a break", () => {
    assert.deepEqual(cps(shapeArabic("بـب")), ["FE91", "640", "FE90"]);
    assert.deepEqual(cps(shapeArabic("ب‌ب")), ["FE8F", "200C", "FE8F"]);
  });

  it("covers the Persian / Urdu letters UAE job seekers type", () => {
    assert.deepEqual(cps(shapeArabic("پ")), ["FB56"]);
    assert.deepEqual(cps(shapeArabic("گچ")), ["FB94", "FB7B"]);
    assert.deepEqual(cps(shapeArabic("ے")), ["FBAE"]);
  });
});

describe("shapeArabic passthrough", () => {
  it("leaves Latin, digits, punctuation and Arabic-Indic digits untouched", () => {
    const s = "Senior Finance Manager — Dubai, 2019–2026 · ٢٠٢٦ · ahmed@example.ae";
    assert.equal(shapeArabic(s), s);
  });

  it("shapes only the Arabic runs of a mixed string", () => {
    const out = shapeArabic("IFRS 16 في Dubai");
    assert.equal(out.startsWith("IFRS 16 "), true);
    assert.equal(out.endsWith(" Dubai"), true);
    assert.deepEqual(cps(out.slice(8, 10)), ["FED3", "FEF2"]);
  });

  it("pre-composes Latin fi/fl/ffi/ffl only when the text also holds Arabic", () => {
    assert.equal(shapeArabic("Office Profit Inflow"), "Office Profit Inflow");
    const out = shapeArabic("Office Profit Inflow — مدير");
    assert.equal(out.startsWith("Oﬃce Proﬁt Inﬂow — "), true);
    assert.equal(shapeArabic("Efficient — مدير").startsWith("Eﬃcient"), true);
    assert.equal(toLogicalArabic(out).startsWith("Office Profit Inflow — "), true);
  });

  it("is idempotent — presentation forms are not reshaped", () => {
    const once = shapeArabic("مدير مالي أول في الإدارة");
    assert.equal(shapeArabic(once), once);
  });

  it("never emits a code point outside the presentation-form blocks for a letter", () => {
    const out = shapeArabic("أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ ئؤءةى");
    for (const ch of out) {
      const cp = ch.codePointAt(0)!;
      const isLetter = cp >= 0x0621 && cp <= 0x064a;
      assert.equal(isLetter && cp !== 0x0621, false, `unshaped letter U+${cp.toString(16)}`);
    }
  });
});

describe("toLogicalArabic", () => {
  it("round-trips every shaped word back to what was typed", () => {
    const words = [
      "أحمد الراشد مدير مالي أول",
      "سلام، الإدارة لا تعرف الآن إلا الله",
      "قاد فريقاً من 12 محاسباً عبر ثلاث شركات",
      "محمّد عبدالله الرّحمن",
      "Senior Finance Manager — مدير مالي أول في Dubai",
    ];
    for (const w of words) assert.equal(toLogicalArabic(shapeArabic(w)), w.normalize("NFKC"));
  });
});
