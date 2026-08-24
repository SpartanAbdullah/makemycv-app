// Unified scoring engine for MakeMyCV.
//
// One engine, one output shape, consumed by both /builder and /resume-checker.
// Input: CvData (and optionally ParseSignals from the Claude parser).
// Output: ScoreReport — 4 weighted categories, per-sub-signal issues with
// severity and actionable copy, per-category FAQs.
//
// Weight model (approved 2026-04-19):
//   Content 30 + Section Structure 25 + ATS Essentials 25 + Design 20 = 100
//   No sub-signal is worth more than 3 points.
//   10 points depend on ParseSignals (tables/images/formatting/spelling).
//   In builder mode without parseSignals those 10 pts are excluded from
//   numerator AND denominator — parity with checker mode is preserved when
//   the CV was imported with its parseSignals (see the import endpoint).

import type { CvData } from "./types/cv";
import { findWeakPhrases } from "./data/genericPhrases";
import type {
  ParseSignals,
  ScoreCategory,
  ScoreCategoryId,
  ScoreFaq,
  ScoreGrade,
  ScoreIssue,
  ScoreReport,
  ScoreSeverity,
} from "./resumeChecker/types";

export type ScoreMode = "builder" | "checker";

export type ScoreOptions = {
  mode?: ScoreMode;
  parseSignals?: ParseSignals;
};

// --- The ONE label table (audit §4, symptom b) ---
//
// Every consumer (Review hero, TopBar chip, any future surface) derives its
// label from `report.grade`, which is derived from `report.total` by
// gradeFromTotal below. Hardcoding thresholds anywhere else is how the
// 65–69 band ended up "Strong CV" on Review and amber "Fair" in the TopBar
// at the same time. Don't reintroduce a second table.

/** Long-form labels for hero/summary surfaces. */
export const GRADE_LABELS: Record<ScoreGrade, string> = {
  excellent: "Outstanding CV",
  good: "Strong CV",
  "needs-work": "Almost there",
  poor: "Getting started",
};

/** Short labels for compact surfaces (TopBar chip). Same grade, same
 *  thresholds — only the wording is shorter. */
export const GRADE_CHIP_LABELS: Record<ScoreGrade, string> = {
  excellent: "Excellent",
  good: "Strong",
  "needs-work": "Almost there",
  poor: "Needs work",
};

// --- Derived stats (audit §4) ---
//
// The Review step used to re-implement these with subtly different rules
// (untrimmed bullets, its own /\d/ test), so "X of Y measurable bullets"
// could disagree with what the engine actually scored. One implementation,
// engine-consistent trimming.

export type ScoreDerivedStats = {
  totalBullets: number;
  measurableBullets: number;
  /** visaStatus / availability / drivingLicense filled, 0–3. */
  uaeFilledCount: number;
  expectedPages: 1 | 2;
};

export function computeDerivedStats(cv: CvData): ScoreDerivedStats {
  const bullets = cv.experience.flatMap((e) =>
    e.bullets.map((b) => b.trim()).filter(Boolean),
  );
  const measurableBullets = bullets.filter((b) => /\d/.test(b)).length;
  const uaeFilledCount = [
    cv.personal.visaStatus,
    cv.personal.availability,
    cv.personal.drivingLicense,
  ].filter((v) => v && v.trim()).length;
  const expectedPages: 1 | 2 =
    cv.experience.length <= 2 && bullets.length <= 8 ? 1 : 2;
  return {
    totalBullets: bullets.length,
    measurableBullets,
    uaeFilledCount,
    expectedPages,
  };
}

// --- Word / text helpers ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const DATE_HINT_REGEX = /\d{4}|present|current/i;

const ACTION_VERBS = new Set([
  "led","managed","built","designed","developed","implemented","launched",
  "delivered","owned","drove","grew","increased","reduced","improved",
  "streamlined","optimised","optimized","automated","created","established",
  "founded","spearheaded","coordinated","orchestrated","executed","shipped",
  "architected","engineered","authored","negotiated","trained","mentored",
  "analysed","analyzed","researched","produced","rolled","scaled","migrated",
  "refactored","integrated","deployed","secured","audited","directed",
  "facilitated","generated","accelerated","introduced","resolved","eliminated",
  "supervised","oversaw","pioneered","transformed","supported","guided",
  "prepared","presented","conducted","evaluated","planned","reviewed",
]);

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function startsWithActionVerb(bullet: string): boolean {
  const first = bullet.trim().replace(/^[-•*›\s]+/, "").split(/\s+/)[0];
  if (!first) return false;
  return ACTION_VERBS.has(first.toLowerCase().replace(/[^a-z]/g, ""));
}

// --- Sub-signal framework ---

type SubSignal = {
  id: string;
  category: ScoreCategoryId;
  points: number;
  /** Passes if the CV satisfies the sub-signal. */
  pass: boolean;
  /** True if this sub-signal depends on parseSignals. Excluded from both
   *  numerator and denominator when parseSignals is not supplied. */
  conditional: boolean;
  /** False when there is no input to judge (e.g. "summary ≤ 200 words"
   *  with no summary). Not-applicable signals are excluded from numerator
   *  AND denominator and emit no issue — a blank CV must not collect
   *  vacuous passes and green "what's working" rows (audit §4 symptom c). */
  applicable: boolean;
  /** Issue to attach to the output. When pass=true, severity='good'. */
  issue: ScoreIssue;
};

const CATEGORY_META: Record<
  ScoreCategoryId,
  { name: string; weight: number; faqs: ScoreFaq[] }
