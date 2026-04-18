import type { CvData } from "./types/cv";
import type {
  CheckerCategory,
  CheckerCategoryKey,
  CheckerFaq,
  CheckerIssue,
  CheckerScoreResult,
  CheckerSeverity,
  ParseSignals,
} from "./resumeChecker/types";

export type ScoreCategory = {
  name: string;
  score: number;
  maxScore: number;
  suggestions: string[];
};

export type ScoreResult = {
  total: number;
  grade: "Excellent" | "Good" | "Fair" | "Needs Work";
  categories: ScoreCategory[];
};

function scoreContact(data: CvData): ScoreCategory {
  let score = 0;
  const suggestions: string[] = [];
  const p = data.personal;

  if (p.firstName.trim() || p.lastName.trim()) {
    score += 3;
  } else {
    suggestions.push("Add your full name — it's the first thing recruiters look for");
  }

  if (p.email.trim()) {
    score += 3;
  } else {
    suggestions.push("Add your email address so employers can contact you");
  }

  if (p.phone.trim()) {
    score += 3;
  } else {
    suggestions.push("Add your phone number for direct recruiter outreach");
  }

  if (p.location.trim()) {
    score += 3;
  } else {
    suggestions.push("Add your city or location — many ATS systems filter by location");
  }

  if (p.linkedin.trim() || p.website.trim()) {
    score += 3;
  } else {
    suggestions.push("Add your LinkedIn profile URL to stand out to recruiters");
  }

  return { name: "Contact Completeness", score, maxScore: 15, suggestions };
}

function scoreSummary(data: CvData): ScoreCategory {
  let score = 0;
  const suggestions: string[] = [];
  const summary = data.personal.summary.trim();

  if (summary) {
    score += 5;
  } else {
    suggestions.push(
      "Write a professional summary — it's your elevator pitch to hiring managers",
    );
    return { name: "Professional Summary", score, maxScore: 15, suggestions };
  }

  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 40) {
    score += 5;
  } else {
    suggestions.push(
      `Your summary has ${wordCount} words — expand it to at least 40 words for better impact`,
    );
  }

  if (/\d+/.test(summary)) {
    score += 5;
  } else {
    suggestions.push(
      'Your summary is strong — try adding a specific achievement with a number (e.g., "managed 12 projects")',
    );
  }

  return { name: "Professional Summary", score, maxScore: 15, suggestions };
}

function scoreExperience(data: CvData): ScoreCategory {
  let score = 0;
  const suggestions: string[] = [];
  const entries = data.experience.filter(
    (e) => e.company.trim() || e.role.trim(),
  );

  if (entries.length >= 1) {
    score += 5;
  } else {
    suggestions.push("Add at least one work experience entry");
    return { name: "Work Experience", score, maxScore: 25, suggestions };
  }

  if (entries.length >= 2) {
    score += 5;
  } else {
    suggestions.push(
      "Add a second work experience entry to show career progression",
    );
  }

  const completeEntries = entries.filter(
    (e) => e.role.trim() && e.company.trim() && e.startDate.trim(),
  );
  const completionRatio =
    entries.length > 0 ? completeEntries.length / entries.length : 0;
  score += Math.round(completionRatio * 5);
  if (completionRatio < 1) {
    suggestions.push(
      "Include job title, company name, and dates for all work experience entries",
    );
  }

  const entriesWithBullets = entries.filter((e) =>
    e.bullets.some((b) => b.trim()),
  );
  if (entriesWithBullets.length === entries.length) {
    score += 5;
  } else {
    suggestions.push(
      "Add bullet points describing your responsibilities and achievements for each role",
    );
  }

  const allBullets = entries.flatMap((e) => e.bullets);
  if (allBullets.some((b) => /\d+/.test(b))) {
    score += 5;
  } else {
    suggestions.push(
      'Add measurable results to your experience bullets (e.g., "Increased sales by 20%")',
    );
  }

  return { name: "Work Experience", score, maxScore: 25, suggestions };
}

