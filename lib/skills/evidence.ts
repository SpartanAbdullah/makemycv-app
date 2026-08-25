/**
 * Skill evidence — "where in this CV is this skill actually shown?"
 *
 * Step 2 of the skills-step rebuild. Pure, synchronous, client-side, no
 * network and no AI: it answers the question at the instant the user hesitates,
 * which a modal round-trip cannot.
 *
 * ── Why this is NOT the detector that was reverted ──────────────────────────
 *
 * docs/jd-match-evidence-pass.md records a bullet-evidence detector that was
 * built, reviewed and reverted. Read it before changing anything here. It
 * failed because it located a term by TOKEN PROXIMITY — all significant stems
 * inside a small window, any order — which produced realistic false claims
 * ("machine learning" from "washing machine; learning curve was steep"). A
 * false "you already prove this" is the one error this feature must never make.
 *
 * This module is deliberately the narrow thing that revert left standing:
 *
 *   1. LITERAL ONLY. A term is evidenced when it (or a curated alias) appears
 *      as a whole token or contiguous phrase. No stemming, no token proximity,
 *      no subset matching. `skillVariantMatch` is deliberately NOT used against
 *      prose — the reverted design's own post-mortem notes that a two-token
 *      term is trivially a subset of a twenty-token bullet.
 *   2. BOUNDARY-SAFE. Matching goes through `termAppearsIn`, which respects the
 *      phrase-boundary sentinel added in the 2026-08-24 accuracy pass. The
 *      punctuation-gluing hazard the revert doc flagged as "worth a separate
 *      look" is the bug that pass fixed, so the specific false positive that
 *      killed the previous attempt is now structurally impossible here.
 *   3. CLOSED VOCABULARY. The reverted detector had to recognise arbitrary,
 *      reworded JD requirements — an open-vocabulary problem that genuinely
 *      needs semantics. This one is asked only about terms we already have a
 *      canonical spelling and an alias list for. That is a different, far
 *      easier question, and literal matching is the correct answer to it
 *      rather than a degraded approximation of one.
 *
 * The cost is recall, and we accept it knowingly: "managing the company's IT
 * infrastructure" will NOT evidence "Infrastructure Management". We would
 * rather miss a real skill than tell someone they have proven something they
 * have not. If that recall gap ever needs closing it needs an LLM and a
 * privacy decision, exactly as the revert doc concludes — not a looser regex.
 */
import type { CvData } from "../types/cv";
import { termAppearsIn } from "../jdMatch/match";

/** Where a skill was found. Structured so the UI can deep-link to it. */
export type EvidenceSource =
  | { kind: "certification"; id: string; name: string }
  | { kind: "experienceBullet"; id: string; role: string; company: string; bulletIndex: number }
  | { kind: "experienceRole"; id: string; role: string; company: string }
  | { kind: "projectBullet"; id: string; name: string; bulletIndex: number }
  | { kind: "projectName"; id: string; name: string }
  | { kind: "summary" }
  | { kind: "headline" }
  | { kind: "education"; id: string; school: string };

export type SkillEvidence = {
  /** The spelling that actually matched — canonical name or one of its aliases.
   *  Worth surfacing: "you wrote it as HAAD" is useful information. */
  matchedTerm: string;
  source: EvidenceSource;
  /** The full text the term was found in. The UI decides how to truncate. */
  snippet: string;
};

/**
 * Four states, which are the states the SkillsStep UI renders:
 *
 *   evidenced — on the skills list AND shown somewhere in the CV's own prose.
 *               The confident case; nothing to do.
 *   claimed   — on the skills list and nowhere else. Not an accusation: a
 *               prompt to add one line showing where it was used. This is the
 *               state no competitor ships, and the one that gives a hesitant
 *               user somewhere to put the doubt.
 *   unlisted  — shown in the CV's prose but missing from the skills list. The
 *               highest-value suggestion we can make, because the user has
 *               already supplied the proof and only needs the label. This is
 *               the vocabulary gap that the research ranked as the #1 friction.
 *   absent    — neither. A suggestion like any other.
 */
