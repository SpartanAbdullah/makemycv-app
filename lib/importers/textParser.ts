// Heuristic plain-text → ParsedDocument parser.
// Shared by PDF adapter (after text extraction) and LinkedIn paste adapter.
//
// Design goals
// ------------
// 1. Round-trip our own exports cleanly. The PDF and DOCX exports produced by
//    makemycv.ae must re-import with no data loss when the user uploads them
//    back into the builder. That is the user-trust commitment.
// 2. Best-effort on third-party CVs. Heuristics handle common layouts but
//    can't beat a Claude-grade parser for arbitrary input — that's a
//    deliberate trade-off to keep imports instant and free.
//
// Strategy
// --------
// * Section detection is a single keyword regex per section name, applied to
//   short lines only (section headings are never long sentences).
// * Contact data is harvested in a sweep over the first ~30 lines, in any
//   order — email/phone/url patterns are unambiguous enough to spot anywhere
//   in the header block.
// * Experience and education use a state machine that walks the section's
//   lines and folds dates, locations and bullet markers into entries.

import type {
  ParsedDocument,
  ParsedExperience,
  ParsedEducation,
  ParsedCertification,
  ParsedProject,
  ParsedUaeFields,
} from "./adapter";

// ── Token patterns ───────────────────────────────────────────────────────────

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{6,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w%-]+)/i;
// URL with explicit protocol/www. Used for stricter detection (e.g. when
// deciding whether a line is "mostly a URL").
const GENERIC_URL_RE = /\b(?:https?:\/\/|www\.)[\w./%?=&#-]+\b/i;
// Bare-domain pattern — our templates strip http/www from displayed URLs.
// Matches "example.com", "my-portfolio.io", "linkedin.com/in/me" etc.
const BARE_DOMAIN_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b(?:\/[\w./%?=&#-]*)?/i;

const MONTH_NAMES =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
// Word boundaries around month names are load-bearing: without them "Mar"
// matched inside "Marketing", so "Marketing Director" parsed as "keting
// Director" and the phantom date stole the entry's startDate slot
// (baseline bug exposed by __fixtures__/two-column-interleaved.txt).
const DATE_TOKEN_RE = new RegExp(
  `\\b(?:${MONTH_NAMES})\\b[\\s.,]*\\d{4}|\\b(?:${MONTH_NAMES})\\b|\\b(?:19|20)\\d{2}\\b`,
  "gi",
);
const PRESENT_RE = /\b(?:present|current|now|ongoing|till\s+date|todate)\b/i;

const BULLET_PREFIX_RE = /^[\s]*[•·●◦▪■*\-–—›▸▶►★▎]\s+/;
const NUMBERED_BULLET_RE = /^\s*\d+[.)]\s+/;

const DEGREE_KEYWORDS_RE =
  /\b(bachelor|master|m\.?b\.?a|b\.?b\.?a|b\.?sc|m\.?sc|b\.?eng|m\.?eng|ph\.?d|doctorate|associate|diploma|certificate|hnd|gcse|a[-\s]?levels?|b\.?a\b|m\.?a\b|b\.?s\b|m\.?s\b|llb|llm|md|engineer(ing)?)\b/i;

const COUNTRY_HINTS = [
  "uae",
  "united arab emirates",
  "ksa",
  "saudi",
  "egypt",
  "jordan",
  "lebanon",
  "qatar",
  "bahrain",
  "kuwait",
  "oman",
  "india",
  "pakistan",
  "bangladesh",
  "sri lanka",
  "philippines",
  "nepal",
  "uk",
  "united kingdom",
  "usa",
  "united states",
  "canada",
  "australia",
];

const CITY_HINTS = [
  "dubai",
  "abu dhabi",
  "sharjah",
  "ajman",
  "fujairah",
  "ras al khaimah",
  "umm al quwain",
  "al ain",
  "riyadh",
  "jeddah",
  "doha",
  "kuwait city",
  "manama",
  "muscat",
  "amman",
  "beirut",
  "cairo",
  "alexandria",
  "karachi",
  "lahore",
  "islamabad",
  "mumbai",
  "delhi",
  "new delhi",
  "bangalore",
  "bengaluru",
  "chennai",
  "hyderabad",
  "kolkata",
  "london",
  "manchester",
  "birmingham",
  "edinburgh",
  "new york",
  "san francisco",
  "los angeles",
  "boston",
  "chicago",
  "seattle",
  "toronto",
  "vancouver",
  "montreal",
  "sydney",
  "melbourne",
];

// ── Section header detection ─────────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ key: string; re: RegExp }> = [
  {
    key: "summary",
    re: /^(?:professional\s+)?(?:summary|profile|objective|about(?:\s*me)?|personal\s+statement|career\s+(?:summary|objective|profile))$/i,
  },
  {
    key: "experience",
    re: /^(?:work\s+|professional\s+|career\s+)?(?:experience|employment(?:\s+history)?|work\s+history|career\s+history|professional\s+background)$/i,
  },
  {
    key: "education",
    re: /^(?:education(?:al\s+background)?|academic(?:\s+background|\s+history|\s+qualifications?)?|qualifications?)$/i,
  },
  {
    key: "skills",
    re: /^(?:skills|key\s+skills|technical\s+skills|core\s+(?:competenc(?:ies|y)|skills)|competenc(?:ies|y)|expertise|areas?\s+of\s+expertise|professional\s+skills)$/i,
  },
  { key: "languages", re: /^languages?(?:\s+spoken|\s+known)?$/i },
  {
    key: "certifications",
    re: /^(?:certif(?:ications?|icates?)|licens(?:es?|ures?)|accreditations?|professional\s+development|trainings?)$/i,
  },
  {
    key: "projects",
    re: /^(?:projects?|portfolio|side\s+projects?|key\s+projects?|notable\s+projects?)$/i,
  },
];

function normalizeHeader(line: string): string {
  return line.trim().replace(/[:\-_=*•·]+$/, "").trim();
}

function detectSection(line: string): string | null {
  const trimmed = normalizeHeader(line);
  // Section headers are rarely longer than ~50 chars. Also reject lines with
  // sentence-ending punctuation — they're almost certainly body text.
  if (trimmed.length === 0 || trimmed.length > 50) return null;
  if (/[.!?]$/.test(trimmed)) return null;
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(trimmed)) return key;
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractDates(text: string): string[] {
  const matches = text.match(DATE_TOKEN_RE) ?? [];
  return matches.map((d) => d.trim()).filter(Boolean);
}

function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(line) || NUMBERED_BULLET_RE.test(line);
}