> = {
  content: {
    name: "Content",
    weight: 0.3,
    faqs: [
      {
        q: "Why does quantifying impact matter?",
        a: "Recruiters scan for measurable outcomes. 'Increased sales by 30%' beats 'improved sales' every time. UAE hiring managers in particular prioritise candidates who frame work as results.",
      },
      {
        q: "How many bullets per role?",
        a: "3–6 bullets per role. Focus on impact, not responsibilities. Your current role can run slightly longer; older roles should shrink.",
      },
      {
        q: "What's a strong action verb?",
        a: "Verbs that describe what you did: Led, Built, Delivered, Reduced, Negotiated. Avoid 'Responsible for' or 'Duties included' — they describe a job, not an achievement.",
      },
    ],
  },
  sections: {
    name: "Section Structure",
    weight: 0.25,
    faqs: [
      {
        q: "Which sections are actually required?",
        a: "Contact, Experience, Education, and Skills. Summary is strongly recommended. Certifications and Languages are optional but valued in the UAE market.",
      },
      {
        q: "Should I use creative section titles?",
        a: "No. 'Work Experience', 'Education', 'Skills' — plain labels are what ATS parsers look for. 'My Journey' or 'What I Bring' confuse the filter.",
      },
    ],
  },
  atsEssentials: {
    name: "ATS Essentials",
    weight: 0.25,
    faqs: [
      {
        q: "Why are tables flagged?",
        a: "Tables render fine in Word but most ATS engines read them column-by-column or skip them entirely. Key info ends up jumbled or missing from the parse.",
      },
      {
        q: "Should I include a photo?",
        a: "Some GCC employers still expect it. If you include one, keep it as a separate image in a header area — and make sure the text content reads fine without it.",
      },
      {
        q: "What date format should I use?",
        a: "'Jan 2023 – Present' or '2021 – 2024' both parse cleanly. Avoid date ranges written as sentences ('from spring of 2019 until late 2022').",
      },
    ],
  },
  design: {
    name: "Design & Formatting",
    weight: 0.2,
    faqs: [
      {
        q: "One page or two?",
        a: "Two pages is standard for 5+ years of experience in the UAE. One page works for early-career. Three pages is too long unless you're academic or executive.",
      },
      {
        q: "How many skills should I list?",
        a: "10–20 specific, relevant skills. More than 30 reads as keyword stuffing — ATS scoring models sometimes penalise it, and recruiters ignore it.",
      },
      {
        q: "Can I use colour?",
        a: "A single accent colour is fine. Avoid dense colour blocks or white text on dark — some ATS engines can't read white text and it'll be treated as blank.",
      },
    ],
  },
};

// Short helper to build a SubSignal in one line.
function sig(
  id: string,
  category: ScoreCategoryId,
  points: number,
  pass: boolean,
  severity: ScoreSeverity,
  issue: Omit<ScoreIssue, "id" | "severity" | "signal">,
  conditional = false,
  applicable = true,
): SubSignal {
  return {
    id,
    category,
    points,
    pass,
    conditional,
    applicable,
    issue: {
      id,
      severity,
      signal: id,
      title: issue.title,
      description: issue.description,
      actionable: issue.actionable,
    },
  };
}

// --- Sub-signal evaluation ---

