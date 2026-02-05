import { create } from "zustand";
import type { CvData, CvEducation, CvExperience, CvProject, CvSkill } from "../types/cv";
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

const ensureSkillIds = (skills: CvSkill[] | undefined) =>
  (skills ?? []).map((skill) => {
    if (typeof skill === "string") {
      return { id: createId(), name: skill, level: "intermediate" };
    }
    if (!skill.id) {
      return { ...skill, id: createId() };
    }
    return skill;
  });

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
