import type React from "react";
import type { CvData, CvEducation, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { getFullName } from "./utils";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { splitSkills } from "../utils/skills";
import { getEssentialChips } from "../utils/essentials";
import { resolveTheme } from "./theme";

/**
 * "Gulf Standard" — the traditional UAE/Gulf expat CV (template audit
 * 2026-10, shortlist item 1). Single column; passport-ratio photo top-right as
 * an in-flow flex sibling; a labelled PERSONAL DETAILS grid directly under the
 * header (the fields recruiter databases filter on); plain uppercase headings
 * on thin accent rules. Every detail row is a flex row of bold label + value,
 * so line-based extractors keep the pair together. No separate Languages
 * section — languages live in Personal Details.
 *
 * Accent (theme.accentText on a white page) appears ONLY on the headline, the
 * headings and their rules; everything else is slate. Mirrored section by
 * section by GulfStandardPDFLayout in components/pdf/CVDocument.tsx — change
 * both or neither.
 */

export const GULF_STANDARD_ACCENT = "#1E3A5F";

const SLATE_900 = "#0F172A";
const SLATE_800 = "#1E293B";
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748B";
const SLATE_400 = "#94A3B8";
const SLATE_300 = "#CBD5E1";

// Passport proportion 3.5 : 4.5 (85 × 108 pt in the PDF).
const PHOTO_W = 113;
const PHOTO_H = 144;

const shortenDisplayUrl = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  if (!cleaned) return value.trim();
  const [domain, ...pathParts] = cleaned.split("/");
  if (pathParts.length === 0) return domain;
  const maxSegments = domain.toLowerCase().includes("linkedin.com") ? 2 : 1;
  const kept = pathParts.filter(Boolean).slice(0, maxSegments);
  return kept.length > 0 ? `${domain}/${kept.join("/")}` : domain;
};

const shouldShowProjectLink = (value?: string): boolean => {
  const normalized = value?.trim();
  if (!normalized) return false;
  return normalized.toLowerCase() !== "no link was pasted";
};

/**
 * Degree line with the de-dup rule from the audit: append the field only when
 * the degree text does not already contain it ("BSc Finance" + "Finance" is
 * printed once; "Bachelor of Business Administration" + "Supply Chain
 * Management" is printed as "… · Supply Chain Management").
 */
export const gulfDegreeTitle = (edu: CvEducation): string => {
  const degree = edu.degree?.trim() ?? "";
  const field = edu.field?.trim() ?? "";
  if (!degree) return field || "Degree";
  if (!field) return degree;
  return degree.toLowerCase().includes(field.toLowerCase())
    ? degree
    : `${degree} · ${field}`;
};

export type GulfDetailRow = { label: string; value: string };

/**
 * The Personal Details rows, in the Gulf order, with empties dropped:
 * Nationality, Date of birth, Visa status, Availability, Driving licence,
 * Languages. Built from getEssentialChips (which skips "None" licences) plus
 * dateOfBirth and data.languages. Shared with the PDF layout so both
 * renderers print identical label/value pairs.
 */
export const gulfDetailRows = (data: CvData): GulfDetailRow[] => {
  const chips = new Map(
    getEssentialChips(data.personal).map((chip) => [chip.label, chip.value]),
  );
  const rows: GulfDetailRow[] = [];
  const nationality = chips.get("Nationality");
  if (nationality) rows.push({ label: "Nationality", value: nationality });
  const dob = data.personal.dateOfBirth?.trim();
  if (dob) rows.push({ label: "Date of birth", value: dob });
  const visa = chips.get("Visa");
  if (visa) rows.push({ label: "Visa status", value: visa });
  const availability = chips.get("Available");
  if (availability) rows.push({ label: "Availability", value: availability });
  const licence = chips.get("DL");
  if (licence) rows.push({ label: "Driving licence", value: licence });
  const languages = data.languages
    .map((lang) => {
      const name = lang.name?.trim();
      if (!name) return "";
      return lang.level ? `${name} — ${formatLanguageLevel(lang.level)}` : name;
    })
    .filter(Boolean)
    .join(" · ");
  if (languages) rows.push({ label: "Languages", value: languages });
  return rows;
};

/** Split the rows into one or two column stacks (two only when > 2 rows). */
export const gulfDetailColumns = (rows: GulfDetailRow[]): GulfDetailRow[][] => {
  if (rows.length <= 2) return [rows];
  const half = Math.ceil(rows.length / 2);
  return [rows.slice(0, half), rows.slice(half)];
};

