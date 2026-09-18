/**
 * Set-aside skills — somewhere to put "rusty", "still learning", "not sure
 * this job wants it".
 *
 * The research's largest single finding: every competitor knows this
 * hesitation exists and answers it with a sentence in a tips box. None turns
 * it into a state. With only "listed" and "absent" available, a user who
 * genuinely doesn't know has nowhere to put the doubt except abandoning the
 * step — and the two failure modes are paralysis AND silent under-claiming of
 * skills they actually have.
 *
 * ── Why this is localStorage and NOT a field on CvSkill ─────────────────────
 *
 * It looks like the park state belongs on the skill object. It does not, and
 * the reason is the failure mode rather than the effort.
 *
 * Ten templates plus components/pdf/CVDocument.tsx and the DOCX export read
 * `cv.skills` DIRECTLY; only three go through splitSkills(). A `setAside` flag
 * would therefore need filtering in a dozen independent render paths, and
 * missing one prints a skill the user explicitly parked onto a CV they submit
 * to an employer — the exact opposite of what they asked for, on the one
 * artefact that matters.
 *
 * Parking by REMOVING the skill from cv.skills makes that impossible: it
 * cannot print because it is not in the document. The cost is that the parked
 * list is device-local, and that is already true of the CV itself — the
 * builder's own footer says "Your CV lives in this browser only." A
 * device-local park list is consistent with the product, not a new limit.
 *
 * Worst case here is a forgotten park list. Worst case for the flag is an
 * unwanted claim on a submitted CV. The trade is not close.
 */

const STORAGE_KEY = "makemycv:setAsideSkills";

/** Bumped if the stored shape ever changes; a mismatch is discarded, not
 *  guessed at. Same discipline as SCORING_RUBRIC_VERSION. */
const SHAPE_VERSION = 1;

/** Guards against an unbounded list if something ever parks in a loop. */
const MAX_ENTRIES = 200;

export type SetAsideEntry = {
  name: string;
  parkedAt: number;
};

type StoredShape = { v: number; items: SetAsideEntry[] };

/**
 * The storage object, or null when there isn't one.
 *
 * Deliberately reads `globalThis.localStorage` rather than checking `window`:
 * that is both SSR-safe (no storage on the server) and testable in Node
 * without a DOM. Wrapped because access itself throws in some privacy modes.
 */
function storage(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.trim().toLowerCase();

function read(): SetAsideEntry[] {
  const s = storage();
  if (!s) return [];
  let raw: string | null;
  try {
    raw = s.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<StoredShape> | null;
    if (!parsed || typeof parsed !== "object") return [];
    if (parsed.v !== SHAPE_VERSION) return [];
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (e): e is SetAsideEntry =>
        Boolean(e) && typeof e.name === "string" && e.name.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function write(items: SetAsideEntry[]): void {
  const s = storage();
  if (!s) return;
  try {
    const payload: StoredShape = { v: SHAPE_VERSION, items: items.slice(0, MAX_ENTRIES) };
    s.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode. The park is a convenience, never the source of
    // truth for the document — losing it costs the user a re-add, not work.
  }
}

/** Parked skills, most recently parked first. */
export function listSetAside(): SetAsideEntry[] {
  return read().sort((a, b) => (b.parkedAt ?? 0) - (a.parkedAt ?? 0));
}

/** True when this name is currently parked (case-insensitive). */
export function isSetAside(name: string): boolean {
  const n = norm(name);
  return read().some((e) => norm(e.name) === n);
}

/**
 * Park a skill. The CALLER is responsible for removing it from cv.skills —
 * this module only remembers the name so it can be offered back. Keeping the
 * two separate is what lets the removal stay a plain, already-tested store
 * write instead of a new special case.
 */
export function parkSkill(name: string, now: number = Date.now()): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const n = norm(trimmed);
  const next = read().filter((e) => norm(e.name) !== n);
  next.unshift({ name: trimmed, parkedAt: now });
  write(next);
  invalidate();
}

/** Forget a parked skill — used both when putting it back and when discarding. */
export function restoreSkill(name: string): void {
  const n = norm(name);
  write(read().filter((e) => norm(e.name) !== n));
  invalidate();
}

/** Drop the whole park list. Called by the store's reset() so "start over"
 *  actually starts over, the same way parseSignals and scoreBaseline do. */
export function clearSetAside(): void {
  const s = storage();
  try {
    if (s) s.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — a stale park list is harmless.
  }
  invalidate();
}

/* ── React binding ───────────────────────────────────────────────────────────
 *
 * localStorage has no change events of its own for the tab that wrote it, so
 * the park list is exposed through useSyncExternalStore rather than copied
 * into component state on mount. That fixes three things at once: no setState
 * inside an effect (a cascading render, and a lint error), no manual refresh
 * call after every mutation, and a snapshot that stays correct if a second tab
 * changes the list.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * getSnapshot MUST return a referentially stable value between changes or
 * React re-renders forever, so the parsed list is cached and the cache is
 * dropped only when something actually writes.
 */
let cache: SetAsideEntry[] | null = null;

/** Server render has no storage; a module-level constant keeps it stable. */
const EMPTY: SetAsideEntry[] = [];

function invalidate(): void {
  cache = null;
  for (const l of listeners) l();
}

export function subscribeSetAside(listener: Listener): () => void {
  listeners.add(listener);
  // Another tab writing the same key fires `storage` here. Without this the
  // park list silently diverges between two open builder tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) invalidate();
  };
  const w = (globalThis as { addEventListener?: typeof addEventListener }).addEventListener
    ? (globalThis as unknown as Window)
    : null;
  w?.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    w?.removeEventListener("storage", onStorage);
  };
}

export function getSetAsideSnapshot(): SetAsideEntry[] {
  if (cache === null) cache = listSetAside();
  return cache;
}

export function getSetAsideServerSnapshot(): SetAsideEntry[] {
  return EMPTY;
}
