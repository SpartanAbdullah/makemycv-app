/**
 * JD Heatmap — locate each requirement term inside the pasted job-description
 * text and split it into plain + highlighted segments (matched = on the CV,
 * missing = a gap). Runs client-side; nothing is sent anywhere.
 *
 * This is purely a DISPLAY aid layered on the existing matcher result — it does
 * not change matching. Terms the LLM canonicalised away from the JD's wording
 * simply won't be located (reported in `located` so the caller can list them
 * separately); that degrades gracefully rather than hiding them.
 */
import type { JdCategory, JdTerm } from "./types";

export type HeatStatus = "matched" | "missing";

export type HeatSegment = {
  text: string;
  /** Undefined for plain (un-highlighted) text. */
  status?: HeatStatus;
  term?: string;
  category?: JdCategory;
};

export type Heatmap = {
  segments: HeatSegment[];
  /** Requirement terms that were found verbatim in the JD text. */
  located: Set<string>;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-phrase, case-insensitive, not inside a larger word ("Java" ∉ "JavaScript"). */
function termRegex(term: string): RegExp | null {
  const t = term.trim();
  if (t.length < 2) return null;
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(t)}(?![\\p{L}\\p{N}])`, "giu");
  } catch {
    return null;
  }
}

type Range = {
  start: number;
  end: number;
  status: HeatStatus;
  term: string;
  category: JdCategory;
};

export function buildHeatmap(jobText: string, terms: JdTerm[]): Heatmap {
  const ranges: Range[] = [];

  for (const t of terms) {
    const re = termRegex(t.term);
    if (!re) continue;
    const status: HeatStatus = t.matched ? "matched" : "missing";
    let m: RegExpExecArray | null;
    while ((m = re.exec(jobText)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, status, term: t.term, category: t.category });
      if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length loops
    }
  }

  // Earliest first; for the same start, the longest match wins (most specific).
  ranges.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  // Greedily keep non-overlapping ranges.
  const chosen: Range[] = [];
  let lastEnd = 0;
  for (const r of ranges) {
    if (r.start >= lastEnd) {
      chosen.push(r);
      lastEnd = r.end;
    }
  }

  // `located` MUST reflect terms that actually SURVIVED into a rendered span —
  // not every raw match. A shorter term swallowed by a longer overlapping one
  // (e.g. "project" inside "project management") is NOT located, so the panel
  // surfaces it as a chip instead. Otherwise it would vanish from both surfaces.
  const located = new Set(chosen.map((r) => r.term));

  const segments: HeatSegment[] = [];
  let pos = 0;
  for (const r of chosen) {
    if (r.start > pos) segments.push({ text: jobText.slice(pos, r.start) });
    segments.push({
      text: jobText.slice(r.start, r.end),
      status: r.status,
      term: r.term,
      category: r.category,
    });
    pos = r.end;
  }
  if (pos < jobText.length) segments.push({ text: jobText.slice(pos) });

  return { segments, located };
}