function stripBulletPrefix(line: string): string {
  return line.replace(BULLET_PREFIX_RE, "").replace(NUMBERED_BULLET_RE, "").trim();
}

function looksLikeLocation(line: string): boolean {
  if (!line || line.length > 80) return false;
  if (extractDates(line).length > 0) return false;
  const lower = line.toLowerCase();
  if (CITY_HINTS.some((c) => lower.includes(c))) return true;
  if (COUNTRY_HINTS.some((c) => lower.includes(c))) return true;
  // Generic "City, Country" / "City, ST" pattern with no obvious title words.
  if (/^[A-Za-z .'-]+,\s*[A-Za-z .'-]{2,}$/.test(line) && !/\b(at|the)\b/i.test(line)) {
    return true;
  }
  return false;
}

function isDateOnlyLine(line: string): boolean {
  const dates = extractDates(line);
  if (dates.length === 0 && !PRESENT_RE.test(line)) return false;
  // Strip dates + range separators + "present" tokens — if very little is
  // left, the line is just a date.
  const residue = line
    .replace(DATE_TOKEN_RE, " ")
    .replace(PRESENT_RE, " ")
    .replace(/[\s.,()\-–—|/]+/g, " ")
    .trim();
  return residue.length <= 3;
}

function splitHeaderParts(text: string): string[] {
  // Strong separators: " | ", " · ", " — ", " – ", " - ", " at ", " • ".
  // We require whitespace on both sides so "Co-founder" stays intact.
  const STRONG_SEP = /\s+(?:\||·|—|–|-{1,2}|at|•)\s+/i;
  let parts: string[];
  if (STRONG_SEP.test(text)) {
    parts = text.split(STRONG_SEP);
    // DOCX-style "Role  Company" inside a part: also break on 2+ spaces.
    parts = parts.flatMap((p) => p.split(/[ \t]{2,}/));
  } else if (/[ \t]{2,}/.test(text)) {
    parts = text.split(/[ \t]{2,}/);
  } else {
    parts = [text];
  }
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function looksLikeRole(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length === 0) return false;
  // Role words common in UAE / global market.
  return /\b(manager|engineer|developer|designer|consultant|analyst|director|executive|officer|administrator|coordinator|specialist|associate|lead|head\s+of|chief|president|vice\s+president|vp\b|founder|owner|architect|supervisor|operator|technician|assistant|intern|trainee|sales|marketing|finance|hr|accountant|nurse|doctor|teacher|professor|driver|chef|writer|editor|producer|advisor)\b/i.test(
    t,
  );
}

