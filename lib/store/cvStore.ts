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
import type { ParseSignals, ScoreGrade } from "../resumeChecker/types";
import type { JdRequirements } from "../jdMatch/types";
import { computeScore, SCORING_RUBRIC_VERSION } from "../scoreEngine";
import { clearSetAside } from "../skills/setAside";
import {
  clearCvStorage,
  debounce,
  loadCvFromStorage,
  saveCvToStorage,
  STORAGE_KEY,
} from "../utils/localStorage";
import { createId } from "../utils/id";

const PARSE_SIGNALS_STORAGE_KEY = "makemycv:parseSignals";
const SCORE_BASELINE_STORAGE_KEY = "makemycv:scoreBaseline";
const JD_TARGET_STORAGE_KEY = "makemycv:jdTarget";

/** Bumped if JdTarget's shape changes; a mismatch is discarded, not guessed at. */
const JD_TARGET_VERSION = 1;

/**
 * The job the user last analysed in JD Match, kept so the rest of the builder
 * can rank against it.
 *
 * Stores the EXTRACTED REQUIREMENTS, not the pasted job text. Three reasons:
 * the requirements are what a consumer actually needs (a list of terms), a
 * pasted JD can be several KB where this is a handful of short arrays, and a
 * raw posting carries a company's own wording where the extracted skill list
 * is generic. It is also already computed — nothing new runs to produce it.
 *
 * Local only, like the CV itself: this never leaves the browser.
 */
export type JdTarget = {
  jobTitle?: string;
  requirements: JdRequirements;
  capturedAt: number;
  v: number;
};

/**
 * Validate a JD target read back from localStorage.
 *
 * Null for anything today's code cannot use — malformed JSON, a missing
 * requirements object, or a different shape version. Exported and pure so the
 * rule is testable without a browser.
 */
export function parseStoredJdTarget(raw: string | null): JdTarget | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const t = parsed as Partial<JdTarget>;
  if (t.v !== JD_TARGET_VERSION) return null;
  const r = t.requirements;
  if (!r || typeof r !== "object") return null;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    jobTitle: typeof t.jobTitle === "string" ? t.jobTitle : undefined,
    capturedAt: typeof t.capturedAt === "number" ? t.capturedAt : 0,
    v: JD_TARGET_VERSION,
    requirements: {
      jobTitle: typeof r.jobTitle === "string" ? r.jobTitle : undefined,
      hardSkills: list(r.hardSkills),
      tools: list(r.tools),
      certifications: list(r.certifications),
      softSkills: list(r.softSkills),
      keywords: list(r.keywords),
    },
  };
}

/**
 * The score of the CV at the moment it was IMPORTED — the honest "before" for
 * the TopBar delta pill.
 *
 * Only ever set by an import. A CV typed from scratch has no baseline, so no
 * delta is shown: "you went from 0 to 77" is not a real improvement, it is just
 * the user existing, and claiming it would be the same unsourced-uplift move we
 * criticise competitors for.
 */
export type ScoreBaseline = {
  total: number;
  grade: ScoreGrade;
  capturedAt: number;
  /** Which scoring rubric produced `total`. A baseline from any other rubric
   *  is not comparable to a live score and is discarded on load — see
   *  SCORING_RUBRIC_VERSION in lib/scoreEngine.ts and parseStoredBaseline
   *  below. */
  rubric: number;
};

/**
 * Validate a baseline read back from localStorage.
 *
 * Returns null for anything that cannot be compared to a score computed by
 * TODAY's engine — malformed JSON, a missing total, or a baseline stamped with
 * a different rubric version (including none at all, which means it predates
 * versioning). The delta pill then simply doesn't render, which is the right
 * outcome: the alternative is telling a user their untouched CV lost points
 * because we changed how we count, and that reads as their mistake.
 *
 * Exported and pure so the rule is testable without a browser.
 */