function scoreEducation(data: CvData): ScoreCategory {
  let score = 0;
  const suggestions: string[] = [];
  const entries = data.education.filter(
    (e) => e.school.trim() || e.degree.trim(),
  );

  if (entries.length >= 1) {
    score += 5;
  } else {
    suggestions.push("Add at least one education entry");
    return { name: "Education", score, maxScore: 10, suggestions };
  }

  const first = entries[0];
  if (first.school.trim() && first.degree.trim()) {
    score += 5;
  } else {
    if (!first.school.trim())
      suggestions.push("Add the institution name for your education entry");
    if (!first.degree.trim())
      suggestions.push("Add the degree or qualification for your education entry");
  }

  return { name: "Education", score, maxScore: 10, suggestions };
}

function scoreSkills(data: CvData): ScoreCategory {
  let score = 0;
  const suggestions: string[] = [];
  const skills = data.skills.filter((s) => s.name.trim());

  if (skills.length >= 3) score += 5;
  if (skills.length >= 6) score += 5;
  if (skills.length >= 10) score += 5;

  if (skills.length < 3) {
    suggestions.push("Add at least 3 skills to pass ATS keyword filters");
  } else if (skills.length < 6) {
    suggestions.push(
      "Add at least 3 more skills — 6+ skills help with ATS keyword matching",
    );
  } else if (skills.length < 10) {
    suggestions.push(
      "You're close — adding a few more skills (10+) maximises ATS compatibility",
    );
  }

  return { name: "Skills", score, maxScore: 15, suggestions };
}