function looksLikeCompany(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Common company suffixes in UAE / globally.
  return /\b(LLC|L\.L\.C|FZE|FZ\s?LLC|Ltd\.?|Limited|Inc\.?|Co\.?|Corp\.?|Company|Group|Holding|Trading|Enterprises|Solutions|Services|Technologies|Tech|Systems|Industries|International|Pvt\.?|Private)\b/i.test(
    t,
  );
}

// ── Experience block parser ──────────────────────────────────────────────────

/**
 * Walk a block of lines from the Experience section and reconstruct
 * entries. Tolerant of three common layouts:
 *
 *   A. Single-line header with dates trailing (our Classic PDF export):
 *        "Operations Manager | Acme LLC                Jan 2024 – Present"
 *        "Dubai, UAE"
 *        "• Built ops team from scratch"
 *
 *   B. Two-line header — dates on their own line (our DOCX export):
 *        "Operations Manager  Acme LLC · Dubai"
 *        "Jan 2024 – Present"
 *        "• Built ops team from scratch"
 *
 *   C. LinkedIn-style — company line, then role line:
 *        "Acme LLC"
 *        "Operations Manager"
 *        "Jan 2024 - Present · Dubai, UAE"
 *        "Built ops team from scratch"
 */
function parseExperienceBlock(lines: string[]): ParsedExperience[] {
  const entries: ParsedExperience[] = [];
  let current: ParsedExperience | null = null;
  let pendingDates: string[] | null = null;
  let pendingPresent = false;

  const pushCurrent = () => {
    if (!current) return;
    // Only keep entries that have ANY identifying info.
    if (
      (current.role && current.role.trim()) ||
      (current.company && current.company.trim()) ||
      (current.bullets && current.bullets.length > 0)
    ) {
      entries.push(current);
    }
    current = null;
  };

  const applyPendingDates = (entry: ParsedExperience) => {
    if (pendingDates && pendingDates.length > 0) {
      if (!entry.startDate) entry.startDate = pendingDates[0];
      if (!entry.endDate && pendingDates[1]) entry.endDate = pendingDates[1];
    }
    if (pendingPresent) {
      entry.isCurrent = true;
      if (!entry.endDate) entry.endDate = "Present";
    }
    pendingDates = null;
    pendingPresent = false;
  };

  const startEntryFromLine = (line: string) => {
    const dates = extractDates(line);
    const hasPresent = PRESENT_RE.test(line);
    // Strip dates and the "present" token. Collapse 3+ whitespace to 2 so the
    // DOCX-style two-space field separator survives for splitHeaderParts.
    const cleaned = line
      .replace(DATE_TOKEN_RE, " ")
      .replace(PRESENT_RE, " ")
      .replace(/[ \t]{3,}/g, "  ")
      .trim();
    const parts = splitHeaderParts(cleaned);

    let role: string | undefined;
    let company: string | undefined;
    let location: string | undefined;

    if (parts.length === 1) {
      // Could be either; bias toward role.
      role = parts[0];
    } else if (parts.length >= 2) {
      // Decide which part is the role vs company.
      const [a, b, c] = parts;
      if (looksLikeRole(a) && !looksLikeRole(b)) {
        role = a;
        company = b;
      } else if (!looksLikeRole(a) && looksLikeRole(b)) {
        company = a;
        role = b;
      } else if (looksLikeCompany(b) && !looksLikeCompany(a)) {
        role = a;
        company = b;
      } else if (looksLikeCompany(a) && !looksLikeCompany(b)) {
        company = a;
        role = b;
      } else {
        // Fall back to convention: "Role | Company".
        role = a;
        company = b;
      }
      if (c && looksLikeLocation(c)) location = c;
    }

    const entry: ParsedExperience = {
      role,
      company,
      location,
      startDate: dates[0],
      endDate: dates[1] ?? (hasPresent ? "Present" : undefined),
      isCurrent: hasPresent,
      bullets: [],
    };
    applyPendingDates(entry);
    return entry;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    if (isBulletLine(line)) {
      if (!current) {
        // Bullet before any header — bind to a new empty entry rather than drop.
        current = { bullets: [] };
        applyPendingDates(current);
      }
      current.bullets = current.bullets ?? [];
      current.bullets.push(stripBulletPrefix(line));
      continue;
    }

    if (isDateOnlyLine(line)) {
      const dates = extractDates(line);
      const hasPresent = PRESENT_RE.test(line);
      if (current && !current.startDate) {
        current.startDate = dates[0];
        current.endDate = dates[1] ?? (hasPresent ? "Present" : current.endDate);
        if (hasPresent) current.isCurrent = true;
      } else {
        pendingDates = dates;
        pendingPresent = hasPresent;
      }
      continue;
    }

    // Header-like line. Decide: new entry, or a detail line for the current?
    const headerParts = splitHeaderParts(line);
    const hasInlineDates = extractDates(line).length > 0;
    // Lines that begin with a strong action verb are almost always bullets,
    // not job-title rows (avoids "Led teams - delivered X" being misread as
    // "Role | Company").
    const startsWithActionVerb =
      /^(?:Achieved|Architected|Authored|Built|Collaborated|Conducted|Coordinated|Created|Cut|Delivered|Designed|Developed|Directed|Drove|Established|Evaluated|Executed|Expanded|Generated|Grew|Hired|Implemented|Improved|Increased|Initiated|Introduced|Launched|Led|Maintained|Managed|Mentored|Negotiated|Onboarded|Optimized|Optimised|Orchestrated|Organised|Organized|Oversaw|Owned|Partnered|Pioneered|Planned|Presented|Produced|Reduced|Reorganised|Reorganized|Researched|Resolved|Scaled|Secured|Shaped|Spearheaded|Streamlined|Supervised|Supported|Trained|Transformed)\s/i.test(
        line,
      );
    const looksLikeRoleHeader =
      headerParts.length >= 2 &&
      line.length < 100 &&
      !startsWithActionVerb;
    const hasMarkedBullets = !!(current?.bullets && current.bullets.length > 0);

    const looksLikeNewHeader =
      !current ||
      hasInlineDates ||
      looksLikeRoleHeader ||
      // After marked bullets, a short non-sentence line is the next header.
      (hasMarkedBullets &&
        line.length < 80 &&
        !/[.!?]$/.test(line) &&
        !startsWithActionVerb);

    if (looksLikeNewHeader) {
      pushCurrent();
      current = startEntryFromLine(line);
      continue;
    }

    // Continuation line for current entry.
    if (current) {
      if (!current.location && looksLikeLocation(line)) {
        current.location = line;
      } else if (!current.company) {
        current.company = line;
      } else if (!current.role) {
        current.role = line;
      } else {
        // All header fields set. Treat as an implicit bullet — mammoth's DOCX
        // text extraction drops list markers, so the only signal we have is
        // structural position (after role/company/location).
        current.bullets = current.bullets ?? [];
        current.bullets.push(line);
      }
    }
  }

  pushCurrent();

  // Clean up: drop empty bullets array if it's just [""]
  for (const e of entries) {
    if (e.bullets) {
      e.bullets = e.bullets.map((b) => b.trim()).filter(Boolean);
    }
  }
  return entries;
}