export function parseStoredBaseline(raw: string | null): ScoreBaseline | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const b = parsed as Partial<ScoreBaseline>;
  if (typeof b.total !== "number" || !Number.isFinite(b.total)) return null;
  if (b.rubric !== SCORING_RUBRIC_VERSION) return null;
  return {
    total: b.total,
    grade: b.grade as ScoreGrade,
    capturedAt: typeof b.capturedAt === "number" ? b.capturedAt : 0,
    rubric: b.rubric,
  };
}

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
  /**
   * True when ANOTHER TAB has written a newer CV to localStorage.
   *
   * Each tab hydrates once and then autosaves its own in-memory copy, so two
   * open builders used to overwrite each other silently: whichever tab you
   * typed in last won, and the other tab's work vanished with no error and no
   * undo (audit A-W3-003). When this flips true the autosave in THIS tab
   * stops, so the stale copy can no longer clobber the newer one, and the UI
   * tells the user to reload. Deliberately one-way — there is no safe
   * automatic merge, and silently discarding either side is what caused the
   * bug in the first place.
   */
  staleTab: boolean;
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
  /** Score at import time. null for hand-typed CVs — see ScoreBaseline. */
  scoreBaseline: ScoreBaseline | null;
  /** The job last analysed in JD Match, so other steps can rank against it. */
  jdTarget: JdTarget | null;
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
  /**
   * Snapshot the CURRENT score as the "before" for the TopBar delta.
   *
   * Deliberately a separate action rather than a side effect inside
   * importCvVersion: ImportFromReportBanner calls importCvVersion() and THEN
   * setParseSignals(), so a baseline captured inside importCvVersion would be
   * scored WITHOUT the signals the live score is scored WITH. The delta would
   * then be measuring a change in scoring inputs rather than the user's work.
   * Call this last, once data and signals are both settled.
   */
  captureScoreBaseline: () => void;
  /** Remember (or clear with null) the job being targeted. Persists locally. */
  setJdTarget: (requirements: JdRequirements | null) => void;
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
  staleTab: false,
  // KEEP — isPro deletion cancelled 2026-06-12 (paid tier returning).
  isPro: true,
  hasUsedFreeDownload: false,
  appliedCouponCode: "",
  proAccessSource: "free",
  parseSignals: null,
  scoreBaseline: null,
  jdTarget: null,
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
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SCORE_BASELINE_STORAGE_KEY);
    }
    // Skills the user set aside are remembered outside the document (see
    // lib/skills/setAside.ts). "Start over" has to clear them too, or the next
    // CV inherits a park list belonging to a CV that no longer exists.
    clearSetAside();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(JD_TARGET_STORAGE_KEY);
    }
    set({
      data: defaultCvData,
      parseSignals: null,
      scoreBaseline: null,
      jdTarget: null,
    });
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
  setJdTarget: (requirements) => {
    const target: JdTarget | null = requirements
      ? {
          jobTitle: requirements.jobTitle?.trim() || undefined,
          requirements,
          capturedAt: Date.now(),
          v: JD_TARGET_VERSION,
        }
      : null;
    if (typeof window !== "undefined") {
      try {
        if (target) {
          window.localStorage.setItem(JD_TARGET_STORAGE_KEY, JSON.stringify(target));
        } else {
          window.localStorage.removeItem(JD_TARGET_STORAGE_KEY);
        }
      } catch {
        // Quota or private mode. The target is a convenience for ranking, not
        // CV content — losing it costs a re-analyse, not work.
      }
    }
    set({ jdTarget: target });
  },
  captureScoreBaseline: () => {
    const { data, parseSignals } = get();
    // mode MUST be "builder" — the same mode the live TopBar score uses.
    // ScoreReport.total is normalised so builder and checker modes agree "when
    // the non-conditional sub-signals match" (lib/resumeChecker/types.ts), but
    // CONDITIONAL signals change which sub-signals are applicable at all. So a
    // baseline scored in one mode against a live score in the other can drift,
    // and the delta would be reporting our own scoring inputs as if they were
    // the user's progress.
    const report = computeScore(data, {
      mode: "builder",
      parseSignals: parseSignals ?? undefined,
    });
    const baseline: ScoreBaseline = {
      total: report.total,
      grade: report.grade,
      capturedAt: Date.now(),
      // Stamped so a later rubric change can tell this total is no longer
      // comparable, instead of silently subtracting across two rubrics.
      rubric: SCORING_RUBRIC_VERSION,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        SCORE_BASELINE_STORAGE_KEY,
        JSON.stringify(baseline),
      );
    }
    set({ scoreBaseline: baseline });
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

  // Hydrate the import-time score baseline (drives the TopBar delta pill).
  try {
    const rawBaseline = window.localStorage.getItem(SCORE_BASELINE_STORAGE_KEY);
    const baseline = parseStoredBaseline(rawBaseline);
    if (baseline) {
      useCvStore.setState({ scoreBaseline: baseline });
    } else if (rawBaseline) {
      // Stale rubric or malformed. Drop it rather than leaving a record that
      // can never be used again — the next import writes a fresh, comparable
      // one, and until then the pill correctly shows nothing.
      window.localStorage.removeItem(SCORE_BASELINE_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — ignore, no delta is better than a wrong delta.
  }

  // Hydrate the JD target (drives relevance ranking on the Skills step).
  try {
    const rawTarget = window.localStorage.getItem(JD_TARGET_STORAGE_KEY);
    const target = parseStoredJdTarget(rawTarget);
    if (target) {
      useCvStore.setState({ jdTarget: target });
    } else if (rawTarget) {
      // Different shape version or malformed — drop it rather than leave a
      // record that can never be used.
      window.localStorage.removeItem(JD_TARGET_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — rank against the domain bank alone.
  }

  useCvStore.getState().setHydrated(true);
  const saveDebounced = debounce((data: CvData) => {
    // A stale tab must never write. Its in-memory copy predates whatever
    // another tab has since saved, so writing would replace newer work with
    // older — the exact clobber this guard exists to prevent. Checked here
    // rather than only in the subscription because the write is debounced:
    // another tab can win the race during those 500ms.
    if (useCvStore.getState().staleTab) return;
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

  // Cross-tab guard (audit A-W3-003). The `storage` event fires only in OTHER
  // tabs of the same origin, so receiving one means a second builder just
  // saved a CV this tab does not have. Before this, each tab hydrated once and
  // then autosaved its own copy, so whichever tab you typed in last silently
  // overwrote the other — no error, no undo, and no backup to recover from.
  //
  // `newValue === null` is a clear (reset / "start over" elsewhere), not a
  // competing edit, so it is ignored rather than treated as a conflict.
  //
  // Deliberately one-way and non-recoverable in-tab: there is no safe
  // automatic merge of two divergent CVs, and silently picking a winner is
  // precisely the behaviour being fixed. The user reloads to continue.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === null) return;
    if (useCvStore.getState().staleTab) return;
    useCvStore.setState({ staleTab: true });
  });
};

export const createEmptyItems = {
  experience: createEmptyExperience,
  education: createEmptyEducation,
  project: createEmptyProject,
};
