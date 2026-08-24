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
// "to date" (two words) is how UAE CVs most often write an open-ended role —
// "Jan 2020 – to date", "March 2022 to date" — and it was the one spelling this
// pattern missed, so those entries imported with isCurrent: false. The
// negative lookbehind keeps "up to date" out: an unmarked bullet like "Kept
// inventory records up to date" can reach the header path on two-column PDFs
// (where pdf.js drops the bullet glyph), and must not mark the role current.
const PRESENT_RE =
  /\b(?:present|current|now|ongoing|till\s+date|(?<!\bup\s)to\s+date|todate)\b/i;

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

/**
 * Collapse letter-spaced headings so tracked/spaced section titles still
 * match SECTION_PATTERNS. Designed CV templates — including our own PDF
 * export — render headings with letter-spacing, which pdf.js re-emits as
 * "E X P E R I E N C E" / "S U M M A RY" (glyph gaps become spaces, and
 * kerning makes the splits uneven: "E D U C AT I O N"). Without this,
 * every section of our own exported PDF landed in `unplaced` and imports
 * shrank to contact-only (Part 5 funnel audit, 2026-08-04).
 *
 * The collapsed form is ONLY tested against the known heading patterns, so
 * a false collapse of a genuine content line can never misfile text — it
 * simply fails the match like any other non-heading.
 */
