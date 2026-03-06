// Heuristic plain-text → ParsedDocument parser.
// Shared by PDF adapter (after text extraction) and LinkedIn paste adapter.
// Limitations: relies on section-header keywords and date pattern matching.

import type {
  ParsedDocument,
  ParsedExperience,
  ParsedEducation,
  ParsedCertification,
} from "./adapter";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{6,}\d)/;
const LINKEDIN_RE = /linkedin\.com\/in\/([\w-]+)/i;
const URL_RE = /https?:\/\/[\w./%-]+/i;

const MONTH_NAMES =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const DATE_TOKEN_RE = new RegExp(
  `(?:${MONTH_NAMES})\\s+\\d{4}|\\d{4}`,
  "gi",
);

const SECTION_MAP: Record<string, RegExp> = {
  summary: /^(?:professional\s+)?(?:summary|profile|objective|about\s*me)/i,
  experience: /^(?:work\s+)?(?:experience|employment|work\s+history)/i,
  education: /^(?:education|academic|qualifications?)/i,
  skills: /^(?:skills?|competenc|technical\s+skills?|expertise)/i,
  languages: /^languages?$/i,
  certifications: /^(?:certifications?|certificates?|licenses?|accreditations?)/i,
  projects: /^(?:projects?|portfolio|side\s+projects?)/i,
};

function detectSection(line: string): string | null {
  const trimmed = line.trim().replace(/[:\-_=*]+$/, "").trim();
  // Skip very long lines — unlikely to be section headers
  if (trimmed.length > 60) return null;
  for (const [section, re] of Object.entries(SECTION_MAP)) {
    if (re.test(trimmed)) return section;
  }
  return null;
}

function extractDates(text: string): string[] {
  return (text.match(DATE_TOKEN_RE) ?? []).map((d) => d.trim());
}

function parseExperienceBlock(lines: string[]): ParsedExperience[] {
  const entries: ParsedExperience[] = [];
  let current: ParsedExperience | null = null;

  for (const line of lines) {
    const dates = extractDates(line);
    const hasDates = dates.length >= 1;
    const isBullet = /^[-•*›]\s+/.test(line);

    if (hasDates && !isBullet) {
      if (current) entries.push(current);
      // Attempt "Role at Company | Location | Date – Date"
      const clean = line.replace(DATE_TOKEN_RE, "").replace(/[–—-]/g, " ").trim();
      const parts = clean.split(/\s+at\s+|\s*[|@,]\s*/);
      current = {
        role: parts[0]?.trim() || undefined,
        company: parts[1]?.trim() || undefined,
        location: parts[2]?.trim() || undefined,
        startDate: dates[0],
        endDate: dates[1] ?? (line.match(/present|current/i) ? "Present" : undefined),
        isCurrent: /present|current/i.test(line),
        bullets: [],
      };
    } else if (isBullet && current) {
      current.bullets = current.bullets ?? [];
      current.bullets.push(line.replace(/^[-•*›]\s+/, "").trim());
    } else if (current && !hasDates && !isBullet) {
      if (!current.company) current.company = line.trim();
      else if (!current.role) current.role = line.trim();
    } else if (!current && !hasDates) {
      // New entry header without dates
      current = { role: line.trim(), bullets: [] };
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseEducationBlock(lines: string[]): ParsedEducation[] {
  const entries: ParsedEducation[] = [];
  let current: ParsedEducation | null = null;

  for (const line of lines) {
    const dates = extractDates(line);
    const hasDates = dates.length >= 1;

    if (hasDates) {
      if (current) entries.push(current);
      const clean = line.replace(DATE_TOKEN_RE, "").replace(/[–—-]/g, " ").trim();
      const parts = clean.split(/[,|]/);
      current = {
        school: parts[0]?.trim() || undefined,
        degree: parts[1]?.trim() || undefined,
        field: parts[2]?.trim() || undefined,
        startDate: dates[0],
        endDate: dates[1],
      };
    } else if (!current) {
      current = { school: line.trim() };
    } else if (!current.degree) {
      current.degree = line.trim();
    } else {
      current.notes = ((current.notes ?? "") + " " + line).trim();
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseCertificationsBlock(lines: string[]): ParsedCertification[] {
  return lines.map((line) => {
    const parts = line.split(/[,|]/);
    return {
      name: parts[0]?.trim() || undefined,
      issuer: parts[1]?.trim() || undefined,
      date: parts[2]?.trim() || undefined,
    };
  });
}

export function parseTextToDocument(text: string): ParsedDocument {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedDocument = {
    contact: {},
    summary: "",
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
  };

  let currentSection: string | null = null;
  const sectionBuffers: Record<string, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };

  // First pass: extract contact from the top of the document
  let contactLineCount = 0;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    const emailMatch = line.match(EMAIL_RE);
    if (emailMatch) {
      result.contact!.email = emailMatch[0];
      contactLineCount = i + 1;
      continue;
    }
    const phoneMatch = line.match(PHONE_RE);
    if (phoneMatch) {
      result.contact!.phone = phoneMatch[0].trim();
      contactLineCount = i + 1;
      continue;
    }
    const liMatch = line.match(LINKEDIN_RE);
    if (liMatch) {
      result.contact!.linkedin = `https://linkedin.com/in/${liMatch[1]}`;
      contactLineCount = i + 1;
      continue;
    }
    const urlMatch = line.match(URL_RE);
    if (urlMatch && !result.contact!.website) {
      result.contact!.website = urlMatch[0];
      contactLineCount = i + 1;
      continue;
    }
    // First non-contact line is assumed to be the name
    if (i === 0 && !result.contact!.name) {
      result.contact!.name = line;
      contactLineCount = 1;
    }
  }

  // Second pass: section routing
  for (let i = contactLineCount; i < lines.length; i++) {
    const line = lines[i];
    const section = detectSection(line);
    if (section) {
      currentSection = section;
      continue;
    }
    if (currentSection && sectionBuffers[currentSection] !== undefined) {
      sectionBuffers[currentSection].push(line);
    }
  }

  result.summary = sectionBuffers.summary.join(" ").trim();
  result.experience = parseExperienceBlock(sectionBuffers.experience);
  result.education = parseEducationBlock(sectionBuffers.education);
  result.certifications = parseCertificationsBlock(sectionBuffers.certifications);

  // Skills and languages: split by comma/semicolon/pipe
  result.skills = sectionBuffers.skills
    .flatMap((l) => l.split(/[,;|]/))
    .map((s) => s.trim())
    .filter(Boolean);

  result.languages = sectionBuffers.languages
    .flatMap((l) => l.split(/[,;|]/))
    .map((s) => s.trim())
    .filter(Boolean);

  return result;
}
