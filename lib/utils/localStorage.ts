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

export const saveCvToStorage = (data: CvData) => {
  if (typeof window === "undefined") return;
  // Stamp the schema version on EVERY save (audit W2-D). The in-memory
  // CvData has no version field, so reset/importCvVersion used to persist
  // unversioned payloads that re-ran the v1→v2 migration on next load —
  // benign but wasteful, and it defeated migrate()'s "skipped" fast path.
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...data, version: CURRENT_VERSION }),
  );
};

export const clearCvStorage = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const exportCvJson = (data: CvData) => JSON.stringify(data, null, 2);

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
