import type { CvData } from "../types/cv";

/**
 * What each template actually prints (product audit 2026-11, T6–T8).
 *
 * Until this file existed the only way to learn that a template leaves out
 * the photo or the date of birth was to pick it and compare the page with
 * what you typed — four templates dropped the date of birth and two the
 * photo with no notice, and the Colours control did nothing on the default
 * template. The lists below are the one place that says so; the Design panel
 * and the template notices read them.
 *
 * Plain data on purpose: `lib/` unit tests cannot import the `.tsx`
 * registry. `capabilities.test.ts` reads the template sources and fails when
 * a list here stops matching what a template file does, so a template that
 * gains (or loses) a field cannot drift away from its notice.
 *
 * Both render paths count: a field is "printed" only when the live template
 * AND its PDF layout in `components/pdf/CVDocument.tsx` print it.
 */

/** Templates that never draw the photo, whatever the user's switch says. */
export const TEMPLATES_WITHOUT_PHOTO: readonly string[] = ["harvard", "professional"];

/** Templates that never print the date of birth. */
export const TEMPLATES_WITHOUT_DATE_OF_BIRTH: readonly string[] = [
  "harvard",
  "onyx",
  "professional",
  "professional-photo",
];

/**
 * Templates that draw nothing in the user's accent colour. Harvard prints
 * black only; Classic and Modern use their own fixed slate and emerald.
 */
export const TEMPLATES_WITHOUT_ACCENT: readonly string[] = ["classic", "modern", "harvard"];

export type TemplateCapabilities = {
  printsPhoto: boolean;
  printsDateOfBirth: boolean;
  usesAccent: boolean;
};

export const getTemplateCapabilities = (templateId: string | undefined): TemplateCapabilities => {
  const id = templateId ?? "classic";
  return {
    printsPhoto: !TEMPLATES_WITHOUT_PHOTO.includes(id),
    printsDateOfBirth: !TEMPLATES_WITHOUT_DATE_OF_BIRTH.includes(id),
    usesAccent: !TEMPLATES_WITHOUT_ACCENT.includes(id),
  };
};

export type OmittedDetail = "photo" | "dateOfBirth";

/**
 * The details this user has asked to show that `templateId` will not print.
 * Empty when there is nothing to warn about — a user with no photo is not
 * told that a template has no photo slot.
 */
export const getOmittedDetails = (
  templateId: string | undefined,
  data: Pick<CvData, "personal" | "settings">,
): OmittedDetail[] => {
  const caps = getTemplateCapabilities(templateId);
  const omitted: OmittedDetail[] = [];
  const wantsPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && data.settings.photoShape !== "hidden",
  );
  if (wantsPhoto && !caps.printsPhoto) omitted.push("photo");
  if (data.personal.dateOfBirth?.trim() && !caps.printsDateOfBirth) omitted.push("dateOfBirth");
  return omitted;
};

const DETAIL_WORDS: Record<OmittedDetail, string> = {
  photo: "your photo",
  dateOfBirth: "your date of birth",
};

/**
 * One sentence for the notice, or null when nothing is left out. Describes
 * the template, never the person, and names the way out.
 */
export const describeOmittedDetails = (
  templateName: string,
  omitted: OmittedDetail[],
): string | null => {
  if (omitted.length === 0) return null;
  const words = omitted.map((d) => DETAIL_WORDS[d]);
  const list = words.length === 1 ? words[0] : `${words[0]} or ${words[1]}`;
  const pronoun = omitted.length === 1 ? "it" : "them";
  return `The ${templateName} template does not print ${list}. Pick another template if you want ${pronoun} on your CV.`;
};