function evaluateContent(
  cv: CvData,
  signals: ParseSignals | undefined,
  mode: ScoreMode,
): SubSignal[] {
  const p = cv.personal;
  const summary = p.summary.trim();
  const summaryWords = wordCount(summary);
  const allBullets = cv.experience.flatMap((e) =>
    e.bullets.map((b) => b.trim()).filter(Boolean),
  );
  const roleCount = cv.experience.filter(
    (e) => e.company.trim() || e.role.trim(),
  ).length;

  const out: SubSignal[] = [];

  // C1 Summary present (3) — the ONLY summary-presence signal. The former S6
  // in Sections ran the identical check and has been removed; its ATS-heading
  // rationale is folded into the copy here.
  {
    const pass = summary.length > 0;
    out.push(
      sig("C1", "content", 3, pass, pass ? "good" : "error", {
        title: pass
          ? "Summary present"
          : mode === "builder"
            ? "Add a professional summary"
            : "No summary section detected",
        description: pass
          ? "Your summary opens the CV with a positioning statement, not a job list."
          : "Recruiters read the summary first. Without one, the CV opens cold — and some ATS parsers rely on the 'Summary' heading to identify the professional profile at all.",
        actionable: pass
          ? ""
          : "Add a section titled 'Summary' or 'Professional Profile' above your experience, with 40–60 words covering years of experience, industry, and one quantified result.",
      }),
    );
  }

  // C2 Summary length ≥ 40 words (3)
  {
    const pass = summaryWords >= 40;
    out.push(
      sig("C2", "content", 3, pass, pass ? "good" : summary ? "review" : "error", {
        title: pass
          ? "Summary is a healthy length"
          : summary
            ? `Summary is ${summaryWords} word${summaryWords === 1 ? "" : "s"} — expand to 40+`
            : "Summary too short to score",
        description: pass
          ? `${summaryWords} words — enough room for experience, specialism, and a proof point.`
          : "A short summary reads like a placeholder. 40–60 words gives enough room for experience, specialism, and a proof point.",
        actionable: pass
          ? ""
          : "Expand to include years of experience, industry focus, and one quantified outcome.",
      }),
    );
  }

  // C3 Summary contains number/metric (3)
  {
    const pass = summary.length > 0 && /\d/.test(summary);
    out.push(
      sig("C3", "content", 3, pass, pass ? "good" : "review", {
        title: pass
          ? "Summary includes a concrete number"
          : "Summary has no numbers or metrics",
        description: pass
          ? "Numbers signal outcomes. Recruiters read this first and it sets the tone."
          : "'Strong background in ops' is forgettable. 'Managed 25-person ops team, cut cost by 18%' is not.",
        actionable: pass
          ? ""
          : "Add one sentence with a specific metric (team size, revenue, project count, % improvement).",
      }),
    );
  }

  // C4 Summary ≤ 200 words (1) — N/A with no summary (an empty summary must
  // not earn a vacuous "concise" pass).
  {
    const pass = summaryWords <= 200;
    out.push(
      sig(
        "C4",
        "content",
        1,
        pass,
        pass ? "good" : "review",
        {
          title: pass ? "Summary is concise" : "Summary is too long",
          description: pass
            ? "Under 200 words keeps the summary scannable."
            : `${summaryWords} words. Recruiters skim the first 10 seconds — long summaries get skipped.`,
          actionable: pass ? "" : "Trim to 2–4 sentences. Keep the metric, drop the adjectives.",
        },
        false,
        summary.length > 0,
      ),
    );
  }

  // C5 ≥ 50% bullets start with action verb (3)
  {
    const verbCount = allBullets.filter(startsWithActionVerb).length;
    const ratio = allBullets.length > 0 ? verbCount / allBullets.length : 0;
    const pass = allBullets.length > 0 && ratio >= 0.5;
    out.push(
      sig("C5", "content", 3, pass, pass ? "good" : "error", {
        title: pass
          ? "Bullets lead with action verbs"
          : allBullets.length === 0
            ? "No bullets to evaluate"
            : `${allBullets.length - verbCount} of ${allBullets.length} bullets don't start with action verbs`,
        description: pass
          ? `${verbCount} of ${allBullets.length} bullets start with a verb like 'Led', 'Built', 'Reduced'.`
          : "Bullets that start with 'Responsible for' or 'Duties included' read as job descriptions, not achievements.",
        actionable: pass
          ? ""
          : "Rewrite bullets to start with verbs like 'Led', 'Built', 'Delivered', 'Reduced'.",
      }),
    );
  }

  // C6 ≥ 70% bullets start with action verb (2) — stretch
  {
    const verbCount = allBullets.filter(startsWithActionVerb).length;
    const ratio = allBullets.length > 0 ? verbCount / allBullets.length : 0;
    const pass = allBullets.length > 0 && ratio >= 0.7;
    out.push(
      sig("C6", "content", 2, pass, pass ? "good" : "review", {
        title: pass
          ? "Nearly every bullet opens with action"
          : "Action-verb coverage could be higher",
        description: pass
          ? "70%+ of bullets lead with a strong verb. Recruiters can scan the first word and absorb the achievement."
          : "Some bullets still open passively. Tightening these lifts the whole CV.",
        actionable: pass ? "" : "Audit bullets that open with 'Was', 'Had', 'Responsible for' — rewrite each.",
      }),
    );
  }

  // C7 ≥ 25% bullets contain a number (3)
  {
    const numCount = allBullets.filter((b) => /\d/.test(b)).length;
    const ratio = allBullets.length > 0 ? numCount / allBullets.length : 0;
    const pass = allBullets.length > 0 && ratio >= 0.25;
    out.push(
      sig("C7", "content", 3, pass, pass ? "good" : "error", {
        title: pass
          ? `${numCount} of ${allBullets.length} bullets quantify impact`
          : allBullets.length === 0
            ? "No bullets to evaluate"
            : `Only ${numCount} of ${allBullets.length} bullets contain numbers`,
        description: pass
          ? "Numbers, percentages, and currency anchor your bullets in outcomes."
          : "Recruiters scan for measurable outcomes. Bullets without metrics are easy to skip.",
        actionable: pass
          ? ""
          : "For each unquantified bullet, ask: how much? how many? by when? Add at least one number.",
      }),
    );
  }

  // C8 ≥ 50% bullets contain a number (2) — stretch
  {
    const numCount = allBullets.filter((b) => /\d/.test(b)).length;
    const ratio = allBullets.length > 0 ? numCount / allBullets.length : 0;
    const pass = allBullets.length > 0 && ratio >= 0.5;
    out.push(
      sig("C8", "content", 2, pass, pass ? "good" : "review", {
        title: pass ? "Half your bullets have hard numbers" : "Metric coverage could be stronger",
        description: pass
          ? "50%+ of bullets land on a number. That's a strong signal of outcome-focus."
          : "Lifting past half gives the CV a consistent outcome tone.",
        actionable: pass ? "" : "Target half your bullets quantifying a result — revenue, team size, time saved.",
      }),
    );
  }

  // C9 All bullets ≤ 40 words (3)
  {
    const longBullets = allBullets.filter((b) => wordCount(b) > 40).length;
    const pass = allBullets.length > 0 && longBullets === 0;
    out.push(
      sig("C9", "content", 3, pass, pass ? "good" : "review", {
        title: pass
          ? "Bullets are scan-friendly"
          : `${longBullets} bullet${longBullets === 1 ? "" : "s"} read as paragraph${longBullets === 1 ? "" : "s"}`,
        description: pass
          ? "Every bullet is under 40 words — that's what makes bullet points work."
          : "Bullets over 40 words lose the scan-ability that makes bullet points work.",
        actionable: pass ? "" : "Split long bullets into two. Each bullet should be one sentence, under 25 words.",
      }),
    );
  }

  // C10 No bullet > 60 words (2) — N/A with zero bullets.
  {
    const hugeBullets = allBullets.filter((b) => wordCount(b) > 60).length;
    const pass = hugeBullets === 0;
    out.push(
      sig(
        "C10",
        "content",
        2,
        pass,
        pass ? "good" : "error",
        {
          title: pass
            ? "No paragraph-length bullets"
            : `${hugeBullets} bullet${hugeBullets === 1 ? " runs" : "s run"} past 60 words`,
          description: pass
            ? "Good — no bullets have drifted into paragraph territory."
            : "60+ words defeats the purpose of using bullets. Recruiters won't read them.",
          actionable: pass ? "" : "Rewrite each as a single crisp sentence. Two ideas = two bullets.",
        },
        false,
        allBullets.length > 0,
      ),
    );
  }

  // C11 ≥ 1 bullet per role (2)
  {
    const rolesWithBullets = cv.experience.filter(
      (e) => (e.company.trim() || e.role.trim()) && e.bullets.some((b) => b.trim()),
    ).length;
    const pass = roleCount > 0 && rolesWithBullets === roleCount;
    out.push(
      sig("C11", "content", 2, pass, pass ? "good" : roleCount === 0 ? "review" : "error", {
        title: pass
          ? "Every role has at least one bullet"
          : roleCount === 0
            ? "No experience entries to evaluate"
            : `${roleCount - rolesWithBullets} role${roleCount - rolesWithBullets === 1 ? "" : "s"} have no bullets`,
        description: pass
          ? "Each role says what you did, not just that you were there."
          : "Roles without bullets read as a title-and-dates stub.",
        actionable: pass ? "" : "Add 3–6 bullets per role describing what you did and the result.",
      }),
    );
  }

  // C12 No spelling issues (2) — CONDITIONAL on parseSignals
  {
    const spellingIssues = signals?.spellingIssues ?? [];
    const pass = spellingIssues.length === 0;
    out.push(
      sig(
        "C12",
        "content",
        2,
        pass,
        pass ? "good" : "review",
        {
          title: pass ? "No spelling issues flagged" : `${spellingIssues.length} spelling issue${spellingIssues.length === 1 ? "" : "s"} flagged`,
          description: pass
            ? "The parser found no obvious typos."
            : spellingIssues
                .slice(0, 3)
                .map((s) => `"${s.word}" → ${s.suggestion}`)
                .join("; "),
          actionable: pass ? "" : "Review each flagged word. These are heuristic — confirm before changing.",
        },
        true,
      ),
    );
  }

  // C13 Fewer than 3 spelling issues (1) — CONDITIONAL
  {
    const count = signals?.spellingIssues.length ?? 0;
    const pass = count < 3;
    out.push(
      sig(
        "C13",
        "content",
        1,
        pass,
        pass ? "good" : "error",
        {
          title: pass ? "Spelling volume is manageable" : "Many possible spelling issues",
          description: pass
            ? ""
            : "Multiple flagged words. A CV with visible typos gets filtered out before a human sees it.",
          actionable: pass ? "" : "Run the CV through a spell checker. Pay attention to proper nouns and company names.",
        },
        true,
      ),
    );
  }

  // C14 No weak / generic filler phrases (2) — N/A when there is no text.
  // The universal cross-domain failure mode: "responsible for", "team player",
  // "proven track record" describe a job, not an achievement, and carry no ATS
  // signal (lib/data/genericPhrases.ts).
  {
    const weakText = [summary, ...allBullets].join(" ");
    const found = findWeakPhrases(weakText);
    const pass = found.length === 0;
    out.push(
      sig(
        "C14",
        "content",
        2,
        pass,
        pass ? "good" : "review",
        {
          title: pass
            ? "No generic filler phrases"
            : `${found.length} weak phrase${found.length === 1 ? "" : "s"} to rewrite`,
          description: pass
            ? "Your wording frames achievements, not job duties."
            : `Phrases like "${found.slice(0, 3).join('", "')}" describe a job, not an achievement, and carry no ATS signal.`,
          actionable: pass
            ? ""
            : "Swap each for a strong verb + result (e.g. 'Responsible for sales' → 'Grew sales 30% …').",
        },
        false,
        weakText.trim().length > 0,
      ),
    );
  }

  return out;
}

