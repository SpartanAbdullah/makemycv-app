import type { CvData } from "../types/cv";
import { CURRENT_VERSION, migrate } from "../store/migrate";

const STORAGE_KEY = "makemycv:data";

export const loadCvFromStorage = (): CvData | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[makemycv] storage: ignoring corrupted JSON payload");
    return null;
  }

  const { data, outcome } = migrate(parsed);

  if (outcome.status === "migrated") {
    // Persist the migrated payload so the cost is paid once, not on
    // every page load. Use the raw key — `saveCvToStorage` is typed
    // narrower than the v2 superset we're writing.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage write can fail (quota, privacy mode). Migration
      // result is still returned in-memory; we just re-migrate next time.
      console.warn("[makemycv] storage: could not persist migrated payload");
    }
    console.info(
      `[makemycv] storage: migrated v${outcome.from} → v${outcome.to}`
    );
  } else if (outcome.status === "failed") {
    console.warn(
      `[makemycv] storage: migration failed (${outcome.reason}) — keeping legacy payload in memory`
    );
  }

  return data;
};

/**
 * Returns false when the write fails (QuotaExceededError with a large
 * base64 photo, private-mode restrictions). Callers surface the failure —
 * the TopBar previously claimed "saved on this device" unconditionally
 * while every subsequent keystroke was silently lost.
 */
export const saveCvToStorage = (data: CvData): boolean => {
  if (typeof window === "undefined") return false;
  // Stamp the schema version on EVERY save (audit W2-D). The in-memory
  // CvData has no version field, so reset/importCvVersion used to persist
  // unversioned payloads that re-ran the v1→v2 migration on next load —
  // benign but wasteful, and it defeated migrate()'s "skipped" fast path.
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...data, version: CURRENT_VERSION }),
    );
    return true;
  } catch {
    console.warn("[makemycv] storage: save failed (quota or privacy mode)");
    return false;
  }
};

export const clearCvStorage = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};

/**
 * Serialise a CV for the user to keep as a backup file.
 *
 * Stamps `version` for the same reason saveCvToStorage does: without it a
 * restored backup looks like an unversioned (v1) payload and re-runs the whole
 * migration chain against data that is already current.
 */
export const exportCvJson = (data: CvData) =>
  JSON.stringify({ ...data, version: CURRENT_VERSION }, null, 2);

export type BackupReadResult =
  | { ok: true; data: CvData; migratedFrom: number | null }
  | { ok: false; reason: "unreadable" | "not-a-cv" };

/**
 * Parse a file the user picked as a backup.
 *
 * Runs the same migration chain as a localStorage load, so a backup taken
 * months ago restores as current data rather than as a stale shape. Rejects
 * anything that does not look like a CV instead of overwriting the user's work
 * with an arbitrary JSON file — restoring is destructive, so a wrong file must
 * fail loudly rather than silently blank the builder.
 */
export const readCvBackup = (json: string): BackupReadResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "not-a-cv" };
  }
  // Shape check: every CV has these, and no other JSON a user is likely to pick
  // by accident has all of them at once.
  const candidate = parsed as Record<string, unknown>;
  const looksLikeCv =
    typeof candidate.personal === "object" &&
    candidate.personal !== null &&
    Array.isArray(candidate.experience) &&
    Array.isArray(candidate.education) &&
    Array.isArray(candidate.skills);
  if (!looksLikeCv) return { ok: false, reason: "not-a-cv" };

  const { data, outcome } = migrate(parsed);
  // migrate() returns null when it cannot produce a usable payload (and on
  // outcome.status === "failed"). A backup we cannot migrate is a backup we
  // must not import — restoring is destructive, so fail rather than guess.
  if (!data || outcome.status === "failed") {
    return { ok: false, reason: "not-a-cv" };
  }
  return {
    ok: true,
    data,
    migratedFrom: outcome.status === "migrated" ? outcome.from : null,
  };
};

/** @deprecated Use readCvBackup — this neither validates nor migrates. */
export const importCvJson = (json: string): CvData | null => {
  try {
    return JSON.parse(json) as CvData;
  } catch {
    return null;
  }
};

export const debounce = <T extends (...args: never[]) => void>(
  fn: T,
  delay = 400
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export { STORAGE_KEY };
