import type { CvData } from "./types/cv";

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