function evaluateSections(cv: CvData, mode: ScoreMode): SubSignal[] {
  const p = cv.personal;
  const hasName = Boolean(p.firstName.trim() || p.lastName.trim());
  const expEntries = cv.experience.filter((e) => e.company.trim() || e.role.trim());
  const eduEntries = cv.education.filter((e) => e.school.trim() || e.degree.trim());

  const out: SubSignal[] = [];

  // S2 Email present (3)
  out.push(
    sig(
      "S2",
      "sections",
      3,
      Boolean(p.email.trim()),
      p.email.trim() ? "good" : "error",
      {
        title: p.email.trim() ? "Email present" : mode === "builder" ? "Add your email address" : "No email detected",
        description: "UAE recruiters and ATS systems filter by email first.",
        actionable: p.email.trim() ? "" : "Add a professional email in the contact section.",
      },
    ),
  );

  // S3 (Phone present, 3) was REMOVED — it was byte-identical to A2 in ATS
  // Essentials, so one empty phone field cost 6 points and produced two
  // near-identical issue rows on the report. A2 is the surviving home for the
  // signal and inherited S3's copy. IDs are deliberately NOT renumbered:
  // ScoreIssue.signal is documented as a stable key for weight tuning and
  // tests, so a gap is cheaper than a silent re-mapping.

  // S4 Location present (3)
  out.push(
    sig(
      "S4",
      "sections",
      3,
      Boolean(p.location.trim()),
      p.location.trim() ? "good" : "review",
      {
        title: p.location.trim() ? "Location present" : "No location detected",
        description: "Many UAE ATS systems filter by city or emirate. Missing location can deprioritise you in location-gated searches.",
        actionable: p.location.trim() ? "" : "Add your city or emirate (e.g. 'Dubai, UAE').",
      },
    ),
  );

  // S5 LinkedIn OR personal website (2)
  {
    const has = Boolean(p.linkedin.trim() || p.website.trim());
    out.push(
      sig("S5", "sections", 2, has, has ? "good" : "review", {
        title: has ? "Online presence linked" : "No LinkedIn or personal site",
        description: has
          ? "Your LinkedIn or website gives recruiters a second channel to vet your profile."
          : "Most UAE recruiters check LinkedIn before calling. Missing link = missing context.",
        actionable: has ? "" : "Add your LinkedIn URL (and a portfolio/website if relevant).",
      }),
    );
  }

  // S6 (Summary populated, 3) was REMOVED — same duplicate-signal problem as
  // S3: it tested `p.summary.trim()`, exactly what C1 already tests in
  // Content, so a missing summary was charged twice. C1 is the surviving home
  // and absorbed the ATS-heading rationale from this signal's copy.

  // S7 ≥ 1 experience entry (3)
  {
    const pass = expEntries.length >= 1;
    out.push(
      sig("S7", "sections", 3, pass, pass ? "good" : "error", {
        title: pass ? "Experience section populated" : "No work experience detected",
        description: pass
          ? `${expEntries.length} role${expEntries.length === 1 ? "" : "s"} listed.`
          : "Either experience is missing or the heading wasn't standard.",
        actionable: pass ? "" : "Use a clear 'Experience' or 'Work Experience' heading above your roles.",
      }),
    );
  }

  // S8 ≥ 2 experience entries (1)
  {
    const pass = expEntries.length >= 2;
    out.push(
      sig("S8", "sections", 1, pass, pass ? "good" : "review", {
        title: pass ? "Career progression visible" : "Only one experience entry",
        description: pass
          ? "Multiple roles show progression and specialism — recruiters like the pattern."
          : "One role reads as either early-career or thin. Either is fine if that's where you are; otherwise add the prior role.",
        actionable: pass ? "" : "Add the role before this one, even in brief, to show progression.",
      }),
    );
  }

  // S9 All experience entries complete (3)
  {
    if (expEntries.length === 0) {
      out.push(
        sig("S9", "sections", 3, false, "review", {
          title: "No experience to evaluate",
          description: "",
          actionable: "Add at least one experience entry with role, company, and start date.",
        }),
      );
    } else {
      const complete = expEntries.filter(
        (e) => e.role.trim() && e.company.trim() && e.startDate.trim(),
      ).length;
      const pass = complete === expEntries.length;
      out.push(
        sig("S9", "sections", 3, pass, pass ? "good" : "error", {
          title: pass
            ? "Every role has title, company, and dates"
            : `${expEntries.length - complete} of ${expEntries.length} roles are missing fields`,
          description: pass
            ? "Clean, complete entries — what the ATS expects."
            : "Each role needs a title, company, and start date. Missing any of those reads as a draft or parser miss.",
          actionable: pass ? "" : "Fill in the missing fields. If a date is unknown, use 'YYYY' — better than blank.",
        }),
      );
    }
  }

  // S10 ≥ 1 education entry (2)
  {
    const pass = eduEntries.length >= 1;
    out.push(
      sig("S10", "sections", 2, pass, pass ? "good" : "review", {
        title: pass ? "Education section present" : "No education entry",
        description: pass
          ? ""
          : "UAE employers typically expect an education block, even for senior roles.",
        actionable: pass ? "" : "Add an 'Education' section with your highest qualification first.",
      }),
    );
  }

  // S11 ≥ 1 skill (2)
  {
    const pass = cv.skills.length >= 1;
    out.push(
      sig("S11", "sections", 2, pass, pass ? "good" : "error", {
        title: pass ? "Skills section populated" : "No skills listed",
        description: pass
          ? ""
          : "Skills sections are where ATS keyword matches happen. Without one, you're likely filtered out.",
        actionable: pass ? "" : "Add a 'Skills' section with 8–15 specific, relevant skills.",
      }),
    );
  }

  // hasName is used only to shape messaging; no explicit sub-signal (dropped per approved weights).
  void hasName;

  return out;
}