export const GulfStandardTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const theme = resolveTheme(data.settings, GULF_STANDARD_ACCENT);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  const m = theme.marginScale;
  const accent = theme.accentText;

  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const summary = data.personal.summary?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const certifications = data.certifications.filter(
    (cert) => cert.name?.trim() || cert.issuer?.trim(),
  );
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills.filter((skill) => skill.name?.trim()),
  );
  const detailRows = gulfDetailRows(data);
  const detailColumns = gulfDetailColumns(detailRows);

  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const roundPhoto = data.settings.photoShape === "round";
  const photoHeight = roundPhoto ? PHOTO_W : PHOTO_H;

  const email = data.personal.email?.trim() || "";
  const phone = data.personal.phone?.trim() || "";
  const locationText = data.personal.location?.trim() || "";
  const linkedin = data.personal.linkedin?.trim() || "";
  const website = data.personal.website?.trim() || "";
  const plainLink: React.CSSProperties = {
    color: "inherit",
    textDecoration: "none",
  };
  const contactParts: React.ReactNode[] = [
    phone ? (
      <a key="phone" href={`tel:${phone}`} style={plainLink}>
        {phone}
      </a>
    ) : null,
    email ? (
      <a key="email" href={`mailto:${email}`} style={plainLink}>
        {email}
      </a>
    ) : null,
    locationText ? <span key="location">{locationText}</span> : null,
    linkedin ? (
      <a
        key="linkedin"
        href={normalizeHref(linkedin)}
        target="_blank"
        rel="noreferrer"
        style={plainLink}
      >
        {shortenDisplayUrl(linkedin)}
      </a>
    ) : null,
    website ? (
      <a
        key="website"
        href={normalizeHref(website)}
        target="_blank"
        rel="noreferrer"
        style={plainLink}
      >
        {shortenDisplayUrl(website)}
      </a>
    ) : null,
  ].filter((part) => part !== null);

  const hasDetails = detailRows.length > 0;
  const hasSummary = summary.length > 0;
  const hasSkills = generalSkills.length > 0 || technicalSkills.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasCertifications = certifications.length > 0;
  const hasProjects = projects.length > 0;

  // The first rendered section carries marginTop 0; every later one gets the
  // scaled section gap (16pt = 21.33px at level 3). spaceScale touches ONLY
  // this gap — entry spacing inside a section stays fixed.
  const sectionOrder: Array<[string, boolean]> = [
    ["details", hasDetails],
    ["profile", hasSummary],
    ["skills", hasSkills],
    ["experience", hasExperience],
    ["education", hasEducation],
    ["certifications", hasCertifications],
    ["projects", hasProjects],
  ];
  const firstSection = sectionOrder.find(([, present]) => present)?.[0] ?? null;
  const sectionStyle = (id: string): React.CSSProperties => ({
    marginTop: firstSection === id ? 0 : `${21.33 * sp}px`,
  });

  const headingStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: "7px",
    paddingBottom: "3px",
    borderBottom: `1px solid ${accent}`,
    fontSize: `${11.5 * fs}px`,
    lineHeight: 1.3 * ls,
    fontWeight: 700,
    letterSpacing: "0.8px",
    color: accent,
  };
  // Render helpers, not components: a component declared inside render would
  // remount on every pass (react-hooks/static-components).
  const heading = (label: string) => (
    <h2 className="avoid-orphan [break-after:avoid]" style={headingStyle}>
      {label}
    </h2>
  );

  const bodyStyle: React.CSSProperties = {
    fontSize: `${11.5 * fs}px`,
    lineHeight: 1.45 * ls,
    color: SLATE_700,
  };
  const smallStyle: React.CSSProperties = {
    fontSize: `${11 * fs}px`,
    lineHeight: 1.45 * ls,
    color: SLATE_600,
  };
  const dateStyle: React.CSSProperties = {
    fontSize: `${11 * fs}px`,
    lineHeight: 1.45 * ls,
    color: SLATE_500,
    whiteSpace: "nowrap",
    flexShrink: 0,
    textAlign: "right",
  };
  const entryTitleStyle: React.CSSProperties = {
    fontSize: `${12 * fs}px`,
    lineHeight: 1.35 * ls,
    fontWeight: 700,
    color: SLATE_900,
    flex: 1,
    minWidth: 0,
  };
  const entryRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  };
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };
  const bulletListStyle: React.CSSProperties = {
    margin: 0,
    marginTop: "3px",
    paddingLeft: `${14 * fs}px`,
    listStyleType: "disc",
  };
  const bulletStyle: React.CSSProperties = {
    ...bodyStyle,
    marginBottom: "2px",
  };

  const renderBullets = (bullets: string[]) => {
    const items = bullets.map((b) => b.trim()).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <ul className="marker:text-slate-500" style={bulletListStyle}>
        {items.map((bullet, index) => (
          <li key={index} style={bulletStyle}>
            {bullet}
          </li>
        ))}
      </ul>
    );
  };

  const skillLine = (skills: typeof generalSkills) =>
    skills.map((skill) => skill.name.trim()).join(" · ");
  // Sub-labels only when BOTH groups exist: a lone "General" over an untagged
  // list (every legacy CV) would be noise.
  const showSkillLabels = generalSkills.length > 0 && technicalSkills.length > 0;
  const skillLabelStyle: React.CSSProperties = {
    ...smallStyle,
    fontWeight: 700,
    color: SLATE_800,
  };

  return (
    <div
      className="cv-print relative overflow-hidden bg-white"
      style={{
        fontFamily: theme.fontFamily,
        padding: `${36 * m}px ${32 * m}px`,
        fontSize: `${11.5 * fs}px`,
        lineHeight: 1.45 * ls,
        color: SLATE_800,
      }}
    >
      <div className="cv-content relative z-10">
        {/* ── Header: text block + in-flow passport photo ── */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "18px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              // A short header must not leave the 144px photo hanging below
              // the text: the text block is at least as tall as the photo.
              minHeight: showPhoto ? `${photoHeight}px` : undefined,
            }}
          >
            <h1
              // The step title is the page's h1 inside the builder (audit
              // F07); expose the CV name as level 2 to assistive tech.
              aria-level={2}
              style={{
                margin: 0,
                fontSize: `${27 * fs}px`,
                lineHeight: 1.15 * ls,
                fontWeight: 700,
                color: SLATE_900,
                overflowWrap: "anywhere",
              }}
            >
              {name}
            </h1>
            {headline ? (
              <p
                style={{
                  margin: 0,
                  marginTop: "2px",
                  fontSize: `${14.5 * fs}px`,
                  lineHeight: 1.3 * ls,
                  fontWeight: 500,
                  color: accent,
                }}
              >
                {headline}
              </p>
            ) : null}
            {contactParts.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  marginTop: "6px",
                  fontSize: `${11 * fs}px`,
                  lineHeight: 1.4 * ls,
                  color: SLATE_600,
                }}
              >
                {contactParts.map((part, index) => (
                  <span
                    key={index}
                    style={{ minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {part}
                    {index < contactParts.length - 1 ? (
                      <span style={{ color: SLATE_400, margin: "0 6px" }}>|</span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {showPhoto && data.personal.photo ? (
            <div
              style={{
                width: `${PHOTO_W}px`,
                // "round" cannot be an ellipse in react-pdf (a single corner
                // radius draws a capsule), so both renderers use a circle.
                height: `${photoHeight}px`,
                borderRadius: roundPhoto ? "50%" : 0,
                overflow: "hidden",
                flexShrink: 0,
                border: `1px solid ${SLATE_300}`,
                boxSizing: "border-box",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.personal.photo}
                alt={name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ) : null}
        </header>

        {/* ── Personal Details: labelled rows in one or two column stacks ── */}
        {hasDetails ? (
          <section
            className="avoid-break [break-inside:avoid]"
            style={sectionStyle("details")}
          >
            {heading("PERSONAL DETAILS")}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  detailColumns.length === 2 ? "1fr 1fr" : "1fr",
                columnGap: "18px",
              }}
            >
              {detailColumns.map((column, colIndex) => (
                <div
                  key={colIndex}
                  style={{ display: "flex", flexDirection: "column", gap: "3px" }}
                >
                  {column.map((row) => (
                    <div
                      key={row.label}
                      style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
                    >
                      <span
                        style={{
                          width: "38%",
                          flexShrink: 0,
                          fontSize: `${11 * fs}px`,
                          lineHeight: 1.45 * ls,
                          fontWeight: 700,
                          color: SLATE_800,
                        }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: `${11 * fs}px`,
                          lineHeight: 1.45 * ls,
                          color: SLATE_700,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Profile ── */}
        {hasSummary ? (
          <section style={sectionStyle("profile")}>
            {heading("PROFILE")}
            <p style={{ ...bodyStyle, margin: 0, whiteSpace: "pre-line" }}>
              {summary}
            </p>
          </section>
        ) : null}

        {/* ── Core Skills: text lines under bold sub-labels, no chips ── */}
        {hasSkills ? (
          <section style={sectionStyle("skills")}>
            {heading("CORE SKILLS")}
            {generalSkills.length > 0 ? (
              <div>
                {showSkillLabels ? <div style={skillLabelStyle}>General</div> : null}
                <p style={{ ...bodyStyle, margin: 0 }}>{skillLine(generalSkills)}</p>
              </div>
            ) : null}
            {technicalSkills.length > 0 ? (
              <div style={{ marginTop: generalSkills.length > 0 ? "5px" : 0 }}>
                {showSkillLabels ? <div style={skillLabelStyle}>Technical</div> : null}
                <p style={{ ...bodyStyle, margin: 0 }}>{skillLine(technicalSkills)}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Work Experience ── */}
        {hasExperience ? (
          <section style={sectionStyle("experience")}>
            {heading("WORK EXPERIENCE")}
            <div style={stackStyle}>
              {experience.map((role) => {
                const companyLine = [role.company?.trim(), role.location?.trim()]
                  .filter(Boolean)
                  .join(" | ");
                return (
                  <div key={role.id} className="avoid-break [break-inside:avoid]">
                    <div style={entryRowStyle}>
                      <div style={entryTitleStyle}>{role.role?.trim() || "Role"}</div>
                      <span style={dateStyle}>
                        {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                      </span>
                    </div>
                    {companyLine ? (
                      <div style={{ ...smallStyle, marginTop: "1px" }}>{companyLine}</div>
                    ) : null}
                    {renderBullets(role.bullets ?? [])}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Education ── */}
        {hasEducation ? (
          <section style={sectionStyle("education")}>
            {heading("EDUCATION")}
            <div style={stackStyle}>
              {education.map((edu) => {
                const school = edu.school?.trim() || "";
                const notes = edu.notes?.trim() || "";
                const attestingBody = edu.attestingBody?.trim() || "";
                return (
                  <div key={edu.id} className="avoid-break [break-inside:avoid]">
                    <div style={entryRowStyle}>
                      <div style={entryTitleStyle}>
                        {gulfDegreeTitle(edu)}
                        {school ? (
                          <span style={{ fontWeight: 400, color: SLATE_700 }}>
                            {` | ${school}`}
                          </span>
                        ) : null}
                      </div>
                      <span style={dateStyle}>
                        {formatDateRange(edu.startDate, edu.endDate)}
                      </span>
                    </div>
                    {notes ? (
                      <div style={{ ...smallStyle, marginTop: "1px" }}>{notes}</div>
                    ) : null}
                    {edu.attested && attestingBody ? (
                      <div style={{ ...smallStyle, marginTop: "1px" }}>
                        {`Attested — ${attestingBody}`}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Certifications ── */}
        {hasCertifications ? (
          <section style={sectionStyle("certifications")}>
            {heading("CERTIFICATIONS")}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {certifications.map((cert) => {
                const certName = cert.name?.trim() || "";
                const tail = [cert.issuer?.trim(), cert.date?.trim()]
                  .filter(Boolean)
                  .join(" | ");
                return (
                  <div key={cert.id} style={bodyStyle}>
                    <span style={{ fontWeight: 700, color: SLATE_800 }}>
                      {certName || tail}
                    </span>
                    {certName && tail ? (
                      <span style={{ color: SLATE_600 }}>{` | ${tail}`}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Projects ── */}
        {hasProjects ? (
          <section style={sectionStyle("projects")}>
            {heading("PROJECTS")}
            <div style={stackStyle}>
              {projects.map((project) => {
                const link = project.link?.trim() || "";
                const showLink = shouldShowProjectLink(link);
                return (
                  <div key={project.id} className="avoid-break [break-inside:avoid]">
                    <div style={{ ...entryTitleStyle, flex: undefined }}>
                      {project.name?.trim() || "Project"}
                    </div>
                    {showLink ? (
                      <div
                        style={{ ...smallStyle, marginTop: "1px", overflowWrap: "anywhere" }}
                      >
                        <a
                          href={normalizeHref(link)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: SLATE_600, textDecoration: "underline" }}
                        >
                          {shortenDisplayUrl(link)}
                        </a>
                      </div>
                    ) : null}
                    {renderBullets(project.bullets ?? [])}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};
