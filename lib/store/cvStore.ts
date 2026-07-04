import { create } from "zustand";
import { getNormalizedCouponCode, isValidProCoupon } from "../config/coupons";
import type {
  CvData,
  CvEducation,
  CvExperience,
  CvProject,
  CvSkill,
  SkillLevel,
} from "../types/cv";
import type { ParseSignals } from "../resumeChecker/types";
import {
  clearCvStorage,
  debounce,
  loadCvFromStorage,
  saveCvToStorage,
} from "../utils/localStorage";
import { createId } from "../utils/id";

const PARSE_SIGNALS_STORAGE_KEY = "makemycv:parseSignals";

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
  if (
    value === "beginner" ||
    value === "intermediate" ||
    value === "advanced"
  ) {
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
      typeof maybeId === "string" && maybeId.trim().length > 0
        ? maybeId
        : createId();
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
    fontFamily: "sans",
    // Density controls — level 3 = neutral (×1.0). See CvSettings / resolveTheme.
    pageMargins: 3,
    fontSize: 3,
    lineHeight: 3,
    sectionSpacing: 3,
    sectionOrder: [
      "summary",
      "experience",
      "education",
      "skills",
      "languages",
      "certifications",
      "projects",
    ],
    photoShape: "round",
  },
};

type ProAccessSource = "free" | "manual" | "coupon";
type AccessState = {
  isPro: boolean;
  hasUsedFreeDownload: boolean;
  appliedCouponCode: string;
  proAccessSource: ProAccessSource;
};
type ApplyCouponResult = { ok: boolean; message: string };

type CvStore = {
  data: CvData;
  hydrated: boolean;
  /** True when the last localStorage write failed — the autosave chip
   *  must stop claiming "saved on this device". */
  saveError: boolean;
  isPro: boolean;
  hasUsedFreeDownload: boolean;
  appliedCouponCode: string;
  proAccessSource: ProAccessSource;
  /**
   * Parse signals from the ATS Checker — travel with a CV imported via
   * /api/resume-checker/import/:reportId and are used by computeScore to
   * produce a checker-parity score in the Builder. null for hand-entered CVs.
   */
  parseSignals: ParseSignals | null;
  setHydrated: (value: boolean) => void;
  setData: (data: CvData) => void;
  updateSection: <K extends keyof CvData>(key: K, value: CvData[K]) => void;
  setIsPro: (value: boolean) => void;
  setHasUsedFreeDownload: (value: boolean) => void;
  applyCoupon: (value: string) => Promise<ApplyCouponResult>;
  clearCoupon: () => void;
  reset: () => void;
  importJson: (data: CvData) => void;
  /**
   * Import a partial CV document from an external source (PDF/DOCX/LinkedIn).
   * mode "replace": overwrites the current document (preserves settings).
   * mode "merge":   appends arrays and fills empty personal fields only.
   * Importing always saves to localStorage (versioning via timestamp).
   */
  importCvVersion: (
    partial: Partial<CvData>,
    mode: "replace" | "merge",
  ) => void;
  /** Set (or clear with null) parseSignals. Persists to localStorage. */
  setParseSignals: (signals: ParseSignals | null) => void;
};

const PRO_STORAGE_KEY = "makemycv:isPro";
const FREE_DL_STORAGE_KEY = "makemycv:hasUsedFreeDownload";
const COUPON_STORAGE_KEY = "makemycv:appliedCoupon";

// KEEP — DO NOT REMOVE (decision reversed 2026-06-12, see DECISION_LOG.md).
// The 2026-05-31 pivot made everything free and flagged isPro for deletion.
// That deletion is now CANCELLED: trade license obtained June 2026, payments
// (Stripe + Tap) are back on the roadmap, and this access-state scaffolding
// (isPro / coupons / proAccessSource) will be revived for the paid tier
// rather than rebuilt from scratch.
//
// Current behavior (unchanged): isPro is force-set to `true` so no UI
// condition can hide a feature while the product is free. localStorage keys
// are still read so we don't trample old user state, but their values do not
// gate anything yet.
const loadAccessState = (): AccessState => {
  if (typeof window === "undefined") {
    return {
      isPro: true,
      hasUsedFreeDownload: false,
      appliedCouponCode: "",
      proAccessSource: "free",
    };
  }

  const storedCouponCode = getNormalizedCouponCode(
    window.localStorage.getItem(COUPON_STORAGE_KEY) ?? "",
  );
  const hasValidCouponInStorage =
    storedCouponCode.length > 0 && isValidProCoupon(storedCouponCode);

  return {
    isPro: true,
    hasUsedFreeDownload:
      window.localStorage.getItem(FREE_DL_STORAGE_KEY) === "true",
    appliedCouponCode: hasValidCouponInStorage ? storedCouponCode : "",
    proAccessSource: "free",
  };
};

