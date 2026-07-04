export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type LanguageLevel =
  | "elementary"
  | "conversational"
  | "professional"
  | "full_professional"
  | "native"
  | "beginner"
  | "intermediate"
  | "advanced"
  // Written by the v1→v2 migration (lib/store/migrate.ts maps the legacy
  // "advanced" language level to "fluent"); the union was missing it, so
  // migrated users carried a level the type system didn't model.
  | "fluent";
export type PlanTier = "free" | "pro";

export type CvPersonal = {
  firstName: string;
  lastName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  summary: string;
  photo?: string;
  showPhoto?: boolean;
  nationality?: string;
  country?: string;
  dateOfBirth?: string;
  drivingLicense?: string;
  // UAE-essentials block on the Contact step. Both are optional strings so
  // imported CVs (PDF/DOCX/LinkedIn) that don't carry these still validate.
  visaStatus?: string;
  availability?: string;
};

export type CvExperience = {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: string[];
};

export type CvEducation = {
  id: string;
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  notes?: string;
  attested?: boolean;
  attestingBody?: string;
};

export type CvSkill = {
  id: string;
  name: string;
  level?: SkillLevel;
  // Optional grouping: "technical" skills render under a separate "Technical
  // Skills" heading on the ATS templates. Absent = general skill.
  category?: "technical" | "general";
};

export type CvLanguage = {
  id: string;
  name: string;
  level?: LanguageLevel;
};

export type CvCertification = {
  id: string;
  name: string;
  issuer: string;
  date?: string;
};

export type CvProject = {
  id: string;
  name: string;
  link?: string;
  bullets: string[];
};

export type PhotoShape = "round" | "square" | "hidden";

export type CvFontFamily = "sans" | "display" | "serif";

/**
 * Job-domain taxonomy that drives per-domain content personalization
 * (wording, idea bullets, soft skills, AI prompt). Runtime helpers — the
 * keyword table, labels, and inference — live in lib/data/roleFamily.ts;
 * this is just the canonical type so lib/types stays the source of truth.
 * "generic" is the always-available fallback.
 */
export type RoleFamily =
  | "sales"
  | "marketing"
  | "finance"
  | "accounting"
  | "operations"
  | "logistics"
  | "hr"
  | "admin"
  | "engineering"
  | "it"
  | "hospitality"
  | "retail"
  | "realestate"
  | "healthcare"
  | "education"
  | "customerservice"
  | "generic";

export type CvSettings = {
  templateId: string;
  accentColor?: string;
  fontScale?: number;
  fontFamily?: CvFontFamily;
  sectionOrder?: string[];
  photoShape?: PhotoShape;
  // Design & Font density controls, each a 1–5 level (3 = neutral = current
  // default). resolveTheme maps them to multipliers (lib/templates/theme.ts):
  //   pageMargins → marginScale, fontSize → fontScale,
  //   lineHeight  → lineScale,   sectionSpacing → spaceScale.
  // All optional → old CVs load unchanged (undefined ⇒ level 3 ⇒ ×1.0).
  // NOTE: the `fontScale` field above is a dead legacy multiplier kept only for
  // saved-data compat; the live font-size control drives `fontSize` instead.
  pageMargins?: number;
  fontSize?: number;
  lineHeight?: number;
  sectionSpacing?: number;
  // Personalization (Phase 1): the job domain we tailor content for.
  // `domain` is inferred from the headline and confirmable via the chip;
  // `domainSource` records whether the value was inferred or user-chosen so
  // auto-inference never clobbers a manual pick. Both optional → old CVs load
  // fine with no migration; domain is inferred lazily on first headline blur.
  domain?: RoleFamily;
  domainSource?: "inferred" | "user";
};

export type CvData = {
  personal: CvPersonal;
  experience: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  languages: CvLanguage[];
  certifications: CvCertification[];
  projects: CvProject[];
  settings: CvSettings;
};
