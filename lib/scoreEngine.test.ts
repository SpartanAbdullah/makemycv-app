/**
 * Characterization tests for the unified scoring engine (lib/scoreEngine.ts).
 *
 * There is no test framework in package.json — these use only the Node 18+
 * built-in `node:test` + `node:assert`, mirroring lib/jdMatch/match.test.ts.
 *
 * Run via the npm script (compiles to CommonJS, then runs node --test):
 *
 *   npm run test:score
 *
 * DUMP=1 npm run test:score   prints every fixture's report summary.
 *
 * These are CHARACTERIZATION tests: the golden totals/grades below were
 * OBSERVED from the engine as of 2026-07 and then locked in. They are not
 * claims that these numbers are "right" — they pin today's behavior so any
 * future change to weights, thresholds, or sub-signals fails loudly and has
 * to update the goldens consciously. Three layers:
 *
 *  1. Golden scores/grades for 7 representative CvData fixtures.
 *  2. Monotonicity invariants — adding a strong quantified bullet never
 *     lowers the total; clearing visa status never raises uaeFilledCount;
 *     dirty parseSignals never beat clean ones.
 *  3. Grade-threshold consistency with the tier table ScoreChip renders
 *     (components/builder/ScoreChip.tsx derives its tier from report.grade).
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  computeDerivedStats,
  computeScore,
  GRADE_CHIP_LABELS,
  GRADE_LABELS,
} from "./scoreEngine";
import type { ParseSignals, ScoreGrade } from "./resumeChecker/types";
import type { CvData, CvExperience } from "./types/cv";

// --- Fixture helpers -------------------------------------------------------

function blankCv(): CvData {
  return {
    personal: {
      firstName: "",
      lastName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      linkedin: "",
      summary: "",
    },
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    settings: { templateId: "classic" },
  };
}

function exp(
  id: string,
  company: string,
  role: string,
  startDate: string,
  endDate: string,
  isCurrent: boolean,
  bullets: string[],
): CvExperience {
  return { id, company, role, location: "Dubai", startDate, endDate, isCurrent, bullets };
}

function skills(names: string[]): CvData["skills"] {
  return names.map((name, i) => ({ id: `sk-${i}`, name }));
}

const clone = (cv: CvData): CvData => structuredClone(cv);

// --- Fixtures ---------------------------------------------------------------

/** 1. Completely empty CV — the floor. */
const EMPTY: CvData = blankCv();

/** 2. Personal/contact details only — no experience, education, or skills. */
const MINIMAL: CvData = (() => {
  const cv = blankCv();
  cv.personal = {
    ...cv.personal,
    firstName: "Ayesha",
    lastName: "Khan",
    headline: "Sales Executive",
    email: "ayesha.khan@example.com",
    phone: "+971 50 123 4567",
    location: "Dubai, UAE",
    linkedin: "linkedin.com/in/ayeshakhan",
  };
  return cv;
})();

/** 3. Mid-quality CV — real content, but weak phrases and almost no metrics. */
const MID_WEAK: CvData = (() => {
  const cv = blankCv();
  cv.personal = {
    ...cv.personal,
    firstName: "Ayesha",
    lastName: "Khan",
    headline: "Sales Executive",
    email: "ayesha.khan@example.com",
    phone: "+971 50 123 4567",
    location: "Dubai, UAE",
    linkedin: "linkedin.com/in/ayeshakhan",
    summary:
      "Sales professional responsible for business development in the UAE market. " +
      "Hardworking team player with experience across retail and distribution channels.",
  };
  cv.experience = [
    exp("e1", "Gulf Retail LLC", "Sales Executive", "2021", "", true, [
      "Responsible for managing key accounts and daily sales operations",
      "Handled customer complaints and processed product returns",
      "Increased monthly sales by 15% through consistent upselling",
      "Prepared weekly sales reports for the regional office",
      "Trained new joiners on point of sale systems",
    ]),
    exp("e2", "Desert Mart", "Sales Assistant", "2019", "2021", false, [
      "Duties included stocking shelves and assisting walk-in customers",
      "Supported the store manager with weekly inventory counts",
    ]),
  ];
  cv.education = [
    {
      id: "edu1",
      school: "University of Karachi",
      degree: "BBA",
      field: "Marketing",
      startDate: "2015",
      endDate: "2019",
    },
  ];
  cv.skills = skills([
    "Sales",
    "Negotiation",
    "CRM",
    "Customer Service",
    "Merchandising",
    "Excel",
  ]);
  return cv;
})();

