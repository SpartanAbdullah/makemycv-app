export const LANGUAGE_LEVELS = [
  { value: "elementary", label: "Elementary", description: "A1\u2013A2 \u00B7 Basic communication" },
  { value: "conversational", label: "Conversational", description: "B1\u2013B2 \u00B7 Everyday professional use" },
  { value: "professional", label: "Professional Working", description: "C1 \u00B7 Complex business communication" },
  { value: "full_professional", label: "Full Professional", description: "C2 \u00B7 Near-perfect fluency" },
  { value: "native", label: "Native / Bilingual", description: "Mother tongue or equivalent" },
] as const;

// LANGUAGE_LEVELS above is the canonical set. lib/store/migrate.ts mirrors it
// as CANONICAL_LANGUAGE_LEVELS and will only ever write one of these values \u2014
// keep the two in step. A level that cannot be selected here must never be
// stored, or it renders as a raw token on the CV.
export function formatLanguageLevel(value: string): string {
  const map: Record<string, string> = {
    elementary: "Elementary (A1\u2013A2)",
    conversational: "Conversational (B1\u2013B2)",
    professional: "Professional Working (C1)",
    full_professional: "Full Professional (C2)",
    native: "Native / Bilingual",
    // Legacy fallbacks
    beginner: "Elementary (A1\u2013A2)",
    intermediate: "Conversational (B1\u2013B2)",
    advanced: "Professional Working (C1)",
    // Written by the old v1\u2192v2 migration before 2026-08-02. The v2\u2192v3 step
    // repairs it on load, but a payload can still reach a renderer unmigrated
    // (a stale tab, an old backup), and printing the bare word "fluent" on
    // someone's CV is worse than a wrong-but-plausible label.
    fluent: "Professional Working (C1)",
  };
  return map[value] ?? value;
}
