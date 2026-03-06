// LinkedIn import adapter — stub mode.
// unspecified: no LinkedIn OAuth credentials in this environment.
// Stub accepts either:
//   (a) Plain text pasted from a LinkedIn profile page (public product feature)
//   (b) A mocked JSON payload matching the LinkedIn API profile schema (dev-only, NOT a public feature)
//
// To enable real LinkedIn OAuth: set NEXT_PUBLIC_LINKEDIN_IMPORT=true and implement
// the server-side /api/import/linkedin OAuth flow, replacing this stub.

import type { ImportAdapter, ParsedDocument } from "./adapter";
import { parseTextToDocument } from "./textParser";

// Feature flag — controls whether the LinkedIn import UI is shown
export const LINKEDIN_IMPORT_ENABLED =
  process.env.NEXT_PUBLIC_LINKEDIN_IMPORT === "true" ||
  process.env.NODE_ENV === "development";

export const linkedinAdapter: ImportAdapter = {
  name: "LinkedIn",

  async parse(input: string): Promise<ParsedDocument> {
    if (!input || typeof input !== "string") return {};

    const trimmed = input.trim();

    // Dev-only: detect mocked LinkedIn JSON payload (NOT a product feature — internal only)
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const payload = JSON.parse(trimmed) as Record<string, unknown>;
        return mapLinkedInJson(payload);
      } catch {
        // Fall through to plain-text parser
      }
    }

    // Public feature: plain text pasted from LinkedIn profile page
    return parseTextToDocument(trimmed);
  },
};

// -------------------------------------------------------------------------
// Internal: maps LinkedIn API-style JSON → ParsedDocument (dev/stub only)
// -------------------------------------------------------------------------
type LinkedInDate = { year?: number; month?: number };
type LinkedInPosition = {
  title?: string;
  companyName?: string;
  company?: { name?: string };
  startDate?: LinkedInDate;
  endDate?: LinkedInDate;
  isCurrent?: boolean;
  description?: string;
  locationName?: string;
};
type LinkedInEducation = {
  schoolName?: string;
  degreeName?: string;
  fieldOfStudy?: string;
  startDate?: LinkedInDate;
  endDate?: LinkedInDate;
  description?: string;
};

const MONTHS = [
  "",
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function fmtDate(d: LinkedInDate | undefined): string {
  if (!d) return "";
  const mon = MONTHS[d.month ?? 0] ?? "";
  return mon ? `${mon} ${d.year}` : String(d.year ?? "");
}

function mapLinkedInJson(json: Record<string, unknown>): ParsedDocument {
  // Handle both flat profile and nested { profile: {...} } shapes
  const p = ((json.profile ?? json) as Record<string, unknown>);

  const firstName = String(p.firstName ?? "");
  const lastName = String(p.lastName ?? "");
  const headline = String(p.headline ?? "");
  const summary = String(p.summary ?? headline);

  const positions = (p.positions ?? p.experience ?? []) as LinkedInPosition[];
  const educations = (p.educations ?? p.education ?? []) as LinkedInEducation[];
  const skillsList = (p.skills ?? []) as Array<string | { name?: string }>;

  return {
    contact: {
      name: `${firstName} ${lastName}`.trim(),
      email: String(p.emailAddress ?? p.email ?? ""),
      location: String(p.locationName ?? p.location ?? ""),
      linkedin: p.vanityUrl
        ? `https://linkedin.com/in/${p.vanityUrl}`
        : undefined,
    },
    summary,
    experience: positions.map((pos) => ({
      role: pos.title,
      company: pos.companyName ?? pos.company?.name,
      location: pos.locationName,
      startDate: fmtDate(pos.startDate),
      endDate: pos.isCurrent ? "Present" : fmtDate(pos.endDate),
      isCurrent: Boolean(pos.isCurrent),
      bullets: pos.description ? [pos.description] : [],
    })),
    education: educations.map((edu) => ({
      school: edu.schoolName,
      degree: edu.degreeName,
      field: edu.fieldOfStudy,
      startDate: fmtDate(edu.startDate),
      endDate: fmtDate(edu.endDate),
      notes: edu.description,
    })),
    skills: skillsList.map((s) =>
      typeof s === "string" ? s : (s.name ?? "")
    ).filter(Boolean),
  };
}
