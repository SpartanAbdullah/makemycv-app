/**
 * Flatten a CvData object into a normalized text corpus for JD matching.
 * Runs client-side only — the CV never leaves the browser (PDPL, see spec).
 */
import type { CvData } from "../types/cv";

/**
 * Marks a hard phrase boundary the source text actually had — a clause
 * punctuation mark, or the seam between two separate CV fields. A multi-word
 * requirement must never match ACROSS one.
 *
 * Flattening every punctuation mark to a space (what this used to do) let the
 * substring check in `corpusHas` bridge unrelated words: "washing machine;
 * learning curve" became "washing machine learning curve", which literally
 * contains "machine learning". Recorded as a known bug in
 * docs/jd-match-evidence-pass.md — a false "your CV covers this" is the one
 * error this feature must not make.
 *
 * U+0001 is used because it cannot occur in CV or JD text and survives the
 * whitespace collapse below. It is always space-padded, so `tokenize()` sees
 * it as a standalone 1-char token and drops it with its existing length guard.
 */
export const PHRASE_BOUNDARY = "\u0001";

/**
 * Punctuation that ENDS a clause — the source text put a real gap here, so a
 * phrase may not span it.
 */
const PHRASE_BREAK_RE = /[,;:!?()[\]{}|"“”«»•·]+/g;

/**
 * A period that is NOT followed by an alphanumeric — i.e. a SENTENCE period,
 * not the one inside "node.js" / ".net" / "3.5". It ends a clause like any
 * other, and leaving it glued to the preceding token also broke whole-token
 * matching outright: "Built the admin console in React.js." produced the token
 * "react.js." which no requirement for "react.js" could ever equal.
 */
const SENTENCE_PERIOD_RE = /\.(?![a-z0-9])/g;

/**
 * Everything else outside the kept set collapses to a space, as before. These
 * are word JOINERS — hyphen, slash, apostrophe, ampersand — and flattening
 * them is what makes "Six-Sigma" match a requirement for "Six Sigma". `+ # .`
 * stay literal (c++, c#, node.js, ga4), and the sentinel is excluded so it
 * survives this pass.
 */
// eslint-disable-next-line no-control-regex
const WORD_JOIN_RE = /[^a-z0-9+#.\s\u0001]/g;

/** Lowercase, mark clause boundaries, flatten word-joining punctuation to
 *  spaces, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(PHRASE_BREAK_RE, ` ${PHRASE_BOUNDARY} `)
    .replace(SENTENCE_PERIOD_RE, ` ${PHRASE_BOUNDARY} `)
    .replace(WORD_JOIN_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build one normalized string containing everything a JD requirement might
 * match against: headline, summary, role titles + companies + bullets,
 * skills, certifications, education fields, project names + bullets,
 * languages, and UAE-essentials (visa/nationality/driving licence).
 */
export function extractCvCorpus(cv: CvData): string {
  const parts: string[] = [];

  const p = cv.personal;
  parts.push(p.headline, p.summary, p.nationality ?? "", p.visaStatus ?? "");
  if (p.drivingLicense) parts.push("driving licence", p.drivingLicense);

  for (const role of cv.experience) {
    parts.push(role.role, role.company, role.location);
    parts.push(...role.bullets);
  }
  for (const edu of cv.education) {
    parts.push(edu.school, edu.degree, edu.field, edu.notes ?? "");
    if (edu.attested) parts.push("attested", edu.attestingBody ?? "");
  }
  for (const skill of cv.skills) parts.push(skill.name);
  for (const lang of cv.languages) parts.push(lang.name);
  for (const cert of cv.certifications) parts.push(cert.name, cert.issuer);
  for (const proj of cv.projects) {
    parts.push(proj.name);
    parts.push(...proj.bullets);
  }

  // Each part is normalized on its own and joined with the boundary sentinel:
  // the seam between two CV fields is as hard a break as a semicolon. Joining
  // with a plain space let a phrase bridge two unrelated entries — a bullet
  // ending "…the washing machine" followed by one starting "Learning new
  // procedures…" read as a literal "machine learning" hit.
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(` ${PHRASE_BOUNDARY} `);
}