/** 4. Strong finance CV — quantified verb-led bullets, complete sections,
 *  UAE-essentials all filled. Characterizes the builder-mode ceiling. */
const STRONG_FINANCE: CvData = (() => {
  const cv = blankCv();
  cv.personal = {
    ...cv.personal,
    firstName: "Imran",
    lastName: "Sheikh",
    headline: "Senior Financial Analyst",
    email: "imran.sheikh@example.com",
    phone: "+971 55 987 6543",
    location: "Dubai, UAE",
    linkedin: "linkedin.com/in/imransheikh",
    summary:
      "Senior financial analyst with 9 years of experience across banking and FMCG in the GCC. " +
      "Led budgeting and forecasting for a AED 120M portfolio, cut reporting cycle time by 30%, " +
      "and partnered with leadership on IFRS-compliant statements. Skilled in SAP FICO, Power BI, " +
      "and advanced financial modelling. Known for turning messy ledgers into decision-ready " +
      "insight for regional leadership teams.",
    nationality: "Pakistani",
    visaStatus: "Employment visa",
    availability: "Immediate",
    drivingLicense: "Light Vehicle",
  };
  cv.experience = [
    exp("e1", "Emirates NBD", "Senior Financial Analyst", "2021-03", "", true, [
      "Led annual budgeting and quarterly forecasting for a AED 120M retail banking portfolio across 4 business lines",
      "Reduced month-end close from 8 days to 5 by automating reconciliations and journal validation in SAP FICO",
      "Built Power BI dashboards adopted by 40+ stakeholders across finance, operations, and the executive committee",
      "Delivered IFRS 9 impairment models that cut provisioning variance by 12% year over year",
      "Presented monthly performance packs to the CFO, translating variance drivers into 3 clear action items",
      "Streamlined intercompany reconciliation workflows, eliminating 30+ manual journal entries each quarter",
    ]),
    exp("e2", "Unilever Gulf", "Financial Analyst", "2017-01", "2021-02", false, [
      "Managed rolling forecasts covering AED 60M in annual trade spend across 5 FMCG categories",
      "Improved forecast accuracy by 18% by introducing driver-based planning models in Anaplan",
      "Automated weekly sales flash reporting in Power Query, saving 12 analyst hours every month",
      "Coordinated the annual external audit with PwC across 3 legal entities with zero overdue deliverables",
      "Negotiated a revised credit policy with sales leadership, reducing overdue receivables by 22%",
    ]),
    exp("e3", "KPMG Lower Gulf", "Audit Associate", "2015-09", "2016-12", false, [
      "Executed statutory audits for 15 clients across banking, insurance, and real estate",
      "Reviewed IFRS financial statements and flagged 20+ control gaps adopted into management letters",
      "Prepared audit working papers to firm methodology standards with zero review reopens",
      "Trained 4 junior associates on sampling methodology and audit documentation tools",
    ]),
  ];
  cv.education = [
    {
      id: "edu1",
      school: "University of Sharjah",
      degree: "BSc Accounting and Finance",
      field: "Accounting",
      startDate: "2011",
      endDate: "2015",
    },
  ];
  cv.skills = skills([
    "Financial Modelling",
    "Budgeting & Forecasting",
    "SAP FICO",
    "Power BI",
    "IFRS Reporting",
    "Variance Analysis",
    "Cash Flow Management",
    "Advanced Excel",
    "VAT Compliance",
    "Stakeholder Reporting",
    "Data Visualisation",
    "Cost Control",
  ]);
  cv.languages = [
    { id: "l1", name: "English", level: "professional" },
    { id: "l2", name: "Urdu", level: "native" },
  ];
  cv.certifications = [{ id: "c1", name: "CMA", issuer: "IMA", date: "2019" }];
  return cv;
})();

/** 5. Overlong CV — paragraph bullets, 200+ word summary, 30+ skills.
 *  Exercises every "too much" ceiling (C4, C9, C10, D3, D6, D7). */
