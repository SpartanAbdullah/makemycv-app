// Canonical types for the import pipeline.
// Each adapter (PDF/DOCX/LinkedIn) returns a ParsedDocument which is then
// reviewed by the user and mapped into CvData by fieldMapper.ts.

import type { LanguageLevel } from "../types/cv";
import { ImportParseError, type ImportErrorReason } from "./importErrors";

export type ParsedContact = {
  name?: string;
  /** Professional headline / tagline. Set either when the source already
   *  carries one (the report->builder path round-trips a full CvData) or when
   *  the text parser lifts the title line that sits under the name in the
   *  header block (e.g. "Odoo Administrator"). */
  headline?: string;
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
  /** Degree attestation captured from an "Attested - MOFA" line folded into
   *  this entry (UAE CVs list it under the degree, not as a separate block). */
  attested?: boolean;
  /** Canonical attesting-body label, matched to the builder's dropdown
   *  options when recognisable (e.g. "MOFA - UAE Ministry of Foreign Affairs"). */
  attestingBody?: string;
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

/** A language with the proficiency qualifier the CV actually stated, mapped to
 *  the CvLanguage.level enum. `level` is absent when the CV listed the
 *  language bare ("Urdu") — we never invent a proficiency. */
export type ParsedLanguage = {
  name: string;
  level?: LanguageLevel;
};

/** UAE recruiter-signal fields harvested from labeled lines
 *  ("Visa Status: ...", "Nationality: ...", "Notice Period: ..."). */
export type ParsedUaeFields = {
  nationality?: string;
  visaStatus?: string;
  availability?: string;
  drivingLicense?: string;
  /** Free-text as written on the CV ("15 March 1990", "15/03/1990") — mapped
   *  to CvPersonal.dateOfBirth, which is likewise an unparsed string. Common
   *  in the "Personal Details" block on UAE / South Asian CVs. */
  dateOfBirth?: string;
};

export type ParsedDocument = {
  contact?: ParsedContact;
  summary?: string;
  experience?: ParsedExperience[];
  education?: ParsedEducation[];
  skills?: string[];
  /** Language NAMES only. Stays the canonical list — MappingReview, the
   *  resume-checker fallback and the fixtures all read it — so adding levels
   *  never changes this field's shape. */
  languages?: string[];
  /** Same languages, index-aligned with `languages`, carrying the proficiency
   *  level the CV stated. Optional so adapters that don't produce levels (and
   *  older persisted payloads) stay valid; fieldMapper falls back to
   *  `languages` when it is absent. */
  languageDetails?: ParsedLanguage[];
  certifications?: ParsedCertification[];
  /** Detected Projects section - was silently discarded before the 2026-06
   *  wave-3 parser work. */
  projects?: ParsedProject[];
  uae?: ParsedUaeFields;
  /** Header-block lines the parser detected but could not map to any field
   *  (taglines, headlines, decorative text). Surfaced in MappingReview as a
   *  copyable "we couldn't place this" bucket - never silently dropped. */
  unplaced?: string[];
  /** Set by the PDF adapter when the file has more pages than it reads
   *  (MAX_PDF_PAGES); MappingReview tells the user which pages were read.
   *  Counts only, never document content. */
  pagesSkipped?: { read: number; total: number };
};

/** Why a parse failed. Since 2026-10-31 the kinds are the closed taxonomy in
 *  importErrors.ts (one value per `cv_import_failed.error_reason`); the two
 *  original kinds map as "empty-text" → no_text_layer / empty_text and
 *  "corrupt-file" → corrupt_pdf / corrupt_docx / encrypted_pdf / ... */
export type ImportFailureKind = ImportErrorReason;
export { ImportParseError };

/** Swappable parser adapter interface - implement to add new import sources.
 *  parse() THROWS ImportParseError on failure (it used to swallow errors and
 *  resolve `{}`, which made every failure look like an empty success). */
export interface ImportAdapter {
  /** Human-readable source label */
  name: string;
  /** Parse a File object (PDF/DOCX) or raw string (LinkedIn paste) */
  parse(input: File | string): Promise<ParsedDocument>;
}
