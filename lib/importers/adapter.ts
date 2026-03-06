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

export type ParsedDocument = {
  contact?: ParsedContact;
  summary?: string;
  experience?: ParsedExperience[];
  education?: ParsedEducation[];
  skills?: string[];
  languages?: string[];
  certifications?: ParsedCertification[];
};

/** Swappable parser adapter interface — implement to add new import sources. */
export interface ImportAdapter {
  /** Human-readable source label */
  name: string;
  /** Parse a File object (PDF/DOCX) or raw string (LinkedIn paste) */
  parse(input: File | string): Promise<ParsedDocument>;
}