const OVERLONG: CvData = (() => {
  const cv = blankCv();
  const filler = (n: number, seed: string) =>
    Array.from({ length: n }, () => seed).join(" ");
  cv.personal = {
    ...cv.personal,
    firstName: "Rashid",
    lastName: "Al Marri",
    headline: "Operations Director",
    email: "rashid.almarri@example.com",
    phone: "+971 52 111 2233",
    location: "Abu Dhabi, UAE",
    linkedin: "linkedin.com/in/rashidalmarri",
    // 8 + 7×43 = 309 words — over the 200-word C4 ceiling, digits present.
    summary:
      "Operations director with 18 years of regional experience. " +
      filler(301, "delivering") + " outcomes.",
  };
  // Each role: one quantified 45-word bullet + three unquantified 45-word
  // bullets; role 1 also carries a 65-word paragraph bullet (C10).
  const longQuantified =
    "Managed 12 concurrent regional initiatives " + filler(41, "spanning");
  const longPlain = "Coordinated cross functional programmes " + filler(41, "spanning");
  const hugeBullet = "Directed enterprise wide transformation " + filler(61, "covering");
  cv.experience = [
    exp("e1", "Etihad Logistics", "Operations Director", "2019", "", true, [
      longQuantified,
      longPlain,
      longPlain,
      hugeBullet,
    ]),
    exp("e2", "Gulf Freight Co", "Head of Operations", "2014", "2019", false, [
      longQuantified,
      longPlain,
      longPlain,
      longPlain,
    ]),
    exp("e3", "Emirates Cargo", "Operations Manager", "2009", "2014", false, [
      longQuantified,
      longPlain,
      longPlain,
      longPlain,
    ]),
    exp("e4", "Dubai Ports", "Shift Supervisor", "2005", "2009", false, [
      longQuantified,
      longPlain,
      longPlain,
      longPlain,
    ]),
  ];
  cv.education = [
    {
      id: "edu1",
      school: "UAE University",
      degree: "BSc Industrial Engineering",
      field: "Engineering",
      startDate: "2001",
      endDate: "2005",
    },
  ];
  cv.skills = skills([
    ...Array.from({ length: 32 }, (_, i) => `Operations skill ${i + 1}`),
    "End-to-end supply chain transformation programme leadership",
    "Large-scale multi-site logistics network optimisation initiatives",
  ]);
  return cv;
})();

/** 6 & 7. UAE-essentials pair — identical strong CV with and without the
 *  visa/availability/licence trio. */
const UAE_COMPLETE: CvData = clone(STRONG_FINANCE);
const UAE_MISSING: CvData = (() => {
  const cv = clone(STRONG_FINANCE);
  delete cv.personal.visaStatus;
  delete cv.personal.availability;
  delete cv.personal.drivingLicense;
  return cv;
})();

const FIXTURES: Record<string, CvData> = {
  EMPTY,
  MINIMAL,
  MID_WEAK,
  STRONG_FINANCE,
  OVERLONG,
  UAE_COMPLETE,
  UAE_MISSING,
};

// --- Optional dump (DUMP=1 npm run test:score) ------------------------------

if (process.env.DUMP === "1") {
  for (const [name, cv] of Object.entries(FIXTURES)) {
    const r = computeScore(cv);
    const cats = r.categories.map((c) => `${c.id}=${c.score}`).join(" ");
    console.log(
      `${name}: total=${r.total} grade=${r.grade} ` +
        `issues(e/r/g)=${r.issueCounts.error}/${r.issueCounts.review}/${r.issueCounts.good} ${cats}`,
    );
  }
  const clean: ParseSignals = {
    hasTables: false,
    hasImages: false,
    hasUnusualFormatting: false,
    spellingIssues: [],
    extractionConfidence: "high",
  };
  const dirty: ParseSignals = {
    hasTables: true,
    hasImages: true,
    hasUnusualFormatting: true,
    spellingIssues: [
      { word: "recieve", context: "", suggestion: "receive" },
      { word: "seperate", context: "", suggestion: "separate" },
      { word: "occured", context: "", suggestion: "occurred" },
    ],
    extractionConfidence: "medium",
  };
  for (const [label, signals] of [["clean", clean], ["dirty", dirty]] as const) {
    const r = computeScore(STRONG_FINANCE, { mode: "checker", parseSignals: signals });
    console.log(`STRONG_FINANCE checker/${label}: total=${r.total} grade=${r.grade}`);
  }
}

// --- 1. Golden scores (observed 2026-07, then locked) -----------------------

