import { create } from "zustand";
import type {
  CvData,
  CvEducation,
  CvExperience,
  CvProject,
  CvSkill,
  SkillLevel,
} from "../types/cv";
import {
  clearCvStorage,
  debounce,
  loadCvFromStorage,
  saveCvToStorage,
} from "../utils/localStorage";
import { createId } from "../utils/id";

const createEmptyExperience = (): CvExperience => ({
  id: crypto.randomUUID(),
  company: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  bullets: [""],
});

const createEmptyEducation = (): CvEducation => ({
  id: crypto.randomUUID(),
  school: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  notes: "",
});

const createEmptyProject = (): CvProject => ({
  id: crypto.randomUUID(),
  name: "",
  link: "",
  bullets: [""],
});

const toSkillLevel = (value: unknown): SkillLevel | undefined => {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return undefined;
};

const ensureSkillIds = (input: unknown): CvSkill[] => {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) return [];
      return [{ id: createId(), name }];
    }

    if (!item || typeof item !== "object") return [];

    const maybeName = (item as { name?: unknown }).name;
    if (typeof maybeName !== "string") return [];
    const name = maybeName.trim();
    if (!name) return [];

    const maybeId = (item as { id?: unknown }).id;
    const id =
      typeof maybeId === "string" && maybeId.trim().length > 0 ? maybeId : createId();
    const level = toSkillLevel((item as { level?: unknown }).level);

    return level ? [{ id, name, level }] : [{ id, name }];
  });
};

export const defaultCvData: CvData = {
  personal: {
    firstName: "",
    lastName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
    summary: "",
  },
  experience: [createEmptyExperience()],
  education: [createEmptyEducation()],
  skills: [],
  languages: [],
  certifications: [],
  projects: [],
  settings: {
    templateId: "classic",
    accentColor: "#1e5b54",
    fontScale: 1,
    sectionOrder: [
      "summary",
      "experience",
      "education",
      "skills",
      "languages",
      "certifications",
      "projects",
    ],
  },
};

type CvStore = {
  data: CvData;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setData: (data: CvData) => void;
  updateSection: <K extends keyof CvData>(key: K, value: CvData[K]) => void;
  reset: () => void;
  importJson: (data: CvData) => void;
};

export const useCvStore = create<CvStore>((set) => ({
  data: defaultCvData,
  hydrated: false,
  setHydrated: (value) => set({ hydrated: value }),
  setData: (data) => set({ data }),
  updateSection: (key, value) =>
    set((state) => ({ data: { ...state.data, [key]: value } })),
  reset: () => {
    clearCvStorage();
    set({ data: defaultCvData });
  },
  importJson: (data) => set({ data }),
}));

let hasBoundStorage = false;

export const bindCvStorage = () => {
  if (typeof window === "undefined" || hasBoundStorage) return;
  hasBoundStorage = true;
  const stored = loadCvFromStorage();
  if (stored) {
    useCvStore
      .getState()
      .setData({ ...stored, skills: ensureSkillIds(stored.skills) });
  }
  useCvStore.getState().setHydrated(true);
  const saveDebounced = debounce((data: CvData) => saveCvToStorage(data), 500);
  useCvStore.subscribe((state) => saveDebounced(state.data));
};

export const createEmptyItems = {
  experience: createEmptyExperience,
  education: createEmptyEducation,
  project: createEmptyProject,
};
