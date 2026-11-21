/**
 * One naming rule for every file the product hands the user (product audit
 * 2026-11, E4).
 *
 * Until this file there were three rules. The PDF kept only A–Z, 0–9, _ and
 * -, so "Renée Müller" downloaded as `CV_Rene_Mller.pdf` and a name written
 * in Arabic as `CV_MakeMyCV.pdf` — a CV named after the tool, sent to an
 * employer. Word used `First-Last-CV.docx` with no cleaning at all (a slash
 * or colon in a name broke the download), and the cover letter a third
 * pattern.
 *
 * The rule now:
 *   - Latin letters with accents fold to their base letter (é → e, ü → u,
 *     ß → ss). Plain ASCII is what the widest range of upload forms and mail
 *     gateways carries without mangling, and no letter is lost.
 *   - Letters of every other script are KEPT as written (Arabic, Cyrillic,
 *     Devanagari, CJK…). There is no honest way to transliterate them here,
 *     and every current operating system stores them.
 *   - Anything that is not a letter, a digit, _ or - goes: path separators,
 *     the characters Windows refuses, and invisible direction marks.
 *   - With no usable name the file is called after what it IS ("CV"), never
 *     after the product.
 *
 * Pure and dependency-free so lib tests can run it.
 */

/** Latin letters that Unicode does not decompose into base + accent. */
const LATIN_SPECIALS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  ł: "l",
  Ł: "L",
  þ: "th",
  Þ: "Th",
  ı: "i",
};

/**
 * A file-name-safe fragment of `value`: at most `maxLength` characters,
 * words joined with `_`, "" when nothing usable is left.
 */
export function fileNamePart(value: string | undefined | null, maxLength = 40): string {
  const folded = (value ?? "")
    // é → e + combining accent, then drop the accent — but only after a
    // Latin letter, so Arabic vowel marks and Indic signs stay attached.
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .replace(/[ßæÆœŒøØđĐðÐłŁþÞı]/g, (ch) => LATIN_SPECIALS[ch] ?? ch)
    .normalize("NFC");
  const cleaned = folded
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}\p{M}_-]/gu, "")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  // Cut by code point, so a surrogate pair is never split.
  return Array.from(cleaned).slice(0, maxLength).join("").replace(/[_-]+$/, "");
}

type NameFields = { firstName?: string | null; lastName?: string | null };

const namePart = (personal: NameFields): string =>
  [fileNamePart(personal.firstName), fileNamePart(personal.lastName)].filter(Boolean).join("_");

/**
 * `CV_First_Last.<ext>` — the same for PDF, Word and the backup — or
 * `<fallbackStem>.<ext>` when the CV has no name yet.
 */
export function cvFileName(personal: NameFields, extension: string, fallbackStem = "CV"): string {
  const name = namePart(personal);
  return `${name ? `CV_${name}` : fallbackStem}.${extension}`;
}

/** `Cover_Letter_First_Last_Company.docx`; name and company are both optional. */
export function coverLetterFileName(personal: NameFields, company: string | undefined | null): string {
  return `${["Cover_Letter", namePart(personal), fileNamePart(company)].filter(Boolean).join("_")}.docx`;
}