function evaluateAts(
  cv: CvData,
  signals: ParseSignals | undefined,
  mode: ScoreMode,
): SubSignal[] {
  const p = cv.personal;
  const expEntries = cv.experience.filter((e) => e.company.trim() || e.role.trim());

  const out: SubSignal[] = [];

  // A1 Valid email format (3)
  {
    const email = p.email.trim();
    const pass = Boolean(email) && EMAIL_REGEX.test(email);
    out.push(
      sig("A1", "atsEssentials", 3, pass, pass ? "good" : "error", {
        title: pass
          ? "Email format is valid"
          : email
            ? "Email format looks invalid"
            : "No email address detected",
        description: pass
          ? ""
          : email
            ? `"${email}" didn't match a standard email pattern — parser may have garbled it.`
            : "Every UAE ATS filters by email. No email means no application.",
        actionable: pass ? "" : email ? "Confirm the email reads cleanly (e.g. name@domain.com)." : "Add a professional email address.",
      }),
    );
  }

  // A2 Phone present (3) — the ONLY phone signal. The former S3 in Sections
  // ran the identical check and has been removed; its copy lives here now.
  {
    const pass = Boolean(p.phone.trim());
    out.push(
      sig("A2", "atsEssentials", 3, pass, pass ? "good" : "error", {
        title: pass
          ? "Phone number present"
          : mode === "builder"
            ? "Add your phone number"
            : "No phone number detected",
        description: pass
          ? ""
          : "ATS systems treat phone as a required contact channel, and UAE recruiters call first — a missing number is a hard blocker.",
        actionable: pass ? "" : "Add a UAE-format phone number (+971 …) to the contact block.",
      }),
    );
  }

  // A3 No tables (3) — CONDITIONAL
  {
    const pass = !signals?.hasTables;
    out.push(
      sig(
        "A3",
        "atsEssentials",
        3,
        pass,
        pass ? "good" : "error",
        {
          title: pass ? "No tables detected" : "Tables detected",
          description: pass
            ? ""
            : "Tables look clean in Word but frequently get mangled by ATS parsers — columns get merged or skipped entirely.",
          actionable: pass ? "" : "Replace table layouts with a single-column format. Use bullets, not cells.",
        },
        true,
      ),
    );
  }

  // A4 No images (3) — CONDITIONAL
  {
    const pass = !signals?.hasImages;
    out.push(
      sig(
        "A4",
        "atsEssentials",
        3,
        pass,
        pass ? "good" : "error",
        {
          title: pass ? "No images detected" : "Images detected in CV",
          description: pass
            ? ""
            : "Most ATS engines skip images entirely. Information inside the image is invisible to the filter.",
          actionable: pass ? "" : "Remove decorative graphics. Keep a photo only if GCC employers require one.",
        },
        true,
      ),
    );
  }

  // A5 No unusual formatting (1) — CONDITIONAL
  {
    const pass = !signals?.hasUnusualFormatting;
    out.push(
      sig(
        "A5",
        "atsEssentials",
        1,
        pass,
        pass ? "good" : "review",
        {
          title: pass ? "Formatting looks standard" : "Unusual formatting detected",
          description: pass
            ? ""
            : "Multi-column layouts, decorative characters, or custom bullets may not parse cleanly.",
          actionable: pass ? "" : "Stick to a single column with standard bullets (•, -, *).",
        },
        true,
      ),
    );
  }

  // A6 No emojis (1) — N/A when there is no user text to scan.
  {
    const allUserText = [p.summary, ...cv.experience.flatMap((e) => e.bullets)].join(" ");
    const pass = !EMOJI_REGEX.test(allUserText);
    out.push(
      sig(
        "A6",
        "atsEssentials",
        1,
        pass,
        pass ? "good" : "error",
        {
          title: pass ? "No emojis in CV content" : "Emojis detected in CV content",
          description: pass
            ? ""
            : "ATS parsers treat emojis as junk characters — the surrounding text may get dropped.",
          actionable: pass ? "" : "Remove all emoji characters from bullets and summary.",
        },
        false,
        allUserText.trim().length > 0,
      ),
    );
  }

  // A7 ≥ 50% experience dates parseable (3)
  {
    if (expEntries.length === 0) {
      out.push(
        sig("A7", "atsEssentials", 3, false, "review", {
          title: "No experience dates to evaluate",
          description: "",
          actionable: "Add experience entries with start and end dates.",
        }),
      );
    } else {
      const parseable = expEntries.filter(
        (e) => DATE_HINT_REGEX.test(e.startDate) || DATE_HINT_REGEX.test(e.endDate),
      ).length;
      const ratio = parseable / expEntries.length;
      const pass = ratio >= 0.5;
      out.push(
        sig("A7", "atsEssentials", 3, pass, pass ? "good" : "error", {
          title: pass
            ? "Dates are recognisable"
            : `${expEntries.length - parseable} of ${expEntries.length} roles lack recognisable dates`,
          description: pass
            ? ""
            : "ATS systems sort by recency. Roles without dates fall out of the ranking.",
          actionable: pass ? "" : "Use 'MMM YYYY – MMM YYYY' or 'YYYY – Present'.",
        }),
      );
    }
  }

  // A8 100% dates parseable (1)
  {
    if (expEntries.length === 0) {
      out.push(
        sig("A8", "atsEssentials", 1, false, "review", {
          title: "No experience dates to evaluate",
          description: "",
          actionable: "Add dates to every experience entry.",
        }),
      );
    } else {
      const parseable = expEntries.filter(
        (e) => DATE_HINT_REGEX.test(e.startDate) || DATE_HINT_REGEX.test(e.endDate),
      ).length;
      const pass = parseable === expEntries.length;
      out.push(
        sig("A8", "atsEssentials", 1, pass, pass ? "good" : "review", {
          title: pass ? "Every role has parseable dates" : "Some roles still have unparseable dates",
          description: pass ? "" : "One missing date can push you down the ATS ranking.",
          actionable: pass ? "" : "Fill in dates on the remaining entries — 'YYYY' is fine if the month is unknown.",
        }),
      );
    }
  }

  // A9 Headline / job-title (2)
  {
    const pass = Boolean(p.headline.trim());
    out.push(
      sig("A9", "atsEssentials", 2, pass, pass ? "good" : "review", {
        title: pass ? "Headline populated" : mode === "builder" ? "Add a professional headline" : "No headline detected",
        description: pass
          ? ""
          : "A headline tells the ATS what job family you're targeting. Missing it weakens keyword matching.",
        actionable: pass ? "" : "Add a short headline under your name (e.g. 'Senior Operations Manager').",
      }),
    );
  }

  // A10 All experience entries have company (3)
  {
    if (expEntries.length === 0) {
      out.push(
        sig("A10", "atsEssentials", 3, false, "review", {
          title: "No experience to evaluate",
          description: "",
          actionable: "Add at least one experience entry with a company name.",
        }),
      );
    } else {
      const withCompany = expEntries.filter((e) => e.company.trim()).length;
      const pass = withCompany === expEntries.length;
      out.push(
        sig("A10", "atsEssentials", 3, pass, pass ? "good" : "error", {
          title: pass
            ? "Every role has a company name"
            : `${expEntries.length - withCompany} role${expEntries.length - withCompany === 1 ? "" : "s"} missing a company name`,
          description: pass
            ? ""
            : "ATS systems cross-reference employers. Missing company names trigger a parse warning.",
          actionable: pass ? "" : "Fill in the employer for every role.",
        }),
      );
    }
  }

  // A11 Current role populated (2) — flagged the real-world failure mode.
  // N/A on a CV with no experience content at all: a fully blank CV must
  // not earn a green "No current role marked — OK if you're between jobs".
  {
    const currentRoles = cv.experience.filter(
      (e) => e.isCurrent && (e.role.trim() || e.company.trim()),
    );
    const hasComplete = currentRoles.some(
      (e) => e.role.trim() && e.company.trim(),
    );
    const hasAny = cv.experience.some((e) => e.isCurrent);
    const hasExperienceContent = cv.experience.some(
      (e) => e.role.trim() || e.company.trim() || e.isCurrent,
    );
    // If any entry is marked current, it must have both role and company.
    const pass = hasAny ? hasComplete : currentRoles.length === 0;
    out.push(
      sig(
        "A11",
        "atsEssentials",
        2,
        pass,
        pass ? "good" : "error",
        {
          title: pass
            ? hasAny
              ? "Current role is complete"
              : "No current role marked — OK if you're between jobs"
            : "Current role is missing title or company",
          description: pass
            ? ""
            : "An ATS treats the current role as the signal of what you do today. Half-filled = ambiguous.",
          actionable: pass ? "" : "Fill in both role and company for the role marked 'Present'.",
        },
        false,
        hasExperienceContent,
      ),
    );
  }

  return out;
}

