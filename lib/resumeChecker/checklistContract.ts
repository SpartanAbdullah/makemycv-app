/**
 * The public, machine-readable form of the checker's "what this checks" list
 * (lib/resumeChecker/checklist.ts), served by
 * GET /api/resume-checker/checklist and consumed by the marketing site's
 * `scripts/check-checklist-contract.mjs`.
 *
 * Why this exists (2026-10-31, Mission 8): www.makemycv.ae hard-codes the
 * check count ("44 checks", "40+ UAE-tuned checks") and the per-category
 * counts in its own constants module. Nothing stopped the two repos drifting
 * apart when a sub-signal was added to the engine. The chain is now:
 *
 *   scoreEngine.ts  ─(checklist.test.ts)─▶  checklist.ts  ─(this file)─▶
 *   /api/resume-checker/checklist  ─(site CI script)─▶  site constants
 *
 * The site's rendered list stays static for SEO; the script only compares
 * numbers and fails the (non-blocking) CI job when they differ.
 *
 * `version` is bumped only when the SHAPE of this payload changes in a way
 * the site's script could not read. Adding fields does not need a bump;
 * renaming or removing them does.
 */
import { CHECKLIST, type ChecklistGroup } from "./checklist";
import type { ScoreCategoryId } from "./types";

export const CHECKLIST_CONTRACT_VERSION = 1;

/** Human labels for the four categories, as the checker page shows them. */
export const CHECKLIST_CATEGORY_LABELS: Record<ScoreCategoryId, string> = {
  content: "Content",
  sections: "Section Structure",
  atsEssentials: "ATS Essentials",
  design: "Design & Formatting",
};

export type ChecklistContractItem = {
  /** Stable id for the line: the engine sub-signal ids it covers, joined with "+". */
  id: string;
  label: string;
  /** The engine sub-signal ids behind the line (one or more). */
  signals: string[];
  /** True when only the checker (not the builder) can score it. */
  parserOnly: boolean;
};

export type ChecklistContractCategory = {
  id: ScoreCategoryId;
  label: string;
  /** Number of engine sub-signals in this category — the "N checks" figure. */
  count: number;
  items: ChecklistContractItem[];
};

export type ChecklistContract = {
  version: number;
  /** Total engine sub-signals — the honest "N checks" the site may quote. */
  count: number;
  categories: ChecklistContractCategory[];
};

function groupCount(g: ChecklistGroup): number {
  return g.items.reduce((s, i) => s + i.ids.length, 0);
}

export function buildChecklistContract(
  groups: ChecklistGroup[] = CHECKLIST,
): ChecklistContract {
  const categories = groups.map<ChecklistContractCategory>((g) => ({
    id: g.category,
    label: CHECKLIST_CATEGORY_LABELS[g.category],
    count: groupCount(g),
    items: g.items.map((i) => ({
      id: i.ids.join("+"),
      label: i.label,
      signals: [...i.ids],
      parserOnly: i.parserOnly === true,
    })),
  }));
  return {
    version: CHECKLIST_CONTRACT_VERSION,
    count: categories.reduce((s, c) => s + c.count, 0),
    categories,
  };
}
