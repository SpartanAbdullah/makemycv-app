/**
 * What the Enter key does in the Skills search box (backlog E7, QA D4).
 *
 * The bug: Enter used to add the FIRST search result instead of what the user
 * typed. "Fleet management" became whichever bank entry ranked first — a
 * silent substitution of a competency claim on a document the user submits to
 * an employer. Suggestions are options, not corrections.
 *
 * The rule, kept pure so it is unit-testable from Node:
 *   - Enter adds the typed text (trimmed) unless a suggestion is HIGHLIGHTED.
 *   - Highlighting is explicit: ArrowDown / ArrowUp move through the pickable
 *     results (`alreadyHave` rows are notes, not options); -1 means nothing is
 *     highlighted and Enter means "as written".
 *   - The caller still routes a highlighted suggestion through the licence
 *     guard and `addSkill`'s own duplicate check, exactly as a click would.
 */

export const NO_HIGHLIGHT = -1;

export type EnterAction<T> =
  | { kind: "typed"; name: string }
  | { kind: "suggestion"; suggestion: T }
  | { kind: "none" };

/** The rows a highlight can land on — what the user can actually pick. */
export const pickableResults = <T extends { alreadyHave: boolean }>(results: readonly T[]): T[] =>
  results.filter((r) => !r.alreadyHave);

/**
 * Next highlight after an arrow key. Clamped, not wrapped: ArrowUp from the
 * first option returns to "as written" (-1), ArrowDown on the last stays put,
 * so the keyboard never jumps from the bottom back to the typed text unseen.
 */
export const moveHighlight = (current: number, delta: 1 | -1, count: number): number => {
  if (count <= 0) return NO_HIGHLIGHT;
  const next = current + delta;
  if (next < NO_HIGHLIGHT) return NO_HIGHLIGHT;
  if (next > count - 1) return count - 1;
  return next;
};

export function resolveEnter<T extends { alreadyHave: boolean }>(
  query: string,
  results: readonly T[],
  highlighted: number,
): EnterAction<T> {
  const options = pickableResults(results);
  if (highlighted >= 0 && highlighted < options.length) {
    return { kind: "suggestion", suggestion: options[highlighted] };
  }
  const name = query.trim();
  if (!name) return { kind: "none" };
  return { kind: "typed", name };
}
