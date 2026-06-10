// Canonical types for the import pipeline.
// Each adapter (PDF/DOCX/LinkedIn) returns a ParsedDocument which is then
// reviewed by the user and mapped into CvData by fieldMapper.ts.

export type ParsedContact = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
};

export type ParsedExperience = {
  company?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets?: string[];
};

export type ParsedEducation = {
  school?: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

export type ParsedCertification = {
  name?: string;
  issuer?: string;
  date?: string;
};

export type ParsedProject = {
  name?: string;
  link?: string;
  bullets?: string[];
};

/** UAE recruiter-signal fields harvested from labeled lines
 *  ("Visa Status: …", "Nationality: …", "Notice Period: …"). */
export type ParsedUaeFields = {
  nationality?: string;
  visaStatus?: string;
  availability?: string;
  drivingLicense?: string;
};

export type ParsedDocument = {
  contact?: ParsedContact;
  summary?: string;
  experience?: ParsedExperience[];
  education?: ParsedEducation[];
  skills?: string[];
  languages?: string[];
  certifications?: ParsedCertification[];
  /** Detected Projects section — was silently discarded before the 2026-06
   *  wave-3 parser work. */
  projects?: ParsedProject[];
  uae?: ParsedUaeFields;
};

/** Why a parse failed — lets the UI route each failure mode differently
 *  instead of collapsing everything into an empty review screen
 *  (audit UX-18). */
export type ImportFailureKind =
  /** File opened but yielded (almost) no text — typical of scanned/image
   *  PDFs that would need OCR. */
  | "empty-text"
  /** The file could not be opened/decoded at all. */
  | "corrupt-file";

export class ImportParseError extends Error {
  constructor(
    public kind: ImportFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "ImportParseError";
  }
}

/** Swappable parser adapter interface — implement to add new import sources.
 *  parse() THROWS ImportParseError on failure (it used to swallow errors and
 *  resolve `{}`, which made every failure look like an empty success). */
export interface ImportAdapter {
  /** Human-readable source label */
  name: string;
  /** Parse a File object (PDF/DOCX) or raw string (LinkedIn paste) */
  parse(input: File | string): Promise<ParsedDocument>;
}