function evaluateDesign(cv: CvData): SubSignal[] {
  const summaryWords = wordCount(cv.personal.summary);
  const bulletWords = cv.experience
    .flatMap((e) => e.bullets)
    .reduce((sum, b) => sum + wordCount(b), 0);
  const eduApprox =
    cv.education.filter((e) => e.school.trim() || e.degree.trim()).length * 25;
  const skillsApprox = cv.skills.length * 2;
  const approxTotal = summaryWords + bulletWords + eduApprox + skillsApprox;
  const skillsCount = cv.skills.length;

  const out: SubSignal[] = [];

  // D1 ≥ 150 words (2)
  {
    const pass = approxTotal >= 150;
    out.push(
      sig("D1", "design", 2, pass, pass ? "good" : "error", {
        title: pass ? "CV has enough content" : "CV content looks thin",
        description: pass
          ? `${approxTotal} estimated words of content — comfortable minimum.`
          : `Only ~${approxTotal} words of content. Recruiters expect depth in experience and accomplishments.`,
        actionable: pass ? "" : "Expand bullets with context and results. Target 1 full page at minimum.",
      }),
    );
  }

  // D2 ≥ 300 words (2)
  {
    const pass = approxTotal >= 300;
    out.push(
      sig("D2", "design", 2, pass, pass ? "good" : "review", {
        title: pass ? "CV is substantive" : "CV could be more substantive",
        description: pass ? "" : `~${approxTotal} words. 300+ is a healthier baseline for mid-career CVs.`,
        actionable: pass ? "" : "Expand your strongest role with more context on scope and outcomes.",
      }),
    );
  }

  // D3 ≤ 1200 words (2) — N/A with no content (a blank CV is not "not
  // overstuffed", it's empty).
  {
    const pass = approxTotal <= 1200;
    out.push(
      sig(
        "D3",
        "design",
        2,
        pass,
        pass ? "good" : "review",
        {
          title: pass ? "CV isn't overstuffed" : "CV may spill to a 3rd page",
          description: pass ? "" : `~${approxTotal} words — risks bleeding onto a third page.`,
          actionable: pass ? "" : "Trim older roles to 2–3 bullets each. Keep the latest 2 roles detailed.",
        },
        false,
        approxTotal > 0,
      ),
    );
  }

  // D4 Skills ≥ 5 (2)
  {
    const pass = skillsCount >= 5;
    out.push(
      sig("D4", "design", 2, pass, pass ? "good" : "error", {
        title: pass ? "Minimum skill coverage met" : "Fewer than 5 skills listed",
        description: pass ? "" : `${skillsCount} skill${skillsCount === 1 ? "" : "s"} listed. Too few for ATS keyword matching.`,
        actionable: pass ? "" : "Add relevant tools, technologies, and methodologies — aim for 8–15.",
      }),
    );
  }

  // D5 Skills ≥ 10 (2)
  {
    const pass = skillsCount >= 10;
    out.push(
      sig("D5", "design", 2, pass, pass ? "good" : "review", {
        title: pass ? "Strong skill coverage" : "Skill list could be stronger",
        description: pass ? "" : `${skillsCount} skill${skillsCount === 1 ? "" : "s"}. 10+ improves keyword match density.`,
        actionable: pass ? "" : "Round out with adjacent tools and soft skills relevant to the role.",
      }),
    );
  }

  // D6 Skills < 30 (2) — N/A with zero skills.
  {
    const pass = skillsCount < 30;
    out.push(
      sig(
        "D6",
        "design",
        2,
        pass,
        pass ? "good" : "review",
        {
          title: pass ? "Skills aren't keyword-stuffed" : `${skillsCount} skills listed — likely too many`,
          description: pass
            ? ""
            : "30+ skills signals keyword stuffing. Recruiters (and ATS scoring models) penalise it.",
          actionable: pass ? "" : "Keep 10–20 highly relevant skills. Drop generic ones like 'Microsoft Office'.",
        },
        false,
        skillsCount > 0,
      ),
    );
  }

  // D7 Each skill ≤ 40 chars (2) — N/A with zero skills.
  {
    const longSkills = cv.skills.filter((s) => s.name.length > 40).length;
    const pass = longSkills === 0;
    out.push(
      sig(
        "D7",
        "design",
        2,
        pass,
        pass ? "good" : "review",
        {
          title: pass ? "Skills are short phrases" : `${longSkills} skill${longSkills === 1 ? " item looks" : " items look"} like sentences`,
          description: pass
            ? ""
            : "When skills are written as sentences instead of keywords, ATS keyword matching gets noisy.",
          actionable: pass ? "" : "Each skill should be a single term or short phrase (2–4 words), not a sentence.",
        },
        false,
        skillsCount > 0,
      ),
    );
  }

  // D8 Education entries have school AND degree (3)
  {
    const eduWithBoth = cv.education.filter(
      (e) => e.school.trim() && e.degree.trim(),
    ).length;
    const eduWithAny = cv.education.filter(
      (e) => e.school.trim() || e.degree.trim(),
    ).length;
    if (eduWithAny === 0) {
      out.push(
        sig("D8", "design", 3, false, "review", {
          title: "Education is missing or unformatted",
          description: "Education should appear with institution, degree, and dates in a consistent layout.",
          actionable: "Add at least one education entry with school and degree filled in.",
        }),
      );
    } else {
      const pass = eduWithBoth === eduWithAny;
      out.push(
        sig("D8", "design", 3, pass, pass ? "good" : "review", {
          title: pass
            ? "Every education entry is complete"
            : `${eduWithAny - eduWithBoth} education entr${eduWithAny - eduWithBoth === 1 ? "y is" : "ies are"} missing fields`,
          description: pass
            ? ""
            : "Partial education entries look like parser errors to a recruiter.",
          actionable: pass ? "" : "Fill in both school and degree for every entry.",
        }),
      );
    }
  }

  // D9 ≥ 3 bullets per role on average (3)
  {
    const expEntries = cv.experience.filter(
      (e) => e.company.trim() || e.role.trim(),
    );
    const totalBullets = expEntries.reduce(
      (sum, e) => sum + e.bullets.filter((b) => b.trim()).length,
      0,
    );
    const avg = expEntries.length > 0 ? totalBullets / expEntries.length : 0;
    const pass = expEntries.length > 0 && avg >= 3;
    out.push(
      sig("D9", "design", 3, pass, pass ? "good" : "review", {
        title: pass
          ? "Healthy bullet density per role"
          : expEntries.length === 0
            ? "No experience entries to evaluate"
            : `Average ${avg.toFixed(1)} bullets per role — aim for 3+`,
        description: pass
          ? `${totalBullets} bullets across ${expEntries.length} role${expEntries.length === 1 ? "" : "s"}.`
          : "Thin bullet density reads as a stub CV. 3–6 bullets per role is the sweet spot.",
        actionable: pass ? "" : "Add 1–2 more bullets to the thinnest roles. Focus on impact, not duties.",
      }),
    );
  }

  return out;
}

