import type { CvData } from "../types/cv";

const STORAGE_KEY = "makemycv:data";

export const loadCvFromStorage = (): CvData | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CvData;
  } catch {
    return null;
  }
};

export const saveCvToStorage = (data: CvData) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