function scoreATS(data: CvData): ScoreCategory {
  let score = 0;
  const suggestions: string[] = [];
  const p = data.personal;

  if (p.headline.trim()) {
    score += 5;
  } else {
    suggestions.push(
      "Add a professional headline or job title to your contact section for ATS parsing",
    );
  }

  const allText = [
    p.summary,
    ...data.experience.flatMap((e) => e.bullets),
  ].join(" ");
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (!emojiRegex.test(allText)) {
    score += 5;
  } else {
    suggestions.push(
      "Remove emojis and decorative symbols from your descriptions — ATS may not parse them correctly",
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (p.email.trim() && emailRegex.test(p.email.trim())) {
    score += 5;
  } else if (!p.email.trim()) {
    suggestions.push(
      "Add a valid email address — it's essential for ATS applications",
    );
  } else {
    suggestions.push("Your email format appears invalid — double-check it");
  }

  if (p.phone.trim()) {
    score += 5;
  } else {
    suggestions.push("Add a phone number — most ATS systems require it");
  }

  return { name: "ATS Compatibility", score, maxScore: 20, suggestions };
}

export function calculateScore(data: CvData): ScoreResult {
  const categories = [
    scoreContact(data),
    scoreSummary(data),
    scoreExperience(data),
    scoreEducation(data),
    scoreSkills(data),
    scoreATS(data),
  ];

  const total = categories.reduce((sum, cat) => sum + cat.score, 0);

  let grade: ScoreResult["grade"];
  if (total >= 85) grade = "Excellent";
  else if (total >= 65) grade = "Good";
  else if (total >= 40) grade = "Fair";
  else grade = "Needs Work";

  return { total, grade, categories };
}

// --- CHECKER MODE ----------------------------------------------------------
// Diagnostic scoring for parsed CVs uploaded to /resume-checker.
// Softer thresholds than builder mode (parser misses vs user omissions).
// Output shape intentionally differs: categories/issues/FAQs, weighted total.

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

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_HINT_REGEX = /\d{4}|present|current/i;

function statusFromScore(score: number): CheckerSeverity {
  if (score >= 85) return "good";
  if (score >= 60) return "review";
  return "error";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function startsWithActionVerb(bullet: string): boolean {
  const first = bullet.trim().replace(/^[-•*›\s]+/, "").split(/\s+/)[0];
  if (!first) return false;
  return ACTION_VERBS.has(first.toLowerCase().replace(/[^a-z]/g, ""));
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

// ---- Category: Content ----
function checkerContent(
  cv: CvData,
  signals: ParseSignals,
): CheckerCategory {
  const issues: CheckerIssue[] = [];
  const p = cv.personal;
  const summary = p.summary.trim();
  const allBullets = cv.experience.flatMap((e) =>
    e.bullets.map((b) => b.trim()).filter(Boolean),
  );

  let score = 0;

  // Summary (25 points)
  if (!summary) {
    issues.push({
      id: "content.no-summary",
      severity: "error",
      title: "No summary section detected",
      description:
        "Recruiters read your summary in the first 10 seconds. Without one, the CV opens with a job list instead of a positioning statement.",
      actionable:
        "Add a 40–60 word summary at the top with years of experience, industry, and one measurable result.",
    });
  } else {
    const words = wordCount(summary);
    if (words < 20) {
      score += 10;
      issues.push({
        id: "content.summary-short",
        severity: "review",
        title: `Summary is ${words} words — too short`,
        description:
          "A one-line summary reads like a placeholder. 40–60 words gives enough room for experience, specialism, and a proof point.",
        actionable:
          "Expand to include years of experience, industry focus, and one quantified outcome.",
      });
    } else if (words < 40) {
      score += 18;
      issues.push({
        id: "content.summary-mid",
        severity: "review",
        title: "Summary is under 40 words",
        description:
          "Close to the minimum. A few more words would let you name your industry, scale of work, and a result.",
        actionable:
          "Add one sentence with a specific metric (team size, revenue, project count).",
      });
    } else {
      score += 25;
      issues.push({
        id: "content.summary-ok",
        severity: "good",
        title: "Summary present and substantive",
        description: `${words} words. Enough room to position you for the role.`,
        actionable: "",
      });
    }
  }

  // Quantified bullets (25 points)
  if (allBullets.length === 0) {
    issues.push({
      id: "content.no-bullets",
      severity: "error",
      title: "No experience bullets found",
      description:
        "Roles without bullets read as job titles only. Recruiters can't see what you actually delivered.",
      actionable: "Add 3–6 bullets per role describing what you did and the result.",
    });
  } else {
    const withNumbers = allBullets.filter((b) => /\d/.test(b)).length;
    const ratio = withNumbers / allBullets.length;
    if (ratio >= 0.5) {
      score += 25;
      issues.push({
        id: "content.quantified-ok",
        severity: "good",
        title: `${withNumbers} of ${allBullets.length} bullets quantify impact`,
        description: "Numbers, percentages, and currency signals signal outcomes over activity.",
        actionable: "",
      });
    } else if (ratio >= 0.25) {
      score += 15;
      issues.push({
        id: "content.quantified-low",
        severity: "review",
        title: `Only ${withNumbers} of ${allBullets.length} bullets contain numbers`,
        description:
          "Recruiters scan for measurable outcomes. Bullets without metrics are easy to skip.",
        actionable:
          "For each unquantified bullet, ask: how much? how many? by when? Add at least one number.",
      });
    } else {
      score += 5;
      issues.push({
        id: "content.quantified-poor",
        severity: "error",
        title: `Only ${withNumbers} of ${allBullets.length} bullets contain numbers`,
        description:
          "Recruiters scan for measurable outcomes. 'Increased sales by 30%' beats 'improved sales' every time.",
        actionable:
          "Target at least half your bullets quantifying a result — revenue, team size, time saved, percentage.",
      });
    }
  }

  // Action verbs (25 points)
  if (allBullets.length > 0) {
    const verbStarts = allBullets.filter(startsWithActionVerb).length;
    const ratio = verbStarts / allBullets.length;
    if (ratio >= 0.7) {
      score += 25;
      issues.push({
        id: "content.verbs-ok",
        severity: "good",
        title: "Bullets lead with strong action verbs",
        description: `${verbStarts} of ${allBullets.length} bullets start with an action verb.`,
        actionable: "",
      });
    } else if (ratio >= 0.4) {
      score += 15;
      issues.push({
        id: "content.verbs-mid",
        severity: "review",
        title: `${allBullets.length - verbStarts} of ${allBullets.length} bullets don't start with action verbs`,
        description: "Recruiters scan the first word of every bullet. Weak openers bury your achievements.",
        actionable:
          "Rewrite bullets to start with verbs like 'Led', 'Built', 'Delivered', 'Reduced'.",
      });
    } else {
      score += 5;
      issues.push({
        id: "content.verbs-low",
        severity: "error",
        title: `Most bullets don't start with action verbs`,
        description: "Bullets that start with 'Responsible for' or 'Duties included' read as job descriptions, not achievements.",
        actionable: "Replace passive openers with action verbs that describe what you actually did.",
      });
    }
  }

  // Long-paragraph bullets (15 points)
  if (allBullets.length > 0) {
    const longBullets = allBullets.filter((b) => wordCount(b) > 40).length;
    if (longBullets === 0) {
      score += 15;
    } else if (longBullets <= 2) {
      score += 8;
      issues.push({
        id: "content.long-bullets",
        severity: "review",
        title: `${longBullets} bullet${longBullets > 1 ? "s" : ""} read as paragraphs`,
        description: "Bullets over 40 words lose the scan-ability that makes bullet points work.",
        actionable: "Split long bullets into two. Each bullet should be one sentence, under 25 words.",
      });
    } else {
      issues.push({
        id: "content.long-bullets-many",
        severity: "error",
        title: `${longBullets} bullets are too long`,
        description: "A bullet that runs past 40 words defeats the purpose of using bullets.",
        actionable: "Rewrite each as a single crisp sentence. If a bullet has two ideas, make it two bullets.",
      });
    }
  } else {
    score += 15;
  }

  // Spelling (10 points) — signal from the parser
  if (signals.spellingIssues.length === 0) {
    score += 10;
  } else if (signals.spellingIssues.length <= 2) {
    score += 5;
    issues.push({
      id: "content.spelling-minor",
      severity: "review",
      title: `${signals.spellingIssues.length} possible spelling issue${signals.spellingIssues.length > 1 ? "s" : ""}`,
      description: signals.spellingIssues
        .slice(0, 3)
        .map((s) => `"${s.word}" → ${s.suggestion}`)
        .join("; "),
      actionable: "Review each flagged word. These are heuristic — confirm before changing.",
    });
  } else {
    issues.push({
      id: "content.spelling-many",
      severity: "error",
      title: `${signals.spellingIssues.length} possible spelling issues`,
      description:
        "Multiple flagged words. A CV with visible typos gets filtered out before a human sees it.",
      actionable: "Run the CV through a spell checker. Pay attention to proper nouns and company names.",
    });
  }

  const finalScore = clamp(score);
  return {
    category: "content",
    label: "Content",
    score: finalScore,
    status: statusFromScore(finalScore),
    weight: 0.3,
    issues,
    faqs: contentFaqs(),
  };
}

// ---- Category: Sections ----
function checkerSections(cv: CvData): CheckerCategory {
  const issues: CheckerIssue[] = [];
  const p = cv.personal;
  const hasName = Boolean(p.firstName.trim() || p.lastName.trim());
  const hasContact = Boolean(p.email.trim() || p.phone.trim());
  const hasSummary = Boolean(p.summary.trim());
  const hasExperience = cv.experience.some(
    (e) => e.company.trim() || e.role.trim(),
  );
  const hasEducation = cv.education.some(
    (e) => e.school.trim() || e.degree.trim(),
  );
  const hasSkills = cv.skills.length > 0;

  let score = 0;

  if (hasName && hasContact) {
    score += 20;
  } else {
    issues.push({
      id: "sections.contact-missing",
      severity: "error",
      title: "Contact section incomplete",
      description: !hasName
        ? "No name detected at the top of the CV."
        : "No email or phone detected.",
      actionable: "Place your name on the first line, with email and phone directly below.",
    });
  }

  if (hasSummary) {
    score += 15;
  } else {
    issues.push({
      id: "sections.summary-missing",
      severity: "review",
      title: "No summary section detected",
      description:
        "Some ATS parsers rely on the 'Summary' heading to identify the professional profile.",
      actionable: "Add a section titled 'Summary' or 'Professional Profile' above your experience.",
    });
  }

  if (hasExperience) {
    score += 20;
  } else {
    issues.push({
      id: "sections.experience-missing",
      severity: "error",
      title: "No work experience detected",
      description:
        "We couldn't find a recognisable experience section. Either it's missing or the heading wasn't standard.",
      actionable: "Use a clear 'Experience' or 'Work Experience' heading above your roles.",
    });
  }

  if (hasEducation) {
    score += 15;
  } else {
    issues.push({
      id: "sections.education-missing",
      severity: "review",
      title: "No education section detected",
      description:
        "UAE employers typically expect an education block, even for senior roles.",
      actionable: "Add an 'Education' section with your highest qualification first.",
    });
  }

  if (hasSkills) {
    score += 10;
  } else {
    issues.push({
      id: "sections.skills-missing",
      severity: "error",
      title: "No skills section detected",
      description:
        "Skills sections are where ATS keyword matches happen. Without one, you're likely filtered out.",
      actionable: "Add a 'Skills' section with 8–15 specific, relevant skills.",
    });
  }

  // Experience entries completeness (20 points)
  const expEntries = cv.experience.filter((e) => e.company.trim() || e.role.trim());
  if (expEntries.length > 0) {
    const complete = expEntries.filter(
      (e) =>
        e.role.trim() &&
        e.company.trim() &&
        e.startDate.trim() &&
        e.bullets.some((b) => b.trim()),
    ).length;
    const ratio = complete / expEntries.length;
    score += Math.round(ratio * 20);
    if (ratio < 1) {
      issues.push({
        id: "sections.exp-incomplete",
        severity: ratio < 0.5 ? "error" : "review",
        title: `${expEntries.length - complete} of ${expEntries.length} experience entries are incomplete`,
        description:
          "Each role needs a title, company, start date, and at least one bullet. Missing any of these reads as a parser miss or an abandoned draft.",
        actionable:
          "Fill in the missing fields. If a date is unknown, use 'YYYY' — better than blank.",
      });
    } else {
      issues.push({
        id: "sections.exp-ok",
        severity: "good",
        title: "All experience entries are complete",
        description: `${complete} role${complete > 1 ? "s" : ""} with title, company, date, and bullets.`,
        actionable: "",
      });
    }
  }

  const finalScore = clamp(score);
  return {
    category: "sections",
    label: "Section Structure",
    score: finalScore,
    status: statusFromScore(finalScore),
    weight: 0.2,
    issues,
    faqs: sectionsFaqs(),
  };
}

// ---- Category: ATS Essentials ----
function checkerAts(cv: CvData, signals: ParseSignals): CheckerCategory {
  const issues: CheckerIssue[] = [];
  const p = cv.personal;
  let score = 0;

  // Valid email (20)
  if (p.email.trim() && EMAIL_REGEX.test(p.email.trim())) {
    score += 20;
  } else if (!p.email.trim()) {
    issues.push({
      id: "ats.no-email",
      severity: "error",
      title: "No email address detected",
      description: "Every UAE ATS filters by email. No email means no application.",
      actionable: "Add a professional email address in the contact section.",
    });
  } else {
    issues.push({
      id: "ats.email-invalid",
      severity: "error",
      title: "Email format looks invalid",
      description: `"${p.email}" didn't match a standard email pattern — parser may have garbled it.`,
      actionable: "Confirm the email on the CV reads cleanly (e.g. name@domain.com).",
    });
  }

  // Phone (15)
  if (p.phone.trim()) {
    score += 15;
  } else {
    issues.push({
      id: "ats.no-phone",
      severity: "error",
      title: "No phone number detected",
      description: "UAE recruiters call first. A missing phone number is a hard blocker.",
      actionable: "Add a UAE-format phone number (+971...) to the contact block.",
    });
  }

  // No tables (20)
  if (!signals.hasTables) {
    score += 20;
  } else {
    issues.push({
      id: "ats.tables-detected",
      severity: "error",
      title: "Tables detected in the CV",
      description:
        "Tables look clean in Word but frequently get mangled by ATS parsers — columns get merged or skipped entirely.",
      actionable:
        "Replace table layouts with a single-column format. Use bullets, not cells.",
    });
  }

  // No images (15)
  if (!signals.hasImages) {
    score += 15;
  } else {
    issues.push({
      id: "ats.images-detected",
      severity: "review",
      title: "Images or graphics detected",
      description:
        "Most ATS engines skip images entirely. If your photo, logo, or icon contains information, it's invisible to the filter.",
      actionable:
        "Remove decorative graphics. Keep a photo only if it's truly required (some GCC employers still expect one).",
    });
  }

  // Unusual formatting (15)
  if (!signals.hasUnusualFormatting) {
    score += 15;
  } else {
    issues.push({
      id: "ats.formatting-unusual",
      severity: "review",
      title: "Unusual formatting detected",
      description:
        "Multi-column layouts, decorative characters, or custom bullets may not parse cleanly.",
      actionable: "Stick to a single column with standard bullets (•, -, *).",
    });
  }

  // Parseable dates in experience (15)
  const expEntries = cv.experience.filter((e) => e.company.trim() || e.role.trim());
  if (expEntries.length > 0) {
    const parseable = expEntries.filter(
      (e) => DATE_HINT_REGEX.test(e.startDate) || DATE_HINT_REGEX.test(e.endDate),
    ).length;
    const ratio = parseable / expEntries.length;
    score += Math.round(ratio * 15);
    if (ratio < 1) {
      issues.push({
        id: "ats.dates-unparseable",
        severity: "review",
        title: `${expEntries.length - parseable} of ${expEntries.length} roles lack recognisable dates`,
        description:
          "ATS systems sort candidates by recency. Roles without dates fall out of the ranking.",
        actionable: "Use 'MMM YYYY – MMM YYYY' or 'YYYY – Present'.",
      });
    }
  } else {
    score += 15;
  }

  // Check for emojis in user content — an ATS red flag
  const allUserText = [
    p.summary,
    ...cv.experience.flatMap((e) => e.bullets),
  ].join(" ");
  if (EMOJI_REGEX.test(allUserText)) {
    issues.push({
      id: "ats.emojis",
      severity: "error",
      title: "Emojis detected in CV content",
      description: "ATS parsers treat emojis as junk characters — the surrounding text may get dropped.",
      actionable: "Remove all emoji characters from bullets and summary.",
    });
    score = Math.max(0, score - 10);
  }

  const finalScore = clamp(score);
  return {
    category: "atsEssentials",
    label: "ATS Essentials",
    score: finalScore,
    status: statusFromScore(finalScore),
    weight: 0.3,
    issues,
    faqs: atsFaqs(),
  };
}

// ---- Category: Design ----
function checkerDesign(cv: CvData): CheckerCategory {
  const issues: CheckerIssue[] = [];
  let score = 0;

  // Length reasonable (30)
  const summaryWords = wordCount(cv.personal.summary);
  const bulletWords = cv.experience
    .flatMap((e) => e.bullets)
    .reduce((sum, b) => sum + wordCount(b), 0);
  const eduApprox = cv.education.filter((e) => e.school.trim()).length * 25;
  const skillsApprox = cv.skills.length * 2;
  const approxTotal = summaryWords + bulletWords + eduApprox + skillsApprox;

  if (approxTotal >= 250 && approxTotal <= 900) {
    score += 30;
    issues.push({
      id: "design.length-ok",
      severity: "good",
      title: "CV length looks right for 1–2 pages",
      description: `${approxTotal} estimated words of content.`,
      actionable: "",
    });
  } else if (approxTotal < 250) {
    score += 10;
    issues.push({
      id: "design.length-short",
      severity: "error",
      title: "CV content is too thin",
      description: `Only ~${approxTotal} words detected. Recruiters expect depth in experience and accomplishments.`,
      actionable: "Expand bullets with context and results. Target 1 full page at minimum.",
    });
  } else {
    score += 15;
    issues.push({
      id: "design.length-long",
      severity: "review",
      title: "CV may run over 2 pages",
      description: `~${approxTotal} words of content — risks bleeding onto a 3rd page.`,
      actionable: "Trim older roles to 2–3 bullets each. Keep the latest 2 roles detailed.",
    });
  }

  // Skills structured (25)
  const skillsCount = cv.skills.length;
  const longSkills = cv.skills.filter((s) => s.name.length > 40).length;
  if (skillsCount > 0 && longSkills === 0) {
    score += 25;
  } else if (skillsCount > 0 && longSkills > 0) {
    score += 12;
    issues.push({
      id: "design.skills-paragraph",
      severity: "review",
      title: `${longSkills} skill${longSkills > 1 ? " items look" : " item looks"} like a sentence`,
      description:
        "When skills are written as phrases instead of keywords, ATS keyword matching gets noisy.",
      actionable:
        "Each skill should be a single term or short phrase (2–4 words), not a sentence.",
    });
  }

  // Education formatted (25)
  const completeEdu = cv.education.filter(
    (e) => e.school.trim() && e.degree.trim(),
  ).length;
  const totalEdu = cv.education.filter(
    (e) => e.school.trim() || e.degree.trim(),
  ).length;
  if (totalEdu === 0) {
    issues.push({
      id: "design.edu-missing",
      severity: "review",
      title: "Education is missing or unformatted",
      description:
        "Education should appear with institution, degree, and dates in a consistent layout.",
      actionable: "Add at least one education entry with school and degree filled in.",
    });
  } else if (completeEdu === totalEdu) {
    score += 25;
  } else {
    score += 12;
    issues.push({
      id: "design.edu-partial",
      severity: "review",
      title: `${totalEdu - completeEdu} of ${totalEdu} education entries are missing fields`,
      description: "Partial education entries look like parser errors to a recruiter.",
      actionable: "Fill in both school and degree for each entry.",
    });
  }

  // Not overloaded (20)
  if (skillsCount < 30) {
    score += 20;
  } else {
    score += 10;
    issues.push({
      id: "design.skills-overloaded",
      severity: "review",
      title: `${skillsCount} skills listed — likely too many`,
      description:
        "30+ skills signals keyword stuffing. Recruiters (and ATS scoring models) penalise it.",
      actionable: "Keep 10–20 highly relevant skills. Drop generic ones like 'Microsoft Office'.",
    });
  }

  const finalScore = clamp(score);
  return {
    category: "design",
    label: "Design & Formatting",
    score: finalScore,
    status: statusFromScore(finalScore),
    weight: 0.2,
    issues,
    faqs: designFaqs(),
  };
}

// ---- FAQ content (per category) ----

function contentFaqs(): CheckerFaq[] {
  return [
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
  ];
}

function sectionsFaqs(): CheckerFaq[] {
  return [
    {
      q: "Which sections are actually required?",
      a: "Contact, Experience, Education, and Skills. Summary is strongly recommended. Certifications and Languages are optional but valued in the UAE market.",
    },
    {
      q: "Should I use creative section titles?",
      a: "No. 'Work Experience', 'Education', 'Skills' — plain labels are what ATS parsers look for. 'My Journey' or 'What I Bring' confuse the filter.",
    },
  ];
}

function atsFaqs(): CheckerFaq[] {
  return [
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
  ];
}

function designFaqs(): CheckerFaq[] {
  return [
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
  ];
}

/**
 * Checker mode scorer. Distinct function, distinct output shape.
 * Call with the CV produced by the parser + the raw parse signals from Claude.
 * Does NOT share code paths with calculateScore — builder mode is untouched.
 */
export function computeCheckerScore(
  cv: CvData,
  signals: ParseSignals,
): CheckerScoreResult {
  const categories: CheckerCategory[] = [
    checkerContent(cv, signals),
    checkerSections(cv),
    checkerAts(cv, signals),
    checkerDesign(cv),
  ];

  const weightedTotal = categories.reduce(
    (sum, c) => sum + c.score * c.weight,
    0,
  );
  const total = clamp(weightedTotal);

  const issueCount = categories.reduce(
    (sum, c) => sum + c.issues.filter((i) => i.severity !== "good").length,
    0,
  );

  return {
    total,
    status: statusFromScore(total),
    issueCount,
    categories,
  };
}

export type {
  CheckerCategory,
  CheckerCategoryKey,
  CheckerIssue,
  CheckerFaq,
  CheckerScoreResult,
  CheckerSeverity,
  ParseSignals,
};
