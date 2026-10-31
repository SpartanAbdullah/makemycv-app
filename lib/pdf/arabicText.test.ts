import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  containsArabic,
  firstStrongDirection,
  shapeArabic,
  shapeArabicSegments,
  toLogicalArabic,
  unjoinedArabicLetters,
} from "./arabicText";

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

  it("sets an isolated Urdu heh goal as the base letter the PDF face has (E8.4)", () => {
    // طاہرہ: ط(init) ا(final) | ہ(init) ر(final) | ہ isolated → U+06C1, never U+FBA6
    assert.deepEqual(cps(shapeArabic("طاہرہ")), ["FEC3", "FE8E", "FBA8", "FEAE", "6C1"]);
    // joined heh goal keeps its presentation forms: تجزیہ ends in final ہ, مہینے has a medial one
    assert.deepEqual(cps(shapeArabic("یہ")), ["FBFE", "FBA7"]);
    assert.deepEqual(cps(shapeArabic("مہینے")), ["FEE3", "FBA9", "FBFF", "FEE8", "FBAF"]);
    assert.equal(shapeArabic("طاہرہ ملک").includes("ﮦ"), false);
  });

  it("shapes the other Urdu letters UAE job seekers type", () => {
    // ٹرک ڈرائیور گودام میں بناۓ بڑھایا: ٹ ڈ ڑ ک گ ں ھ ے ۓ all take a presentation form
    const out = shapeArabic("ٹرک ڈرائیور گودام میں نئے بناۓ بڑھایا");
    for (const ch of out) {
      const cp = ch.codePointAt(0)!;
      assert.equal([0x0679, 0x0688, 0x0691, 0x06a9, 0x06af, 0x06ba, 0x06be, 0x06d2, 0x06d3].includes(cp), false, `unshaped U+${cp.toString(16)}`);
    }
    assert.equal(toLogicalArabic(out), "ٹرک ڈرائیور گودام میں نئے بناۓ بڑھایا".normalize("NFKC"));
  });

  it("decomposes ۂ (heh goal + hamza) so it joins, and NFKC composes it back", () => {
    // کۂ → ک(init) ہ(final) + hamza above
    assert.deepEqual(cps(shapeArabic("کۂ")), ["FB90", "FBA7", "654"]);
    assert.equal(toLogicalArabic(shapeArabic("کۂ")), "کۂ");
  });
});

describe("shapeArabicSegments (E8.5 — several runs on one line)", () => {
  it("shapes the runs as one text and splits the result back per run", () => {
    const runs = ["محلل سلسلة التوريد", " | شركة الخليج للخدمات اللوجستية"];
    const parts = shapeArabicSegments(runs);
    assert.equal(parts.length, 2);
    assert.equal(parts.join(""), shapeArabic(runs.join("")));
    assert.deepEqual(parts.map(toLogicalArabic), runs.map((r) => r.normalize("NFKC")));
  });

  it("joins letters across a run boundary", () => {
    // محمد split mid-word: م(init) ح(medial) | م(medial) د(final)
    assert.deepEqual(shapeArabicSegments(["مح", "مد"]).map(cps), [["FEE3", "FEA4"], ["FEE4", "FEAA"]]);
  });

  it("gives a lam-alef that straddles two runs to the run of the lam", () => {
    assert.deepEqual(shapeArabicSegments(["ل", "ا"]).map(cps), [["FEFB"], []]);
  });

  it("returns Latin-only runs unchanged (no ligature pre-composition)", () => {
    assert.deepEqual(shapeArabicSegments(["Office", " | Profit"]), ["Office", " | Profit"]);
  });
});

describe("firstStrongDirection", () => {
  it("is rtl for an Arabic-first paragraph, whatever follows", () => {
    assert.equal(firstStrongDirection("صمّم لوحات متابعة (Power BI) لمستوى الخدمة"), "rtl");
    assert.equal(firstStrongDirection("خفّض المخزون بنسبة 12% بعد تطبيق نظام SAP IBP"), "rtl");
    assert.equal(firstStrongDirection("12% — خفّض المخزون"), "rtl"); // digits are weak
    assert.equal(firstStrongDirection(shapeArabic("مدير مالي — Senior Manager")), "rtl"); // presentation forms
    assert.equal(firstStrongDirection("طاہرہ ملک"), "rtl");
  });

  it("is ltr for a Latin-first paragraph, even with Arabic later", () => {
    assert.equal(firstStrongDirection("Senior محلل Supply Chain"), "ltr");
    assert.equal(firstStrongDirection("(CPA) محاسب قانوني"), "ltr");
    assert.equal(firstStrongDirection("Cut freight spend by AED 1.2M"), "ltr");
  });

  it("is null when there is no letter", () => {
    assert.equal(firstStrongDirection("2023 – 2025"), null);
    assert.equal(firstStrongDirection("+971 50 123 4567"), null);
    assert.equal(firstStrongDirection(""), null);
  });
});

describe("unjoinedArabicLetters", () => {
  it("reports nothing for Arabic, Persian and the Urdu letters the shaper covers", () => {
    assert.deepEqual(unjoinedArabicLetters("أحمد الراشد — مدير مالي أول، ٢٠٢٦"), []);
    assert.deepEqual(unjoinedArabicLetters("پژوهشگر چاپ"), []);
    assert.deepEqual(unjoinedArabicLetters("طاہرہ ملک — ٹرک ڈرائیور گودام میں بناۓ بڑھایا کۂ ۔"), []);
    assert.deepEqual(unjoinedArabicLetters("Senior Finance Manager"), []);
  });

  it("names letters without presentation forms (they print unjoined)", () => {
    assert.deepEqual(unjoinedArabicLetters("صلوۃ ۀ ۀ"), ["ۃ", "ۀ"]);
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