// ── Education block parser ───────────────────────────────────────────────────

function parseEducationBlock(lines: string[]): ParsedEducation[] {
  const entries: ParsedEducation[] = [];
  let current: ParsedEducation | null = null;
  let pendingDates: string[] | null = null;

  const pushCurrent = () => {
    if (!current) return;
    if (
      (current.school && current.school.trim()) ||
      (current.degree && current.degree.trim())
    ) {
      entries.push(current);
    }
    current = null;
  };

  const applyPendingDates = (entry: ParsedEducation) => {
    if (pendingDates && pendingDates.length > 0) {
      if (!entry.startDate) entry.startDate = pendingDates[0];
      if (!entry.endDate && pendingDates[1]) entry.endDate = pendingDates[1];
    }
    pendingDates = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isBulletLine(line)) {
      // Bullet inside education = notes / coursework. Append to current notes.
      if (current) {
        const text = stripBulletPrefix(line);
        current.notes = current.notes
          ? `${current.notes} ${text}`.trim()
          : text;
      }
      continue;
    }

    if (isDateOnlyLine(line)) {
      const dates = extractDates(line);
      if (current && !current.startDate) {
        current.startDate = dates[0];
        current.endDate = dates[1] ?? current.endDate;
      } else {
        pendingDates = dates;
      }
      continue;
    }

    const dates = extractDates(line);
    const looksLikeNewHeader =
      !current ||
      // Heuristic: lines with separators or degree keywords are headers.
      /\s(?:\||·|—|–|-{1,2}|,)\s/i.test(line) ||
      DEGREE_KEYWORDS_RE.test(line) ||
      dates.length > 0;

    if (looksLikeNewHeader) {
      pushCurrent();

      const cleaned = line
        .replace(DATE_TOKEN_RE, " ")
        .replace(PRESENT_RE, " ")
        .replace(/[ \t]{3,}/g, "  ")
        .trim();
      const parts = splitHeaderParts(cleaned);

      let school: string | undefined;
      let degree: string | undefined;
      let field: string | undefined;

      if (parts.length === 1) {
        // Could be either; decide by degree-keyword content.
        if (DEGREE_KEYWORDS_RE.test(parts[0])) degree = parts[0];
        else school = parts[0];
      } else {
        // Find a part that contains degree keywords.
        const degreeIdx = parts.findIndex((p) => DEGREE_KEYWORDS_RE.test(p));
        if (degreeIdx >= 0) {
          degree = parts[degreeIdx];
          // Everything else: first non-degree = school, then field/notes.
          const rest = parts.filter((_, idx) => idx !== degreeIdx);
          if (rest[0]) school = rest[0];
          if (rest[1]) field = rest[1];
        } else {
          // No degree keyword found — fall back to convention: school | degree.
          school = parts[0];
          degree = parts[1];
          if (parts[2]) field = parts[2];
        }
      }

      current = {
        school,
        degree,
        field,
        startDate: dates[0],
        endDate: dates[1],
      };
      applyPendingDates(current);
      continue;
    }

    // Continuation line: detail for current entry.
    if (current) {
      if (!current.field && !DEGREE_KEYWORDS_RE.test(line)) {
        current.field = line;
      } else if (!current.notes) {
        current.notes = line;
      } else {
        current.notes = `${current.notes} ${line}`.trim();
      }
    }
  }
  pushCurrent();
  return entries;
}

