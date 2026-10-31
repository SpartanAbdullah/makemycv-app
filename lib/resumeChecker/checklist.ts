/**
 * The itemised list of what /resume-checker checks (FEATURE_BACKLOG B2).
 *
 * Every line here maps to one or more sub-signal ids in `lib/scoreEngine.ts`
 * (`sig("C1", …)` etc.). The page shows this list and the count derived from
 * it, so the count can never drift from the engine: `checklist.test.ts`
 * reads the engine source and fails when the two sets of ids differ. Add a
 * sub-signal to the engine → add it here, or the suite goes red.
 *
 * Wording describes what the check LOOKS FOR in the document (the
 * truthfulness rule), with the thresholds the engine actually uses.
 */
import type { ScoreCategoryId } from "./types";

export type ChecklistItem = {
  /** Engine sub-signal ids this line covers. */
  ids: string[];
  label: string;
  /** Needs the parser's layout signals; only the checker (not the builder)
   *  can score it. Ten points of the rubric are in this group. */
  parserOnly?: boolean;
};

export type ChecklistGroup = {
  category: ScoreCategoryId;
  items: ChecklistItem[];
};

export const CHECKLIST: ChecklistGroup[] = [
  {
    category: "content",
    items: [
      { ids: ["C1"], label: "A summary / professional profile section is present" },
      { ids: ["C2", "C4"], label: "Summary length: at least 40 words, at most 200" },
      { ids: ["C3"], label: "Summary states a number or metric" },
      { ids: ["C5", "C6"], label: "Bullets open with an action verb (half of them, then 70 %)" },
      { ids: ["C7", "C8"], label: "Bullets state a measurable outcome (a quarter, then half)" },
      { ids: ["C9", "C10"], label: "Bullet length: all under 40 words, none over 60" },
      { ids: ["C11"], label: "Every role has at least one bullet" },
      { ids: ["C12", "C13"], label: "Suspected spelling issues: none, or fewer than three", parserOnly: true },
      { ids: ["C14"], label: "No generic filler phrases (“responsible for”, “team player”, “proven track record”)" },
    ],
  },
  {
    category: "sections",
    items: [
      { ids: ["S4"], label: "Location is given" },
      { ids: ["S5"], label: "LinkedIn URL or personal website is given" },
      { ids: ["S7", "S8"], label: "Experience: at least one entry, ideally two or more" },
      { ids: ["S9"], label: "Every experience entry has a role, a company and a start date" },
      { ids: ["S10"], label: "At least one education entry" },
      { ids: ["S11"], label: "At least one skill" },
    ],
  },
  {
    category: "atsEssentials",
    items: [
      { ids: ["A1"], label: "Email address present and well-formed" },
      { ids: ["A2"], label: "Phone number present" },
      { ids: ["A3"], label: "Text does not read as a table or multi-column layout", parserOnly: true },
      { ids: ["A4"], label: "No sign that content sat inside images", parserOnly: true },
      { ids: ["A5"], label: "No unusual characters, wide gaps or scrambled order", parserOnly: true },
      { ids: ["A6"], label: "No emojis in the text" },
      { ids: ["A7", "A8"], label: "Experience dates are machine-readable (half of them, then all)" },
      { ids: ["A9"], label: "A headline / job title under the name" },
      { ids: ["A10"], label: "Every experience entry names the company" },
      { ids: ["A11"], label: "A role marked current has both a title and a company" },
      { ids: ["A12"], label: "UAE visa status is stated" },
      { ids: ["A13"], label: "Availability / notice period is stated" },
      { ids: ["A14"], label: "UAE driving licence is stated" },
    ],
  },
  {
    category: "design",
    items: [
      { ids: ["D1", "D2", "D3"], label: "Length: at least 150 words, ideally 300 or more, at most 1,200" },
      { ids: ["D4", "D5", "D6"], label: "Skills: at least 5, ideally 10 or more, fewer than 30" },
      { ids: ["D7"], label: "Each skill is a short phrase (40 characters or fewer)" },
      { ids: ["D8"], label: "Education entries name both the school and the degree" },
      { ids: ["D9"], label: "Three or more bullets per role on average" },
    ],
  },
];

/** Total number of engine sub-signals the list covers — the honest "N checks". */
export const CHECKLIST_SIGNAL_COUNT = CHECKLIST.reduce(
  (sum, g) => sum + g.items.reduce((s, i) => s + i.ids.length, 0),
  0,
);

export const CHECKLIST_CATEGORY_COUNT = CHECKLIST.length;