export type SkillStatus = "evidenced" | "claimed" | "unlisted" | "absent";

export type SkillAssessment = {
  status: SkillStatus;
  /** Present for "evidenced" and "unlisted"; null otherwise. */
  evidence: SkillEvidence | null;
};

/** A term to look for: its canonical spelling plus any alternates. */
export type SearchableSkill = {
  name: string;
  /** Spellings specific enough to trust in prose. Searched as evidence. */
  aliases?: string[];
  /**
   * Spellings that are also ordinary English words ("React", "Node", "Go").
   * Counted when they appear as a discrete entry on the skills list, but NEVER
   * searched for in prose — "the ability to react quickly" is not evidence of
   * React. Mirrors DomainSkill.weakAliases and the JD matcher's
   * AMBIGUOUS_TECH_FORMS.
   */
  weakAliases?: string[];
};

/** One searchable chunk of the CV, pre-extracted so a batch pass is cheap. */
type TextUnit = { text: string; source: EvidenceSource };

/**
 * Pre-extracted CV text, built once and reused across many skills.
 *
 * Units are ordered by EVIDENTIAL STRENGTH, strongest first, and the search
 * returns the first hit — so a skill held as a certification cites the
 * certification rather than a passing mention in the summary.
 */
export type EvidenceIndex = { units: TextUnit[] };

/**
 * Extract every part of the CV that can PROVE a skill.
 *
 * The skills list itself is deliberately excluded: a skill cannot be its own
 * evidence, and that exclusion is what makes the "claimed" state meaningful.
 */
export function buildEvidenceIndex(cv: CvData): EvidenceIndex {
  const units: TextUnit[] = [];

  // 1. Certifications — a held credential is the strongest proof there is, and
  //    in the UAE the licence chips (DHA, NEBOSH, RERA) live and die here.
  for (const cert of cv.certifications) {
    const name = (cert.name ?? "").trim();
    if (!name) continue;
    units.push({
      text: [name, cert.issuer ?? ""].filter(Boolean).join(" "),
      source: { kind: "certification", id: cert.id, name },
    });
  }

  // 2. Experience bullets — what the person actually did.
  for (const role of cv.experience) {
    role.bullets.forEach((bullet, bulletIndex) => {
      const text = (bullet ?? "").trim();
      if (!text) return;
      units.push({
        text,
        source: {
          kind: "experienceBullet",
          id: role.id,
          role: role.role,
          company: role.company,
          bulletIndex,
        },
      });
    });
  }

  // 3. Role titles — "Odoo Administrator" proves Odoo.
  for (const role of cv.experience) {
    const title = (role.role ?? "").trim();
    if (!title) continue;
    units.push({
      text: title,
      source: { kind: "experienceRole", id: role.id, role: title, company: role.company },
    });
  }

  // 4-5. Projects.
  for (const project of cv.projects ?? []) {
    const name = (project.name ?? "").trim();
    project.bullets.forEach((bullet, bulletIndex) => {
      const text = (bullet ?? "").trim();
      if (!text) return;
      units.push({
        text,
        source: { kind: "projectBullet", id: project.id, name, bulletIndex },
      });
    });
    if (name) {
      units.push({ text: name, source: { kind: "projectName", id: project.id, name } });
    }
  }

  // 6-7. Summary and headline — real, but the weakest kind of self-report.
  const summary = (cv.personal.summary ?? "").trim();
  if (summary) units.push({ text: summary, source: { kind: "summary" } });

  const headline = (cv.personal.headline ?? "").trim();
  if (headline) units.push({ text: headline, source: { kind: "headline" } });

  // 8. Education — a degree in the field, coursework, thesis notes.
  for (const edu of cv.education) {
    const text = [edu.degree, edu.field, edu.notes ?? ""].filter(Boolean).join(" ").trim();
    if (!text) continue;
    units.push({
      text,
      source: { kind: "education", id: edu.id, school: edu.school },
    });
  }

  return { units };
}

