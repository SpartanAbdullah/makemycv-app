/**
 * Skills-step suggestion assembly — what the step shows on arrival, and what a
 * search returns.
 *
 * Pure and synchronous. All of it runs locally against the CV the user already
 * has: no network, no AI, no latency at the moment of hesitation. The AI
 * suggest call still exists in the step, but it is no longer the only path to
 * "what should I have?".
 *
 * The step's job, per the research, is to answer three questions the old tray
 * of chips could not:
 *   1. what is this called?      -> search over colloquial phrases (naming gap)
 *   2. may I claim it?           -> evidence citations from the user's own CV
 *   3. which ones actually count -> must/nice tiering from the domain bank
 */
import type { CvData } from "../types/cv";
import type { RoleFamily } from "../data/roleFamily";
import {
  allDomainSkills,
  domainSkillEntries,
  type DomainSkill,
} from "../data/domainSkills";
import { softSkillSuggestions } from "../data/softSkills";
import {
  assessSkill,
  buildEvidenceIndex,
  type EvidenceIndex,
  type SkillEvidence,
  type SkillStatus,
} from "./evidence";
import { matchingPhrase, phraseMatches } from "./searchPhrases";

export type SuggestionSource = "bank" | "soft" | "freetext";

export type Suggestion = {
  name: string;
  source: SuggestionSource;
  status: SkillStatus;
  evidence: SkillEvidence | null;
  tier?: DomainSkill["tier"];
  kind?: DomainSkill["kind"];
  /** The colloquial phrase that surfaced this result, for "the usual term for …". */
  viaPhrase?: string;
};

/**
 * Below this many pieces of CV text, evidence-based UI is suppressed.
 *
 * A fresh graduate with an empty CV would otherwise see every skill marked as
 * unproven — an accusation generated entirely by the absence of input. Nothing
 * about the "claimed" state is honest when there is nothing to have proven it
 * with, so the step hides that whole surface instead.
 */
export const MIN_UNITS_FOR_EVIDENCE_UI = 3;

export function hasEnoughCvForEvidence(index: EvidenceIndex): boolean {
  return index.units.length >= MIN_UNITS_FOR_EVIDENCE_UI;
}

const norm = (s: string) => s.toLowerCase().trim();

function listedNames(cv: CvData): string[] {
  return cv.skills.map((s) => s.name).filter(Boolean);
}

/** Bank entries for the domain, or the whole bank when no domain is confirmed. */
function bankPool(domain: RoleFamily | undefined): DomainSkill[] {
  if (domain && domain !== "generic") {
    return domainSkillEntries(domain, [], 100);
  }
  return allDomainSkills();
}

function toSearchable(entry: DomainSkill) {
  return { name: entry.name, aliases: entry.aliases, weakAliases: entry.weakAliases };
}

export type ArrivalSuggestions = {
  /**
   * Skills the CV already PROVES but the list is missing. The highest-value
   * thing this step can show: the user supplied the proof, they only lacked
   * the word. Rendered first, with the citation.
   */
  alreadyShown: Suggestion[];
  /** Must-tier bank entries for the domain that the user does not have. */
  usuallyAsked: Suggestion[];
  /** Nice-tier entries plus soft skills — collapsed behind a disclosure. */
  alsoCommon: Suggestion[];
  /** Per-skill state for the user's OWN list, keyed by skill id. */
  listed: Map<string, { status: SkillStatus; evidence: SkillEvidence | null }>;
  /** False for a CV too thin to judge — suppresses all not-proven messaging. */
  evidenceUsable: boolean;
};

/**
 * Everything the step needs on arrival, computed in one pass over one index.
 */