// ── Certifications block parser ──────────────────────────────────────────────

function parseCertificationsBlock(lines: string[]): ParsedCertification[] {
  const out: ParsedCertification[] = [];
  for (const raw of lines) {
    const line = stripBulletPrefix(raw.trim());
    if (!line) continue;
    // Common separators: " — ", " - ", " | ", " · ", ","
    const parts = line
      .split(/\s*(?:\||·|—|–|-{1,2}|,)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    const entry: ParsedCertification = { name: parts[0] };
    // Issuer is usually the next non-date part.
    const remaining = parts.slice(1);
    const dateIdx = remaining.findIndex(
      (p) => extractDates(p).length > 0 && isDateOnlyLine(p),
    );
    if (dateIdx >= 0) {
      entry.date = remaining[dateIdx];
      const others = remaining.filter((_, i) => i !== dateIdx);
      if (others[0]) entry.issuer = others[0];
    } else if (remaining[0]) {
      entry.issuer = remaining[0];
      if (remaining[1] && extractDates(remaining[1]).length > 0) {
        entry.date = remaining[1];
      }
    }
    out.push(entry);
  }
  return out;
}

// ── Skills / Languages block parsing ─────────────────────────────────────────

function flattenList(lines: string[]): string[] {
  return lines
    .flatMap((l) => l.split(/[,;|·•]/))
    .map((s) =>
      stripBulletPrefix(s)
        .replace(/^[-–—]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

function stripLanguageLevel(name: string): string {
  // Drop trailing parenthetical or dash-separated level qualifier.
  // Examples:
  //   "English (Native)"  → "English"
  //   "Arabic - Fluent"   → "Arabic"
  //   "French — Conversational" → "French"
  return name
    .replace(/\s*[(\[].*?[)\]]\s*$/, "")
    .replace(/\s*[-–—]\s*(native|fluent|professional|advanced|conversational|intermediate|basic|elementary|beginner).*$/i, "")
    .replace(/\s*\b(?:native|fluent|professional|advanced|conversational|intermediate|basic|elementary|beginner)\b.*$/i, "")
    .trim();
}

// ── UAE labeled-field harvesting ─────────────────────────────────────────────
//
// GCC CVs routinely carry labeled personal-detail lines ("Visa Status:
// Employment visa", "Nationality: Indian", "Notice Period: 30 days").
// These were ignored before the 2026-06 wave-3 work; now they map straight
// into the builder's UAE Essentials fields.

const UAE_LABEL_PATTERNS: Array<{
  key: keyof ParsedUaeFields;
  re: RegExp;
}> = [
  { key: "nationality", re: /^nationality\s*[:\-–]\s*(.+)$/i },
  { key: "visaStatus", re: /^(?:visa\s*status|visa|residency\s*status)\s*[:\-–]\s*(.+)$/i },
  {
    key: "availability",
    re: /^(?:notice\s*period|availability|available\s*(?:from|to\s*join)?)\s*[:\-–]\s*(.+)$/i,
  },
  { key: "drivingLicense", re: /^driving\s*licen[sc]e\s*[:\-–]\s*(.+)$/i },
];

function harvestUaeFields(lines: string[]): {
  uae: ParsedUaeFields;
  consumedLines: Set<number>;
} {
  const uae: ParsedUaeFields = {};
  const consumed = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    for (const { key, re } of UAE_LABEL_PATTERNS) {
      const m = line.match(re);
      if (m && !uae[key]) {
        uae[key] = m[1].trim();
        consumed.add(i);
        break;
      }
    }
  }
  return { uae, consumedLines: consumed };
}

// ── Phone normalization ──────────────────────────────────────────────────────

/**
 * Normalize UAE phone formats toward "+971 5X XXX XXXX". "00971…" and bare
 * "971…"/"05X…" forms are common in Word CVs; ATS systems and recruiters
 * expect the +971 form. Non-UAE numbers pass through untouched.
 */
function normalizePhone(raw: string): string {
  const original = raw.trim();
  const digits = original.replace(/\D/g, "");
  let local: string | null = null;
  if (digits.startsWith("00971")) local = digits.slice(5);
  else if (digits.startsWith("971") && digits.length >= 11 && digits.length <= 12)
    local = digits.slice(3);
  else if (digits.startsWith("05") && digits.length === 10) local = digits.slice(1);
  else if (original.startsWith("+971")) local = digits.slice(3);
  if (local === null) return original;
  const grouped =
    local.length === 9
      ? `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
      : local;
  return `+971 ${grouped}`.trim();
}

// ── Projects block parser ────────────────────────────────────────────────────

function parseProjectsBlock(lines: string[]): ParsedProject[] {
  const out: ParsedProject[] = [];
  let current: ParsedProject | null = null;
  const push = () => {
    if (current && ((current.name ?? "").trim() || current.bullets?.length)) {
      out.push(current);
    }
    current = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isBulletLine(line)) {
      if (!current) current = { bullets: [] };
      current.bullets = current.bullets ?? [];
      current.bullets.push(stripBulletPrefix(line));
      continue;
    }
    // New project header. "Name — detail" puts the detail into the first
    // bullet so nothing the user wrote is dropped.
    push();
    const parts = line.split(/\s+(?:—|–|\|)\s+/).map((p) => p.trim());
    current = {
      name: parts[0],
      bullets: parts.slice(1).filter(Boolean),
    };
    const url = line.match(GENERIC_URL_RE);
    if (url) current.link = url[0];
  }
  push();
  return out;
}

// ── Contact harvesting ───────────────────────────────────────────────────────

const CONTACT_SCAN_DEPTH = 30;

function harvestContact(lines: string[]): {
  contact: NonNullable<ParsedDocument["contact"]>;
  nameLine: number;
  consumedLines: Set<number>;
} {
  const contact: NonNullable<ParsedDocument["contact"]> = {};
  const consumed = new Set<number>();
  let nameLine = -1;

  const depth = Math.min(lines.length, CONTACT_SCAN_DEPTH);

  for (let i = 0; i < depth; i++) {
    const line = lines[i];
    if (!line) continue;
    if (detectSection(line)) break;

    let matchedSomething = false;

    const emailMatch = line.match(EMAIL_RE);
    if (emailMatch && !contact.email) {
      contact.email = emailMatch[0];
      matchedSomething = true;
    }

    const liMatch = line.match(LINKEDIN_RE);
    if (liMatch && !contact.linkedin) {
      contact.linkedin = `https://linkedin.com/in/${liMatch[1]}`;
      matchedSomething = true;
    }

    // Find a non-LinkedIn URL on the same line. Used for website.
    // Use the bare-domain matcher because our templates strip http/www from
    // displayed links — "interior-360.com", not "https://interior-360.com".
    // Mask out emails first so their domain doesn't leak as a website hit.
    if (!contact.website) {
      const masked = line.replace(new RegExp(EMAIL_RE.source, "g"), " ");
      const urls = masked.match(new RegExp(BARE_DOMAIN_RE.source, "gi")) ?? [];
      const nonLi = urls.find((u) => !/linkedin\.com/i.test(u));
      if (nonLi) {
        contact.website = nonLi.replace(/[.,;:)]+$/, "");
        matchedSomething = true;
      }
    }

    const phoneMatch = line.match(PHONE_RE);
    if (phoneMatch && !contact.phone) {
      // Reject false positives (date ranges, stray years) — phones must have
      // 8 ≤ digit-count ≤ 15.
      const digits = phoneMatch[0].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15) {
        contact.phone = normalizePhone(phoneMatch[0]);
        matchedSomething = true;
      }
    }

    // Location: check the whole line, AND each segment of a multi-field
    // contact bar like "email | phone | Dubai | linkedin | website".
    if (!contact.location) {
      const segments = line.split(/\s+\|\s+|\s+·\s+|\s+•\s+/);
      for (const seg of segments) {
        // Strip any leading emoji/icon prefix used in our PDF templates
        // (📍, ✉️, 📞, etc.) so the saved value is plain text, and drop a
        // leading "Location:" / "Address:" / "City:" label — Word CVs label
        // their contact lines, and the label used to leak into the value.
        const s = seg
          .replace(/^[^A-Za-zÀ-ɏ0-9]+/, "")
          .replace(/^(?:location|address|city)\s*[:\-–]\s*/i, "")
          .trim();
        if (!s) continue;
        if (s.match(EMAIL_RE)) continue;
        if (s.match(BARE_DOMAIN_RE)) continue;
        if (s.match(PHONE_RE)) {
          const digits = s.replace(/\D/g, "");
          if (digits.length >= 8 && digits.length <= 15) continue;
        }
        if (looksLikeLocation(s)) {
          contact.location = s;
          matchedSomething = true;
          break;
        }
      }
    }

    if (matchedSomething) consumed.add(i);
  }

  // Name: the first non-consumed, short, alphabetic line in the top depth
  // that doesn't look like a section header or contact value.
  for (let i = 0; i < depth; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i]?.trim();
    if (!line) continue;
    if (detectSection(line)) break;
    if (line.length > 70) continue;
    if (line.match(EMAIL_RE) || line.match(GENERIC_URL_RE) || line.match(PHONE_RE)) continue;
    // Must contain at least one alphabetic char and not look like a headline / sentence.
    if (!/[A-Za-zÀ-ɏ؀-ۿ]/.test(line)) continue;
    // Likely headline if it's a known job title.
    if (looksLikeRole(line)) {
      // Could still be the name on the same line; but typically headline.
      // Treat as headline, not name.
      continue;
    }
    contact.name = line;
    consumed.add(i);
    nameLine = i;
    break;
  }

  return { contact, nameLine, consumedLines: consumed };
}

