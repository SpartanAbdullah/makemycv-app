import type { CvPersonal } from "../types/cv";

export type EssentialChip = { label: string; value: string };

/**
 * Build the ordered list of UAE-essential chips for the given personal data.
 * Skips chips whose source value is empty, missing, or the literal "None".
 *
 * Order chosen so the most recruiter-relevant items come first
 * (visa status, then availability, then driving licence, then nationality).
 */
export function getEssentialChips(personal: CvPersonal): EssentialChip[] {
  const chips: EssentialChip[] = [];

  const visa = personal.visaStatus?.trim();
  if (visa) chips.push({ label: "Visa", value: visa });

  const availability = personal.availability?.trim();
  if (availability) chips.push({ label: "Available", value: availability });

  const dl = personal.drivingLicense?.trim();
  if (dl && dl !== "None") chips.push({ label: "DL", value: dl });

  const nationality = personal.nationality?.trim();
  if (nationality) chips.push({ label: "Nationality", value: nationality });

  return chips;
}