export function arrivalSuggestions(
  cv: CvData,
  domain: RoleFamily | undefined,
  opts: { maxAlreadyShown?: number; maxUsuallyAsked?: number; maxAlsoCommon?: number } = {},
): ArrivalSuggestions {
  const { maxAlreadyShown = 5, maxUsuallyAsked = 8, maxAlsoCommon = 10 } = opts;
  const index = buildEvidenceIndex(cv);
  const evidenceUsable = hasEnoughCvForEvidence(index);
  const have = new Set(listedNames(cv).map(norm));

  // State of the user's own skills — drives the dot on every chip.
  const listed = new Map<string, { status: SkillStatus; evidence: SkillEvidence | null }>();
  for (const skill of cv.skills) {
    const entry = allDomainSkills().find((e) => norm(e.name) === norm(skill.name));
    const a = assessSkill(cv, entry ? toSearchable(entry) : { name: skill.name }, index);
    listed.set(skill.id, { status: a.status, evidence: a.evidence });
  }

  const alreadyShown: Suggestion[] = [];
  const usuallyAsked: Suggestion[] = [];
  const alsoCommon: Suggestion[] = [];

  for (const entry of bankPool(domain)) {
    if (have.has(norm(entry.name))) continue;
    const a = assessSkill(cv, toSearchable(entry), index);
    const s: Suggestion = {
      name: entry.name,
      source: "bank",
      status: a.status,
      evidence: a.evidence,
      tier: entry.tier,
      kind: entry.kind,
    };
    // "unlisted" = the CV proves it and the list is missing it. Always leads,
    // regardless of tier: the user's own proof outranks our curation.
    if (s.status === "unlisted" && evidenceUsable) alreadyShown.push(s);
    else if (entry.tier === "must") usuallyAsked.push(s);
    else alsoCommon.push(s);
  }

  // Soft skills never carry evidence — they are self-descriptions, and the
  // evidence machinery would only ever mark them unproven, which is noise.
  const recentRole = cv.experience[0]?.role ?? "";
  for (const name of softSkillSuggestions(recentRole, listedNames(cv), maxAlsoCommon, domain)) {
    if (have.has(norm(name))) continue;
    alsoCommon.push({ name, source: "soft", status: "absent", evidence: null });
  }

  return {
    alreadyShown: alreadyShown.slice(0, maxAlreadyShown),
    usuallyAsked: usuallyAsked.slice(0, maxUsuallyAsked),
    alsoCommon: alsoCommon.slice(0, maxAlsoCommon),
    listed,
    evidenceUsable,
  };
}

/** Where a query hit, worst to best. Higher wins. */
function scoreMatch(query: string, entry: DomainSkill): number {
  const q = norm(query);
  const name = norm(entry.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  for (const a of entry.aliases ?? []) {
    const al = norm(a);
    if (al === q) return 90;
    if (al.startsWith(q)) return 70;
    if (al.includes(q)) return 50;
  }
  for (const a of entry.weakAliases ?? []) {
    if (norm(a) === q) return 65;
  }
  return 0;
}

export type SearchResult = Suggestion & {
  /** True when the user already has this — shown as a note, not a pickable row. */
  alreadyHave: boolean;
};

/**
 * Type-ahead over the UAE bank, its aliases, and the colloquial phrase layer.
 *
 * Ranking, highest first:
 *   1. the CV already proves it        — their own words, strongest signal
 *   2. a colloquial phrase matched     — this is the naming gap being closed
 *   3. must-tier for their domain      — what decides the application
 *   4. how well the string matched
 *
 * Results the user already has are returned with `alreadyHave: true` rather
 * than dropped, so the UI can say "you already have Salesforce" instead of
 * silently returning nothing and looking broken.
 */
export function searchSkills(
  query: string,
  cv: CvData,
  domain: RoleFamily | undefined,
  limit = 8,
): SearchResult[] {
  const q = norm(query);
  if (q.length < 2) return [];

  const index = buildEvidenceIndex(cv);
  const evidenceUsable = hasEnoughCvForEvidence(index);
  const have = new Set(listedNames(cv).map(norm));
  const viaPhrase = new Set(phraseMatches(query));

  const scored: Array<{ result: SearchResult; rank: number }> = [];

  for (const entry of allDomainSkills()) {
    const strScore = scoreMatch(query, entry);
    const phraseHit = viaPhrase.has(entry.name);
    if (strScore === 0 && !phraseHit) continue;

    const a = assessSkill(cv, toSearchable(entry), index);
    const alreadyHave = have.has(norm(entry.name));

    let rank = strScore;
    if (phraseHit) rank += 55; // the naming gap is the point of this feature
    if (a.status === "unlisted" && evidenceUsable) rank += 70;
    if (entry.tier === "must" && domain && domain !== "generic") rank += 15;
    if (alreadyHave) rank -= 500; // keep it, but never above a real option

    scored.push({
      rank,
      result: {
        name: entry.name,
        source: "bank",
        status: a.status,
        evidence: evidenceUsable ? a.evidence : null,
        tier: entry.tier,
        kind: entry.kind,
        viaPhrase: phraseHit ? (matchingPhrase(entry.name, query) ?? undefined) : undefined,
        alreadyHave,
      },
    });
  }

  // De-duplicate: the same canonical name appears in several domain banks.
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.rank - a.rank)
    .filter(({ result }) => {
      const k = norm(result.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map(({ result }) => result);
}

/**
 * Should adding this require an explicit "I hold it" confirmation?
 *
 * Credentials are the one category where a wrong claim is checkable and
 * costly: UAE application forms ask about licences as knockout questions, and
 * a DHA licence or a RERA broker card either exists in a register or does not.
 * Everything else is a judgement call the user is entitled to make.
 */
export function needsCredentialGuard(s: Pick<Suggestion, "kind">): boolean {
  return s.kind === "credential";
}

/** Category a suggestion should be filed under when added. */
export function categoryFor(s: Pick<Suggestion, "kind" | "source">): "technical" | "general" {
  if (s.source === "soft") return "general";
  return s.kind === "tool" || s.kind === "system" ? "technical" : "general";
}
