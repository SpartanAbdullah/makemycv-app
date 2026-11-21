import type { CvData } from "../types/cv";

/**
 * True when the CV has nothing to WORK WITH yet: no name, headline, summary,
 * skills, role, degree, certificate or project.
 *
 * The store seeds one blank experience and one blank education card
 * (defaultCvData), so "has entries" is not the test; an entry counts only when
 * something was typed into it.
 *
 * This is JD Match's question — is there anything to match a job against, or
 * should the visitor be guided to the builder first? It is deliberately NOT
 * the import screens' question. A CV holding only an email, a photo or a
 * language has nothing to match, but it has something to lose: use
 * `hasUserEnteredData` wherever the decision is whether data may be replaced.
 */
export const isCvEmpty = (cv: CvData): boolean => {
  const p = cv.personal;
  if (p.firstName?.trim() || p.lastName?.trim() || p.headline?.trim() || p.summary?.trim()) return false;
  if (cv.skills.length > 0) return false;
  if ((cv.certifications?.length ?? 0) > 0) return false;
  if ((cv.projects?.length ?? 0) > 0) return false;
  if (cv.experience.some((e) => e.role?.trim() || e.company?.trim() || (e.bullets ?? []).some((b) => b.trim())))
    return false;
  if (cv.education.some((e) => e.school?.trim() || e.degree?.trim() || e.field?.trim())) return false;
  return true;
};

/**
 * True when `value` holds any text a person typed, picked or uploaded:
 * a non-blank string anywhere inside it. `id` keys are generated, not typed,
 * and booleans on their own (a ticked "current role" on an otherwise empty
 * card) are not content.
 *
 * Deliberately generic rather than a list of field names: a field added to a
 * CV type later is covered without anyone remembering to add it here. The
 * hand-written list this replaces missed contact details, languages, the UAE
 * details and the photo (2026-11, review of PR #45).
 */
export const hasTypedContent = (value: unknown, key?: string): boolean => {
  if (key === "id") return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some((item) => hasTypedContent(item));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => hasTypedContent(v, k));
  }
  return false;
};

/**
 * True when replacing this CV would discard something its owner entered —
 * the import screens' question (default to "add", show the choice, offer
 * Undo). Settings are left out: an import keeps them whatever the mode.
 *
 * Stricter than `!isCvEmpty`: an email address, a phone number, a photo, a
 * language, a visa status or a job card with only its dates filled in all
 * count. Erring this way costs a pristine-looking builder one extra radio
 * button; erring the other way overwrote data with no Undo offered.
 */
export const hasUserEnteredData = (cv: CvData): boolean =>
  hasTypedContent(cv.personal) ||
  hasTypedContent(cv.experience) ||
  hasTypedContent(cv.education) ||
  hasTypedContent(cv.skills) ||
  hasTypedContent(cv.languages) ||
  hasTypedContent(cv.certifications) ||
  hasTypedContent(cv.projects);

/**
 * The same content, ignoring differences no person made: key order, a
 * missing field versus an empty one, `false` versus absent, padding spaces,
 * and blank strings inside lists (the seeded `bullets: [""]`).
 *
 * The store uses it to tell a real edit from a form writing back what it was
 * just given — the builder's forms do that after an import — so that only a
 * real edit ends the import's Undo.
 */
export const sameCvContent = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * `sameCvContent` for one section of the CV, as the store's updateSection
 * sees it. One difference: in `settings`, the job field the app GUESSES from
 * the headline (`domain` with `domainSource: "inferred"`) is left out. That
 * write happens on a mere blur of the headline box — nobody edited anything —
 * and it must not end an import's Undo. A field the user picked themselves
 * (`domainSource: "user"`) is compared like everything else.
 */
export const sameSectionContent = (section: string, a: unknown, b: unknown): boolean =>
  sameCvContent(withoutGuessedFields(section, a), withoutGuessedFields(section, b));

function withoutGuessedFields(section: string, value: unknown): unknown {
  if (section !== "settings" || value === null || typeof value !== "object") return value;
  const settings = value as Record<string, unknown>;
  if (settings.domainSource === "user") return settings;
  return Object.fromEntries(
    Object.entries(settings).filter(([k]) => k !== "domain" && k !== "domainSource"),
  );
}

function canonical(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (value === null || value === false) return undefined;
  if (Array.isArray(value)) {
    const items = value.map(canonical).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === "object" && value !== undefined) {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, canonical(v)] as const)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return value;
}