// grade thresholds the engine used when these were captured: >=85 excellent,
// >=65 good, >=40 needs-work, else poor (gradeFromTotal).
// Re-captured twice, both consciously:
//   * S3/A2 (phone) + S6/C1 (summary) duplicate-signal removal: -6 raw pts;
//   * A12–A14 UAE essentials (visa 2, availability 1, licence 1): +4 raw pts.
// Builder-mode denominator: 92 -> 86 -> 90. Checker: 102 -> 96 -> 100.
const GOLDEN: Record<string, { total: number; grade: ScoreGrade }> = {
  EMPTY: { total: 0, grade: "poor" },
  MINIMAL: { total: 21, grade: "poor" },
  MID_WEAK: { total: 72, grade: "good" },
  STRONG_FINANCE: { total: 100, grade: "excellent" },
  // 82/"good" now, down from 87/"excellent". Two independent reasons: the
  // engine still only docks C4/C9/C10/D3/D6/D7 for verbosity (13 pts of 90),
  // but OVERLONG also carries none of the UAE essentials, so it now forfeits
  // all 4 of those points and falls under the 85 "excellent" line. Locked in
  // on purpose — if verbosity weighting is ever tightened, this golden should
  // fail and be updated consciously.
  OVERLONG: { total: 82, grade: "good" },
  UAE_COMPLETE: { total: 100, grade: "excellent" },
  // 96, not 100 — the whole point of A12–A14. 4 raw points of 90.
  UAE_MISSING: { total: 96, grade: "excellent" },
};

describe("golden scores (characterization)", () => {
  for (const [name, cv] of Object.entries(FIXTURES)) {
    test(`${name} total + grade are stable`, () => {
      const r = computeScore(cv);
      assert.equal(r.total, GOLDEN[name].total, `${name} total drifted`);
      assert.equal(r.grade, GOLDEN[name].grade, `${name} grade drifted`);
    });
  }

  test("MID_WEAK category subscores + issue counts are stable", () => {
    const r = computeScore(MID_WEAK);
    const byId = Object.fromEntries(r.categories.map((c) => [c.id, c.score]));
    assert.deepEqual(byId, {
      content: 48, // weak phrases, no metrics in summary, thin quantification
      sections: 100,
      atsEssentials: 82, // no visa / notice period / licence (A12–A14)
      design: 70, // < 10 skills, < 300 words
    });
    // good 28, not 30: MID_WEAK passed both of the removed duplicate signals
    // (S3 phone, S6 summary), so it loses two "good" rows and no fixes.
    // review 10, not 7: the three unfilled UAE essentials are new review rows.
    assert.deepEqual(r.issueCounts, { error: 2, review: 10, good: 28 });
  });

  test("report shape: 4 categories in canonical order, weights sum to 1", () => {
    const r = computeScore(MID_WEAK);
    assert.deepEqual(
      r.categories.map((c) => c.id),
      ["content", "sections", "atsEssentials", "design"],
    );
    const weightSum = r.categories.reduce((s, c) => s + c.weight, 0);
    assert.ok(Math.abs(weightSum - 1) < 1e-9);
  });

  test("derived stats characterize the strong fixture", () => {
    const s = computeDerivedStats(STRONG_FINANCE);
    assert.equal(s.totalBullets, 15);
    assert.equal(s.measurableBullets, 14); // one KPMG bullet has no digits
    assert.equal(s.uaeFilledCount, 3);
    assert.equal(s.expectedPages, 2); // 3 roles > 2-role single-page heuristic
    assert.equal(computeDerivedStats(MINIMAL).expectedPages, 1);
  });
});

// --- 1b. No signal is charged twice -----------------------------------------
//
// Phone was checked identically by S3 (Sections) and A2 (ATS), and summary
// presence by S6 (Sections) and C1 (Content). One empty field cost 6 points
// and produced two near-identical rows on the report. S3 and S6 were removed;
// these tests pin the single-charge behaviour so a duplicate can't creep back.