const dedupeTrimmed = (values: string[]): string[] => [
  ...new Set(values.map((s) => (s ?? "").trim()).filter(Boolean)),
];

/**
 * Spellings safe to search for in PROSE. Canonical name first, so
 * `matchedTerm` prefers the real name when several would hit.
 *
 * `weakAliases` are excluded by design — see SearchableSkill.
 */
function proseSpellings(skill: SearchableSkill): string[] {
  return dedupeTrimmed([skill.name, ...(skill.aliases ?? [])]);
}

/** Every spelling that counts as "already on the skills list", weak ones too. */
function listSpellings(skill: SearchableSkill): string[] {
  return dedupeTrimmed([
    skill.name,
    ...(skill.aliases ?? []),
    ...(skill.weakAliases ?? []),
  ]);
}

/**
 * First (strongest) place this skill is shown, or null.
 *
 * Literal, boundary-respecting matching only — see the module header.
 */
export function findEvidenceIn(
  index: EvidenceIndex,
  skill: SearchableSkill,
): SkillEvidence | null {
  const terms = proseSpellings(skill);
  if (terms.length === 0) return null;

  for (const unit of index.units) {
    for (const term of terms) {
      if (termAppearsIn(unit.text, term)) {
        return { matchedTerm: term, source: unit.source, snippet: unit.text };
      }
    }
  }
  return null;
}

/** Convenience wrapper for a one-off lookup. Prefer the index for batches. */
export function findSkillEvidence(
  cv: CvData,
  skill: SearchableSkill,
): SkillEvidence | null {
  return findEvidenceIn(buildEvidenceIndex(cv), skill);
}

/**
 * True when the skill is already on the CV's skills list.
 *
 * Alias-aware but still literal — an exact match on the canonical name or any
 * supplied alias. Deliberately NOT `skillVariantMatch`: this decides whether we
 * show the user a chip, and a fuzzy hit here would silently hide a suggestion.
 */
function isListed(cv: CvData, skill: SearchableSkill): boolean {
  const terms = new Set(listSpellings(skill).map((t) => t.toLowerCase()));
  return cv.skills.some((s) => terms.has((s.name ?? "").trim().toLowerCase()));
}

/** Classify one skill against the CV. See SkillStatus for what each means. */
export function assessSkill(
  cv: CvData,
  skill: SearchableSkill,
  index: EvidenceIndex = buildEvidenceIndex(cv),
): SkillAssessment {
  const evidence = findEvidenceIn(index, skill);
  const listed = isListed(cv, skill);

  if (listed) return { status: evidence ? "evidenced" : "claimed", evidence };
  return evidence ? { status: "unlisted", evidence } : { status: "absent", evidence: null };
}

/** Batch form — builds the index once. Keyed by each skill's canonical name. */
export function assessSkills(
  cv: CvData,
  skills: SearchableSkill[],
): Map<string, SkillAssessment> {
  const index = buildEvidenceIndex(cv);
  const out = new Map<string, SkillAssessment>();
  for (const skill of skills) {
    out.set(skill.name, assessSkill(cv, skill, index));
  }
  return out;
}

/**
 * Short human phrase naming where the evidence sits — "your Financial Analyst
 * role at Unilever Gulf". Kept here so the wording has one definition and can
 * be tested; the UI supplies the sentence around it.
 */
export function describeEvidence(evidence: SkillEvidence): string {
  const s = evidence.source;
  switch (s.kind) {
    case "certification":
      return `your ${s.name} certification`;
    case "experienceBullet":
    case "experienceRole": {
      const role = s.role.trim();
      const company = s.company.trim();
      if (role && company) return `your ${role} role at ${company}`;
      if (role) return `your ${role} role`;
      if (company) return `your time at ${company}`;
      return "your experience";
    }
    case "projectBullet":
    case "projectName":
      return s.name.trim() ? `your ${s.name.trim()} project` : "your projects";
    case "summary":
      return "your summary";
    case "headline":
      return "your headline";
    case "education":
      return s.school.trim() ? `your studies at ${s.school.trim()}` : "your education";
  }
}