// --- Aggregation + public API ---

function gradeFromTotal(total: number): ScoreGrade {
  if (total >= 85) return "excellent";
  if (total >= 65) return "good";
  if (total >= 40) return "needs-work";
  return "poor";
}

function statusFromScore(score: number): ScoreSeverity {
  if (score >= 85) return "good";
  if (score >= 60) return "review";
  return "error";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Primary scoring entry point.
 *
 * - `mode: 'builder'` (default) — imperative copy; parseSignals usually absent.
 * - `mode: 'checker'` — diagnostic copy; parseSignals expected.
 *
 * Sub-signals that depend on parseSignals (C12, C13, A3, A4, A5 — worth 10 pts
 * total) are excluded from both numerator and denominator when no parseSignals
 * are provided, keeping the 0–100 total comparable across modes.
 */
export function computeScore(
  cv: CvData,
  options: ScoreOptions = {},
): ScoreReport {
  const mode = options.mode ?? "builder";
  const signals = options.parseSignals;

  const allSignals: SubSignal[] = [
    ...evaluateContent(cv, signals, mode),
    ...evaluateSections(cv, mode),
    ...evaluateAts(cv, signals, mode),
    ...evaluateDesign(cv),
  ];

  const applicable = allSignals.filter(
    (s) => (!s.conditional || signals) && s.applicable,
  );

  const totalEarned = applicable.reduce(
    (sum, s) => sum + (s.pass ? s.points : 0),
    0,
  );
  const totalMax = applicable.reduce((sum, s) => sum + s.points, 0);
  const total = totalMax > 0 ? clamp((totalEarned / totalMax) * 100) : 0;

  const categoryIds: ScoreCategoryId[] = [
    "content",
    "sections",
    "atsEssentials",
    "design",
  ];

  const categories: ScoreCategory[] = categoryIds.map((id) => {
    const catSignals = applicable.filter((s) => s.category === id);
    const earned = catSignals.reduce(
      (sum, s) => sum + (s.pass ? s.points : 0),
      0,
    );
    const maxPts = catSignals.reduce((sum, s) => sum + s.points, 0);
    const catScore = maxPts > 0 ? clamp((earned / maxPts) * 100) : 100;
    const meta = CATEGORY_META[id];

    // Issue ordering: errors first, then review, then a trimmed set of goods
    // (up to 2) so the card shows "what's working" without drowning the fixes.
    const issues: ScoreIssue[] = [];
    const bySeverity = (sev: ScoreSeverity) =>
      catSignals
        .filter((s) => s.issue.severity === sev)
        .map((s) => s.issue);
    issues.push(...bySeverity("error"));
    issues.push(...bySeverity("review"));
    issues.push(...bySeverity("good").slice(0, 2));

    return {
      id,
      name: meta.name,
      score: catScore,
      weight: meta.weight,
      status: statusFromScore(catScore),
      issues,
      faqs: meta.faqs,
    };
  });

  // issueCounts tallies ALL applicable issues (across all categories, including
  // goods we trimmed from the card display — the counter should reflect reality).
  const allIssues = applicable.map((s) => s.issue);
  const issueCounts = {
    error: allIssues.filter((i) => i.severity === "error").length,
    review: allIssues.filter((i) => i.severity === "review").length,
    good: allIssues.filter((i) => i.severity === "good").length,
  };

  return {
    total,
    grade: gradeFromTotal(total),
    issueCounts,
    categories,
  };
}

// Deprecated shims (calculateScore, computeCheckerScore) and their legacy
// types were deleted in the 2026-06 scoring consolidation — repo-wide grep
// confirmed zero production imports.

export type {
  ScoreCategory,
  ScoreCategoryId,
  ScoreFaq,
  ScoreGrade,
  ScoreIssue,
  ScoreReport,
  ScoreSeverity,
  ParseSignals,
};