describe("duplicate signals are charged once", () => {
  const RAW_MAX_BUILDER = 90; // sum of applicable sub-signal points, builder mode

  const expectedAfterLosing = (points: number) =>
    Math.round(((RAW_MAX_BUILDER - points) / RAW_MAX_BUILDER) * 100);

  test("clearing ONLY the phone costs one 3-point signal, not two", () => {
    const noPhone = clone(STRONG_FINANCE);
    noPhone.personal.phone = "";
    // 3 points of 90 => 97. Before the dedupe this was 6 of 92 => 93.
    assert.equal(computeScore(noPhone).total, expectedAfterLosing(3));
    assert.equal(computeScore(noPhone).total, 97);
  });

  test("clearing ONLY the summary costs one 3-point presence signal", () => {
    const noSummary = clone(STRONG_FINANCE);
    noSummary.personal.summary = "";
    // C1 (presence, 3) is the only presence charge now. C2/C3 also fail, and
    // C4 goes not-applicable — so this asserts the phone-style single charge
    // via the issue list rather than the total.
    const r = computeScore(noSummary);
    const summaryPresenceIssues = r.categories
      .flatMap((c) => c.issues)
      .filter((i) => /no summary section|add a professional summary/i.test(i.title));
    assert.equal(
      summaryPresenceIssues.length,
      1,
      `a missing summary should raise exactly one presence issue, got ${summaryPresenceIssues
        .map((i) => `${i.signal}:${i.title}`)
        .join(" | ")}`,
    );
  });

  test("a missing phone raises exactly one issue row", () => {
    const noPhone = clone(STRONG_FINANCE);
    noPhone.personal.phone = "";
    const phoneIssues = computeScore(noPhone)
      .categories.flatMap((c) => c.issues)
      .filter((i) => /phone/i.test(i.title));
    assert.equal(phoneIssues.length, 1, "one empty field, one row");
    assert.equal(phoneIssues[0].signal, "A2", "ATS is the surviving home");
  });
});

// --- 2. Monotonicity invariants ---------------------------------------------

/** A bullet that satisfies every per-bullet signal: action verb first,
 *  quantified, < 40 words, no weak phrase, no emoji. */
const GOOD_BULLET =
  "Reduced procurement costs by 14% across 6 supplier categories";

function withExtraBullet(cv: CvData): CvData {
  const next = clone(cv);
  next.experience[0].bullets.push(GOOD_BULLET);
  return next;
}

describe("monotonicity invariants", () => {
  for (const name of ["MID_WEAK", "STRONG_FINANCE", "OVERLONG"] as const) {
    test(`adding a quantified action-verb bullet never lowers ${name}`, () => {
      const before = computeScore(FIXTURES[name]).total;
      const after = computeScore(withExtraBullet(FIXTURES[name])).total;
      assert.ok(
        after >= before,
        `${name}: total dropped ${before} -> ${after} after adding a strong bullet`,
      );
    });
  }

  test("clearing visa status lowers the UAE-completeness count, never raises it", () => {
    const complete = computeDerivedStats(UAE_COMPLETE);
    assert.equal(complete.uaeFilledCount, 3);

    const noVisa = clone(UAE_COMPLETE);
    delete noVisa.personal.visaStatus;
    const after = computeDerivedStats(noVisa);
    assert.ok(after.uaeFilledCount <= complete.uaeFilledCount);
    assert.equal(after.uaeFilledCount, 2);

    assert.equal(computeDerivedStats(UAE_MISSING).uaeFilledCount, 0);
    // Clearing a field that is already absent keeps the count unchanged.
    const stillMissing = clone(UAE_MISSING);
    delete stillMissing.personal.visaStatus;
    assert.equal(computeDerivedStats(stillMissing).uaeFilledCount, 0);
  });

  test("UAE-essentials fields DO move the 0-100 total (A12–A14)", () => {
    // Was the inverse assertion until A12–A14 were added: visa/availability/
    // licence used to feed computeDerivedStats and the builder's UAE step UI
    // only, so the engine scored a fully-filled UAE CV identically to one with
    // none. On a UAE-focused builder that was simply wrong.
    const complete = computeScore(UAE_COMPLETE).total;
    const missing = computeScore(UAE_MISSING).total;
    assert.ok(complete > missing, `${complete} should beat ${missing}`);
    assert.equal(complete, 100);
    assert.equal(missing, 96); // 4 raw points of the 90-point builder max
  });

  test("each UAE essential is worth its stated points, independently", () => {
    const total = (mutate: (cv: CvData) => void) => {
      const cv = clone(UAE_COMPLETE);
      mutate(cv);
      return computeScore(cv).total;
    };
    const full = computeScore(UAE_COMPLETE).total;
    const RAW_MAX = 90;
    const drop = (points: number) =>
      full - Math.round(((RAW_MAX - points) / RAW_MAX) * 100);

    // visa 2, availability 1, licence 1.
    assert.equal(full - total((cv) => delete cv.personal.visaStatus), drop(2));
    assert.equal(full - total((cv) => delete cv.personal.availability), drop(1));
    assert.equal(full - total((cv) => delete cv.personal.drivingLicense), drop(1));
  });

  test("filling a UAE essential never lowers the total", () => {
    const base = computeScore(UAE_MISSING).total;
    for (const field of ["visaStatus", "availability", "drivingLicense"] as const) {
      const cv = clone(UAE_MISSING);
      cv.personal[field] = "Yes";
      assert.ok(
        computeScore(cv).total >= base,
        `filling ${field} lowered the total ${base} -> ${computeScore(cv).total}`,
      );
    }
  });

  test("dirty parseSignals never beat clean ones (checker mode)", () => {
    const clean = computeScore(STRONG_FINANCE, {
      mode: "checker",
      parseSignals: {
        hasTables: false,
        hasImages: false,
        hasUnusualFormatting: false,
        spellingIssues: [],
        extractionConfidence: "high",
      },
    });
    const dirty = computeScore(STRONG_FINANCE, {
      mode: "checker",
      parseSignals: {
        hasTables: true,
        hasImages: true,
        hasUnusualFormatting: true,
        spellingIssues: [
          { word: "recieve", context: "", suggestion: "receive" },
          { word: "seperate", context: "", suggestion: "separate" },
          { word: "occured", context: "", suggestion: "occurred" },
        ],
        extractionConfidence: "medium",
      },
    });
    assert.ok(dirty.total < clean.total);
    // Golden checker-mode totals (observed, then locked). The 10 conditional
    // points (C12 C13 A3 A4 A5) all pass on clean signals and all fail on
    // dirty ones: 100/100 -> 100 vs 90/100 -> 90. (The checker max moved
    // 102 -> 96 -> 100 across the dedupe and the UAE essentials; the two
    // totals happen to land on the same numbers they had before.)
    assert.equal(clean.total, 100);
    assert.equal(dirty.total, 90);
  });
});