function despaceIfLetterSpaced(line: string): string | null {
  const tokens = line.split(/\s+/);
  if (tokens.length < 3) return null;
  const avg = tokens.reduce((n, t) => n + t.length, 0) / tokens.length;
  if (avg > 2.6) return null;
  if (!tokens.every((t) => /^[A-Za-z&]+$/.test(t))) return null;
  return tokens.join("");
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
  const despaced = despaceIfLetterSpaced(trimmed);
  if (despaced) {
    for (const { key, re } of SECTION_PATTERNS) {
      if (re.test(despaced)) return key;
    }
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

// Pipe / middot / bullet are pure separators — they never appear inside a real
// word, so we split on them even when glued to adjacent text. PDF text
// extraction frequently drops the space before a pipe ("Role| Company"), which
// previously left role+company fused in one field (and seeded a broken
// headline). Dash and the word "at" still require surrounding whitespace so
// hyphenated words ("Co-founder") and "at" inside words stay intact.
const GLUED_SEP = /[|·•]/;
const SPACED_SEP = /\s+(?:—|–|-{1,2}|at)\s+/i;
// Combined splitter: pipe/middot/bullet with optional surrounding space, OR a
// space-delimited dash / "at".
const HEADER_SPLIT_RE = /\s*[|·•]\s*|\s+(?:—|–|-{1,2}|at)\s+/i;

function splitHeaderParts(text: string): string[] {
  let parts: string[];
  if (GLUED_SEP.test(text) || SPACED_SEP.test(text)) {
    parts = text.split(HEADER_SPLIT_RE);
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

// ── Attestation detection ────────────────────────────────────────────────────
//
// UAE CVs list degree attestation under the relevant education entry ("Attested
// — MOFA"), and the builder models it as `attested` + `attestingBody` on the
// education record (not a separate block). We fold any attestation line into the
// preceding entry rather than letting it spawn a phantom degree.
//
// The labels below MUST stay byte-identical to ATTESTING_BODIES in
// components/builder/steps/EducationStep.tsx (en dash "–", curly quote "’") so
// an imported value selects an existing dropdown option instead of free text.
const ATTESTING_BODY_OPTIONS: Array<{ re: RegExp; label: string }> = [
  { re: /\bmofaic\b/i, label: "MOFAIC – Ministry of Foreign Affairs & Int’l Cooperation" },
  { re: /\bmofa\b|ministry of foreign affairs/i, label: "MOFA – UAE Ministry of Foreign Affairs" },
  { re: /\bhec\b|higher education commission/i, label: "HEC – Higher Education Commission (Pakistan)" },
  { re: /\bwes\b|world education services/i, label: "WES – World Education Services (Canada)" },
  { re: /\bnaric\b|uk enic/i, label: "NARIC – UK ENIC National Recognition" },
  { re: /\bnoosr\b/i, label: "NOOSR – Australia" },
  { re: /\bdataflow\b|\bdha\b|\bhaad\b/i, label: "DATAFLOW – Healthcare / DHA / HAAD Verification" },
  { re: /embassy attestation/i, label: "Embassy Attestation – Home Country" },
  { re: /\bnotar/i, label: "Notary / Legal Attestation" },
];

function isAttestationLine(line: string): boolean {
  return (
    /\battest(?:ed|ation|s)?\b/i.test(line) ||
    /\bmofaic?\b/i.test(line) ||
    /ministry of foreign affairs/i.test(line) ||
    /\bequivalen(?:cy|ce)\b/i.test(line) ||
    /\b(?:dataflow|naric|noosr)\b/i.test(line) ||
    /embassy attestation/i.test(line)
  );
}

function matchAttestingBody(line: string): string {
  for (const { re, label } of ATTESTING_BODY_OPTIONS) {
    if (re.test(line)) return label;
  }
  return "";
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

    // Attestation lines fold into the current (or most recent) education entry's
    // attested + attestingBody fields instead of spawning a fake degree entry.
    // We only fold when there is an entry to attach to — otherwise we let the
    // line fall through to normal parsing so nothing is silently dropped.
    if (isAttestationLine(line)) {
      const target = current ?? entries[entries.length - 1];
      if (target) {
        target.attested = true;
        if (!target.attestingBody) {
          const body = matchAttestingBody(line);
          if (body) target.attestingBody = body;
        }
        continue;
      }
    }

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

// ── Mis-bucket rescue (two-column header merges) ─────────────────────────────
//
// pdf.js linearises two-column layouts so side-by-side section headers can land
// on ONE text line — e.g. "Languages Certifications" — which detectSection
// (anchored to a whole-line heading) misses. The section boundary is lost and
// the interleaved languages + certifications fall into the Skills bucket
// (founder bug report 2026-06: languages & certs imported as skills). Reading
// order can't be un-interleaved reliably, so we re-route by CONTENT: a Skills
// entry that is clearly a language or a certification is moved to the right
// field, and pure header / date / domain artifacts are dropped. Conservative
// by design — anything ambiguous stays a skill for the user to fix on the
// review screen, and a correctly-parsed CV is left untouched.

const KNOWN_LANGUAGES = new Set<string>([
  "english", "arabic", "urdu", "hindi", "punjabi", "pashto", "persian", "farsi",
  "dari", "malayalam", "tamil", "telugu", "kannada", "bengali", "bangla",
  "marathi", "gujarati", "sinhala", "nepali", "tagalog", "filipino", "cebuano",
  "french", "spanish", "german", "italian", "portuguese", "dutch", "russian",
  "ukrainian", "polish", "romanian", "greek", "turkish", "mandarin", "chinese",
  "cantonese", "japanese", "korean", "vietnamese", "thai", "indonesian", "malay",
  "swahili", "amharic", "tigrinya", "somali", "hausa", "yoruba", "igbo",
  "afrikaans", "hebrew", "kurdish", "azerbaijani", "uzbek", "kazakh", "sindhi",
]);

// Only true SECTION-NAME words — deliberately NOT generic skill-ish words like
// "professional", "development", "training", "expertise", so a real skill made
// of those (e.g. "Professional Development") is never dropped. A column-merged
// header is always a pair of section names ("Languages Certifications").
const HEADING_WORD_RE =
  /^(?:skills?|languages?|certif(?:ications?|icates?|s)?|certs?|licen[cs]es?|accreditations?|education|experience|projects?|summary|profile|objective|references?|interests?|hobbies|awards?|achievements?|publications?|portfolio|memberships?|volunteering)$/i;

/** A line made up ONLY of section-name words — i.e. a column-merged header pair
 *  like "Languages Certifications" that leaked into a content bucket. Requires
 *  ≥2 such words so a single legitimately-named entry isn't dropped. */
function isHeadingOnlyLine(s: string): boolean {
  const cleaned = normalizeHeader(s);
  if (!cleaned || cleaned.length > 50) return false;
  const tokens = cleaned.split(/\s+/);
  return tokens.length >= 2 && tokens.length <= 4 && tokens.every((t) => HEADING_WORD_RE.test(t));
}

/** A single token that is just a cert issuer's website (e.g. "mckinsey.org").
 *  The TLD allowlist is deliberately narrow — only issuer-style TLDs — so it
 *  never eats tech-skill tokens like "ASP.NET", "Socket.io", "Node.js". */
function isBareDomain(s: string): boolean {
  return /^[\w-]{2,}\.(?:com|org|edu|gov)(?:\.[a-z]{2})?$/i.test(s.trim());
}

/** If the entry begins with a known language name (before any level/qualifier
 *  delimiter), return that name in its original casing; else null. Requires the
 *  HEAD to equal a known language, so multi-word skills like "English Teaching"
 *  are left alone. */
function knownLanguageName(s: string): string | null {
  const head = s.split(/[([:/\-–—]/)[0].trim();
  return head && KNOWN_LANGUAGES.has(head.toLowerCase()) ? head : null;
}

/** A proficiency qualifier — only reclassify a language-named Skills entry when
 *  it carries one (e.g. "English (C1)", "Arabic – Native"), so a bare "Arabic"
 *  or "Mandarin" listed as a skill is never moved. Two-column language blocks
 *  almost always show a level, so the real bug case still matches. */
function hasLevelQualifier(s: string): boolean {
  return (
    /[([]/.test(s) ||
    /\b(?:native|fluent|professional|conversational|elementary|intermediate|advanced|basic|beginner|bilingual|proficient|working)\b/i.test(s) ||
    /\bmother\s*tongue\b/i.test(s) ||
    /\b[abc][12]\b/i.test(s)
  );
}

/** Conservative certification signal: an explicit credential KEYWORD as a whole
 *  word. Deliberately NOT "license" (would catch "License Plate Recognition")
 *  and NOT a trailing "program" (would catch "Affiliate Program" / "Loyalty
 *  Program") — those broke real skills. A borderline "X Program" stays a skill
 *  for the user to move on the review screen. */
function looksLikeCertEntry(s: string): boolean {
  return /\b(?:certif(?:icate|ication|ied)|diplomas?|accreditation|credential|nanodegree)\b/i.test(
    s,
  );
}

/** Normalised key for cert de-dupe: lowercased, trailing "certificate/
 *  certification" stripped, so "PMP Certification" (rescued) doesn't duplicate
 *  a "PMP" already parsed from a real Certifications section. */
function certKey(name: string): string {
  return name.toLowerCase().replace(/\s*certif(?:icate|ication)s?\s*$/i, "").trim();
}

/** Re-route languages/certifications that fell into Skills and drop header /
 *  date / domain artifacts. Mutates `result`. See block comment above.
 *
 *  GATED: runs ONLY when a column-merged section header ("Languages
 *  Certifications") actually leaked into Skills — the signature of the
 *  two-column boundary loss this targets. A cleanly-parsed CV has no such line,
 *  so its Skills are left exactly as the user wrote them (a skill literally
 *  named "Arabic" or "Affiliate Program" is never touched). */
function rescueMisbucketedSkills(result: ParsedDocument): void {
  const skills = result.skills ?? [];
  if (!skills.some(isHeadingOnlyLine)) return;

  const languages = result.languages ?? [];
  const certifications = result.certifications ?? [];
  const langSeen = new Set(languages.map((l) => l.toLowerCase()));
  const certSeen = new Set(certifications.map((c) => certKey(c.name ?? "")));
  const kept: string[] = [];
  const keptSeen = new Set<string>();

  for (const raw of skills) {
    const s = raw.trim();
    if (!s) continue;
    if (isHeadingOnlyLine(s) || isDateOnlyLine(s) || isBareDomain(s)) continue;

    const lang = knownLanguageName(s);
    if (lang && hasLevelQualifier(s)) {
      const key = lang.toLowerCase();
      if (!langSeen.has(key)) {
        languages.push(lang);
        langSeen.add(key);
      }
      continue;
    }

    if (looksLikeCertEntry(s)) {
      const cert = parseCertificationsBlock([s])[0];
      const key = cert?.name ? certKey(cert.name) : "";
      if (cert && key && !certSeen.has(key)) {
        certifications.push(cert);
        certSeen.add(key);
      }
      continue;
    }

    const key = s.toLowerCase();
    if (!keptSeen.has(key)) {
      kept.push(s);
      keptSeen.add(key);
    }
  }

  result.skills = kept;
  result.languages = languages;
  result.certifications = certifications;
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
    // Detect a link anywhere in the header: an explicit URL first, else a bare
    // domain ("usehisaab.com") — our exports strip http/www, so project links
    // arrive as bare domains and used to get stranded inside the name.
    const urlMatch = line.match(GENERIC_URL_RE) ?? line.match(BARE_DOMAIN_RE);
    const link = urlMatch
      ? urlMatch[0].replace(/[.,;:)]+$/, "")
      : undefined;
    // Split on glued/spaced separators (pipe/middot/bullet glue-safe), then
    // drop the link token so it doesn't double up as the name or a bullet.
    const parts = line
      .split(/\s*[|·•]\s*|\s+(?:—|–)\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const nonLink = parts.filter((p) => !link || p !== link);
    current = {
      name: nonLink[0] ?? parts[0] ?? "",
      link,
      bullets: nonLink.slice(1).filter(Boolean),
    };
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

  // Headline / tagline: the title line that sits with the name in the header
  // block (e.g. "Senior Operations Manager", "Odoo Administrator"). The parser
  // used to drop this into the unplaced bucket; we now lift it into the contact
  // so it seeds the builder's headline directly. We look just below the name,
  // skip any already-consumed contact lines, and accept a line that reads like a
  // job title or carries a title separator ("Accountant | CMA Candidate").
  if (nameLine >= 0 && !contact.headline) {
    for (let i = nameLine + 1; i < depth; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i]?.trim();
      if (!line) continue;
      if (detectSection(line)) break;
      if (line.length > 90) continue;
      // Skip contact-value lines — those aren't the headline.
      if (
        line.match(EMAIL_RE) ||
        line.match(GENERIC_URL_RE) ||
        line.match(BARE_DOMAIN_RE) ||
        line.match(PHONE_RE)
      ) {
        continue;
      }
      const titleish = looksLikeRole(line) || /\s[|·•—–]\s/.test(line);
      if (titleish) {
        contact.headline = line;
        consumed.add(i);
        break;
      }
    }
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

  // Two-column PDFs merge section headers onto one line, so languages and
  // certifications can land in Skills — re-route them by content (see
  // rescueMisbucketedSkills). No-op on cleanly-parsed CVs.
  rescueMisbucketedSkills(result);

  return result;
}
