import type { CvPersonal } from "../types/cv";

/** Stable identity of a chip. Look chips up by this, never by `label`. */
export type EssentialKey = "visa" | "availability" | "licence" | "nationality";

export type EssentialChip = { key: EssentialKey; label: string; value: string };

/**
 * Build the ordered list of UAE-essential chips for the given personal data.
 * Skips chips whose source value is empty, missing, or the literal "None".
 *
 * Order chosen so the most recruiter-relevant items come first
 * (visa status, then availability, then driving licence, then nationality).
 *
 * `label` is the text printed on the CV. The licence label was "DL" until
 * 2026-11: on nine templates the words "driving licence" then appeared nowhere
 * in the document, so a recruiter's search or an ATS keyword match for the
 * phrase found nothing on a CV that held one (product audit T10). The label is
 * now the full words everywhere. Templates that need a different wording, or
 * a different order, select by `key` — four of them used to select by the
 * label text, which is why changing a label was not safe before.
 */
export function getEssentialChips(personal: CvPersonal): EssentialChip[] {
  const chips: EssentialChip[] = [];

  const visa = personal.visaStatus?.trim();
  if (visa) chips.push({ key: "visa", label: "Visa", value: visa });

  const availability = personal.availability?.trim();
  if (availability) chips.push({ key: "availability", label: "Available", value: availability });

  const dl = personal.drivingLicense?.trim();
  if (dl && dl !== "None") chips.push({ key: "licence", label: "Driving licence", value: dl });

  const nationality = personal.nationality?.trim();
  if (nationality) chips.push({ key: "nationality", label: "Nationality", value: nationality });

  return chips;
}
