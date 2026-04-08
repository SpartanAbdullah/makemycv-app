// ─── SANITIZERS (silent auto-correct, return cleaned string) ───

export function sanitizeEmail(value: string): string {
  return value.replace(/\s/g, "").toLowerCase();
}

export function sanitizeName(value: string): string {
  return value
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[^\p{L}\s\-'.]/gu, "");
}

export function sanitizePhone(value: string): string {
  return value.replace(/[^0-9+() \-]/g, "").trim();
}

export function sanitizeJobTitle(value: string): string {
  return value
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[^\p{L}\d\s\-,&./]/gu, "");
}

export function sanitizeCompanyName(value: string): string {
  return value
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[^\p{L}\d\s\-,.&()']/gu, "");
}

export function sanitizeLocation(value: string): string {
  return value
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[^\p{L}\d\s,\-.]/gu, "");
}

export function sanitizeURL(value: string): string {
  const trimmed = value.replace(/\s/g, "");
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function sanitizeSkill(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\d\s\-+#.&()/]/gu, "")
    .replace(/\s{2,}/g, " ");
}

export function sanitizePlainText(value: string): string {
  return value
    .replace(/[^\S\n\t]/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeYear(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 4);
}

export function sanitizeGrade(value: string): string {
  let result = "";
  let hasDecimal = false;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      result += ch;
    } else if (ch === "." && !hasDecimal) {
      hasDecimal = true;
      result += ch;
    }
  }
  return result;
}

export function sanitizeLanguageName(value: string): string {
  return value
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[^\p{L}\s\-]/gu, "");
}

// ─── VALIDATORS (return error string or null) ───

export function validateEmail(value: string): string | null {
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Please enter a valid email address";
  }
  return null;
}

export function validateURL(value: string): string | null {
  if (!value) return null;
  if (!/^https?:\/\/.+\..+/.test(value)) {
    return "Please enter a valid URL (e.g. https://...)";
  }
  return null;
}

export function validateLinkedIn(value: string): string | null {
  if (!value) return null;
  if (!value.includes("linkedin.com/in/")) {
    return "LinkedIn URL should look like linkedin.com/in/yourname";
  }
  return null;
}

export function validateYear(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}$/.test(value)) {
    return "Please enter a valid year (e.g. 2019)";
  }
  const year = parseInt(value, 10);
  const maxYear = new Date().getFullYear() + 2;
  if (year < 1950 || year > maxYear) {
    return "Please enter a valid year (e.g. 2019)";
  }
  return null;
}

export function validateYearRange(
  startYear: string,
  endYear: string,
): string | null {
  if (!startYear || !endYear) return null;
  if (parseInt(endYear, 10) < parseInt(startYear, 10)) {
    return "End year cannot be before start year";
  }
  return null;
}

export function validateGrade(value: string): string | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0 || num > 100) {
    return "Please enter a valid grade or GPA";
  }
  return null;
}

export function validateSummaryLength(value: string): string | null {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.length < 30) {
    return "Your summary is quite short. Aim for at least 30 words.";
  }
  if (words.length > 120) {
    return "Your summary is too long. UAE recruiters prefer under 120 words.";
  }
  return null;
}