// ── Public entry point ───────────────────────────────────────────────────────

export function parseTextToDocument(text: string): ParsedDocument {
  // Normalise: split, trim, drop empty. We keep an index-aligned array so the
  // contact harvester can mark lines as consumed.
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((l) => l.replace(/ /g, " ").trim());

  const result: ParsedDocument = {
    contact: {},
    summary: "",
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    uae: {},
  };

  const { contact, consumedLines } = harvestContact(lines);
  result.contact = contact;

  // UAE labeled fields can appear anywhere (header block or a "Personal
  // Details" section) — sweep the whole document and consume the lines so
  // they don't pollute the section buffers.
  const { uae, consumedLines: uaeConsumed } = harvestUaeFields(lines);
  result.uae = uae;
  for (const i of uaeConsumed) consumedLines.add(i);

  // Section routing — start AFTER the first section header (so headline /
  // tagline lines in the header block don't accidentally land in "summary").
  let currentSection: string | null = null;
  const buffers: Record<string, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };

  // Find the first section header — everything before it is the contact /
  // headline block.
  let firstSectionIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (detectSection(lines[i])) {
      firstSectionIdx = i;
      break;
    }
  }

  // Header-block lines we couldn't harvest (headlines, taglines, column
  // labels) used to be silently dropped. Collect them so the review screen
  // can show a copyable "we couldn't place this" bucket (audit Wave 3).
  const unplaced: string[] = [];
  for (let i = 0; i < firstSectionIdx; i++) {
    const line = lines[i];
    if (!line) continue;
    if (consumedLines.has(i)) continue;
    unplaced.push(line);
  }
  result.unplaced = unplaced;

  for (let i = firstSectionIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (consumedLines.has(i)) continue;
    const sec = detectSection(line);
    if (sec) {
      currentSection = sec;
      continue;
    }
    if (currentSection && buffers[currentSection] !== undefined) {
      buffers[currentSection].push(line);
    }
  }

  result.summary = buffers.summary.join(" ").replace(/\s{2,}/g, " ").trim();
  result.experience = parseExperienceBlock(buffers.experience);
  result.education = parseEducationBlock(buffers.education);
  result.certifications = parseCertificationsBlock(buffers.certifications);
  // A detected Projects section used to be buffered and then silently
  // dropped — nothing the parser detects gets discarded any more.
  result.projects = parseProjectsBlock(buffers.projects);

  result.skills = flattenList(buffers.skills);

  // Languages: keep just the language name (strip any "(Level)" qualifier);
  // the field mapper currently only stores name.
  result.languages = flattenList(buffers.languages)
    .map(stripLanguageLevel)
    .filter(Boolean);

  return result;
}