export const useCvStore = create<CvStore>((set, get) => ({
  data: defaultCvData,
  hydrated: false,
  saveError: false,
  // KEEP — isPro deletion cancelled 2026-06-12 (paid tier returning).
  isPro: true,
  hasUsedFreeDownload: false,
  appliedCouponCode: "",
  proAccessSource: "free",
  parseSignals: null,
  setHydrated: (value) => set({ hydrated: value }),
  setData: (data) => set({ data }),
  updateSection: (key, value) =>
    set((state) => ({ data: { ...state.data, [key]: value } })),
  // KEEP — setIsPro deletion cancelled 2026-06-12 (paid tier returning).
  // Currently a no-op that always settles isPro=true; localStorage write
  // preserved so old code paths that still call it don't crash.
  setIsPro: (value) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(PRO_STORAGE_KEY, String(value));
    set({ isPro: true, proAccessSource: "free" });
  },
  setHasUsedFreeDownload: (value) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(FREE_DL_STORAGE_KEY, String(value));
    set({ hasUsedFreeDownload: value });
  },
  // TODO: Remove applyCoupon/clearCoupon in next release. Coupon system is
  // deferred to Phase 2 per DECISION_LOG.md 2026-05-31. Kept as no-ops so
  // any stale call sites don't crash.
  applyCoupon: async () => ({
    ok: true,
    message: "MakeMyCV is now free — no promo code needed.",
  }),
  clearCoupon: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(COUPON_STORAGE_KEY);
    }
    set({ appliedCouponCode: "" });
  },
  reset: () => {
    clearCvStorage();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PARSE_SIGNALS_STORAGE_KEY);
    }
    set({ data: defaultCvData, parseSignals: null });
  },
  importJson: (data) => set({ data }),
  setParseSignals: (signals) => {
    if (typeof window !== "undefined") {
      if (signals) {
        window.localStorage.setItem(
          PARSE_SIGNALS_STORAGE_KEY,
          JSON.stringify(signals),
        );
      } else {
        window.localStorage.removeItem(PARSE_SIGNALS_STORAGE_KEY);
      }
    }
    set({ parseSignals: signals });
  },
  importCvVersion: (partial, mode) => {
    const current = get().data;
    let next: CvData;
    if (mode === "replace") {
      next = {
        ...defaultCvData,
        ...partial,
        // Always preserve user-chosen template settings
        settings: current.settings,
      };
    } else {
      // Merge: fill empty personal fields, append arrays
      next = {
        ...current,
        personal: {
          ...current.personal,
          ...Object.fromEntries(
            Object.entries(partial.personal ?? {}).filter(
              ([k, v]) =>
                v !== "" &&
                current.personal[k as keyof typeof current.personal] === "",
            ),
          ),
        },
        experience: [...current.experience, ...(partial.experience ?? [])],
        education: [...current.education, ...(partial.education ?? [])],
        skills: [...current.skills, ...(partial.skills ?? [])],
        languages: [...current.languages, ...(partial.languages ?? [])],
        certifications: [
          ...current.certifications,
          ...(partial.certifications ?? []),
        ],
        projects: [...current.projects, ...(partial.projects ?? [])],
      };
    }
    set({ data: next });
  },
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
  const accessState = loadAccessState();
  useCvStore.setState(accessState);

  // Hydrate parseSignals from localStorage (travels with a Checker import).
  try {
    const rawSignals = window.localStorage.getItem(PARSE_SIGNALS_STORAGE_KEY);
    if (rawSignals) {
      const parsed = JSON.parse(rawSignals) as ParseSignals;
      if (parsed && typeof parsed === "object" && "hasTables" in parsed) {
        useCvStore.setState({ parseSignals: parsed });
      }
    }
  } catch {
    // Malformed — ignore, leave as null.
  }

  useCvStore.getState().setHydrated(true);
  const saveDebounced = debounce((data: CvData) => {
    const ok = saveCvToStorage(data);
    // Only write on transitions — and guard the subscription on data
    // identity below, so flipping saveError can never re-trigger a save.
    if (useCvStore.getState().saveError === ok) {
      useCvStore.setState({ saveError: !ok });
    }
  }, 500);
  useCvStore.subscribe((state, prev) => {
    if (state.data !== prev.data) saveDebounced(state.data);
  });
};

export const createEmptyItems = {
  experience: createEmptyExperience,
  education: createEmptyEducation,
  project: createEmptyProject,
};
