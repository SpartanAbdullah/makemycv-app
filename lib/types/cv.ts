export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type LanguageLevel =
  | "elementary"
  | "conversational"
  | "professional"
  | "full_professional"
  | "native"
  | "beginner"
  | "intermediate"
  | "advanced";
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

export type PhotoShape = "round" | "square";

export type CvSettings = {
  templateId: string;
  accentColor?: string;
  fontScale?: number;
  sectionOrder?: string[];
  photoShape?: PhotoShape;
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
