/**
 * JD requirements that are really UAE Essentials FIELDS, not keywords
 * (2026-11-21).
 *
 * A UAE job ad that says "valid UAE driving licence" or "immediate joiners
 * preferred" is asking a pre-screen question the CV answers in a field
 * (personal.drivingLicense, personal.availability). The matcher used to treat
 * those as missing keywords and offer "Add to skills" / "Weave into a bullet",
 * which puts a knockout answer in the wrong place and never matched a CV that
 * already had the field filled in.
 *
 * Two halves, both client-side:
 *  - `uaeFieldFor(term)` recognises such a requirement so the UI can point at
 *    the field instead of offering a keyword fix;
 *  - `uaeFieldPhrases(personal)` returns the phrases a FILLED field already
 *    answers, for the match corpus.
 *
 * Detect, never assert: a phrase is only emitted when the person's own field
 * value says it. "30 days notice" never answers "immediate joiner"; an
 * international licence never answers "UAE driving licence".
 */
import type { CvPersonal } from "../types/cv";

export type UaeField = "drivingLicense" | "availability";

const DRIVING_RE = /\bdriving\s+licen[cs]e\b|\bdriver'?s?\s+licen[cs]e\b/i;
const AVAILABILITY_RE =
  /\bimmediate\s+(?:joiners?|joining|start|availability)\b|\b(?:available|join|start)\s+immediately\b|\bnotice\s+period\b/i;

/** The UAE Essentials field a JD requirement is asking about, if any. */
export function uaeFieldFor(term: string): UaeField | null {
  if (!term) return null;
  if (DRIVING_RE.test(term)) return "drivingLicense";
  if (AVAILABILITY_RE.test(term)) return "availability";
  return null;
}

export const UAE_FIELD_LABELS: Record<UaeField, string> = {
  drivingLicense: "UAE driving licence",
  availability: "Availability / notice period",
};

/** Licence values that state a UAE licence (the field is labelled "UAE driving licence"). */
const UAE_LICENCE_VALUES = new Set(["light vehicle", "heavy vehicle", "motorcycle"]);

/**
 * Phrases the filled-in fields already answer. Added to the match corpus as
 * separate parts, so they are bounded like any other CV field.
 */
export function uaeFieldPhrases(
  personal: Pick<CvPersonal, "drivingLicense" | "availability">,
): string[] {
  const out: string[] = [];

  const licence = (personal.drivingLicense ?? "").trim().toLowerCase();
  if (licence && licence !== "none") {
    // Any licence answers the bare requirement, in both spellings.
    out.push("driving licence", "driving license", "valid driving licence", "valid driving license");
    if (UAE_LICENCE_VALUES.has(licence)) {
      out.push(
        "uae driving licence",
        "uae driving license",
        "valid uae driving licence",
        "valid uae driving license",
      );
    }
  }

  const availability = (personal.availability ?? "").trim().toLowerCase();
  if (availability === "immediate") {
    out.push(
      "immediate joiner",
      "immediate joiners",
      "immediate joining",
      "immediate start",
      "immediate availability",
      "available immediately",
      "join immediately",
      "start immediately",
    );
  }
  if (availability) out.push("notice period");

  return out;
}
