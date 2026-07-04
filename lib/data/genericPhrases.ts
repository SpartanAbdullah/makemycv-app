/**
 * Generic / weak-phrase detector (Phase 2 personalization).
 *
 * The universal failure mode across every job domain is filler wording —
 * "responsible for", "hardworking team player", "proven track record" — that
 * describes a job instead of an achievement and carries zero ATS signal. This
 * flags the clearest, least-ambiguous offenders so the score can nudge the
 * user to rewrite. Kept conservative on purpose: only phrases recruiters
 * genuinely flag as clichés, to avoid false positives on legitimate wording.
 */

// Lowercased. Matched as whole phrases (word-boundary aware) against CV text.
export const WEAK_PHRASES: string[] = [
  "responsible for",
  "responsibilities include",
  "responsibilities included",
  "duties include",
  "duties included",
  "in charge of",
  "team player",
  "hardworking",
  "hard working",
  "hard-working",
  "go-getter",
  "go getter",
  "think outside the box",
  "proven track record",
  "results-oriented",
  "results oriented",
  "detail-oriented",
  "detail oriented",
  "self-motivated",
  "self motivated",
  "track record of success",
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Precompiled: whole-phrase, word-boundary-aware, case-insensitive.
const WEAK_PHRASE_REGEXPS = WEAK_PHRASES.map(
  (p) => new RegExp(`\\b${escapeRegExp(p)}\\b`, "i"),
);

/** Returns the distinct weak phrases present in the given text (lowercased). */
export function findWeakPhrases(text: string | undefined): string[] {
  if (!text || !text.trim()) return [];
  const found: string[] = [];
  for (let i = 0; i < WEAK_PHRASE_REGEXPS.length; i++) {
    if (WEAK_PHRASE_REGEXPS[i].test(text)) found.push(WEAK_PHRASES[i]);
  }
  return found;
}

/** True if the text contains at least one weak phrase. */
export function hasWeakPhrase(text: string | undefined): boolean {
  if (!text || !text.trim()) return false;
  return WEAK_PHRASE_REGEXPS.some((re) => re.test(text));
}