// --- 3. Grade thresholds ↔ ScoreChip tiers ----------------------------------

// Mirror of gradeFromTotal (lib/scoreEngine.ts) at capture time.
function expectedGrade(total: number): ScoreGrade {
  if (total >= 85) return "excellent";
  if (total >= 65) return "good";
  if (total >= 40) return "needs-work";
  return "poor";
}

// Mirror of TIER_BY_GRADE in components/builder/ScoreChip.tsx — the chip
// derives its color tier from report.grade, so the engine's grade set and
// thresholds ARE the chip contract.
const TIER_BY_GRADE: Record<ScoreGrade, "danger" | "warn" | "ok" | "great"> = {
  poor: "danger",
  "needs-work": "warn",
  good: "ok",
  excellent: "great",
};

describe("grade thresholds map to the ScoreChip tiers", () => {
  test("every fixture's grade matches the 85/65/40 threshold table", () => {
    for (const [name, cv] of Object.entries(FIXTURES)) {
      const r = computeScore(cv);
      assert.equal(
        r.grade,
        expectedGrade(r.total),
        `${name}: grade ${r.grade} disagrees with total ${r.total}`,
      );
    }
  });

  test("chip tier derived from grade equals tier derived from total", () => {
    for (const [name, cv] of Object.entries(FIXTURES)) {
      const r = computeScore(cv);
      assert.equal(
        TIER_BY_GRADE[r.grade],
        TIER_BY_GRADE[expectedGrade(r.total)],
        `${name}: ScoreChip would color-code a different tier than the total implies`,
      );
    }
  });

  test("label tables cover exactly the four grades the chip knows", () => {
    const grades = Object.keys(TIER_BY_GRADE).sort();
    assert.deepEqual(Object.keys(GRADE_LABELS).sort(), grades);
    assert.deepEqual(Object.keys(GRADE_CHIP_LABELS).sort(), grades);
    for (const g of grades as ScoreGrade[]) {
      assert.ok(GRADE_LABELS[g].length > 0);
      assert.ok(GRADE_CHIP_LABELS[g].length > 0);
    }
  });
});
