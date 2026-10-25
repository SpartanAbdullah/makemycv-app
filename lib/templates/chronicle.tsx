import type React from "react";
import type {
  CvData,
  CvEducation,
  CvPersonal,
  PlanTier,
} from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { getEssentialChips } from "../utils/essentials";
import { splitSkills } from "../utils/skills";
import { mix } from "../utils/color";
import { getFullName } from "./utils";
import { resolveTheme } from "./theme";

/**
 * "Chronicle" — the single-column reverse-chronological timeline (template
 * audit 2026-10, shortlist item 3). Experience, education and project entries
 * are three-track rows: the dates in a fixed left gutter, a vertical accent
 * rail with a filled dot per entry, the content to the right. Headings sit
 * flush left above the gutter with no rule — the rail is the visual spine.
 * No photo dependency (an optional small photo top-right, default off).
 *
 * The rail is drawn PER ENTRY (a line on the rail track of each row plus a
 * dot), never as one full-height element, so it breaks cleanly between
 * entries across pages in both renderers. The last entry of a section ends
 * its rail at the dot.
 *
 * Accent appears on the headline, the rail, the dots, the headings and the
 * company names only; everything else is slate text, so the body stays a
 * plain chronological CV for a parser (DOM/PDF text order per entry: date,
 * role, company, bullets). Mirrored by ChroniclePDFLayout in
 * components/pdf/CVDocument.tsx — change both or neither.
 */

export const CHRONICLE_ACCENT = "#0E7490";

/**
 * Track widths in pt (the live render uses px = pt × 4/3). The date track
 * scales with fontScale so "SEP 2019 – PRESENT" at 7.5pt uppercase still
 * fits on one line at density level 5; the rail track is fixed.
 */
export const CHRONICLE_DATE_TRACK_PT = 90;
export const CHRONICLE_DATE_GAP_PT = 8;
export const CHRONICLE_RAIL_TRACK_PT = 14;
export const CHRONICLE_RAIL_WIDTH_PT = 1.25;
export const CHRONICLE_DOT_PT = 6;
export const CHRONICLE_DOT_TOP_PT = 3;

const SLATE_900 = "#0F172A";
const SLATE_800 = "#1E293B";
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748B";
const SLATE_400 = "#94A3B8";
const SLATE_300 = "#CBD5E1";

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

/* ── Shared text rules (imported by the PDF layout) ───────────────────────── */

/**
 * Rail and dot colours. The dot is the contrast-guarded accent (identical to
 * the raw accent for every dark pick; darkened for a pale one such as the
 * Sand preset, so it stays visible on white). The rail is that colour
 * blended 30% toward white — an opaque hex, because the PDF cannot take
 * alpha colours.
 */
export const chronicleRailColors = (accentText: string) => ({
  dot: accentText,
  rail: mix(accentText, "#FFFFFF", 0.3),
});

export type ChronicleContactItem = { text: string; href?: string };

/** Contact row order: phone, email, location, LinkedIn, website. */
export const chronicleContactItems = (
  personal: CvPersonal,
): ChronicleContactItem[] => {
  const items: ChronicleContactItem[] = [];
  const phone = personal.phone?.trim();
  const email = personal.email?.trim();
  const location = personal.location?.trim();
  const linkedin = personal.linkedin?.trim();
  const website = personal.website?.trim();
  if (phone) items.push({ text: phone, href: `tel:${phone}` });
  if (email) items.push({ text: email, href: `mailto:${email}` });
  if (location) items.push({ text: location });
  if (linkedin)
    items.push({ text: shortenDisplayUrl(linkedin), href: normalizeHref(linkedin) });
  if (website)
    items.push({ text: shortenDisplayUrl(website), href: normalizeHref(website) });
  return items;
};

/**
 * The quiet essentials row under the contact line: full-word labels (a text
 * line can afford "Visa status" where a chip needs "Visa"), order and
 * filtering from getEssentialChips, plus the date of birth at the end when
 * it was entered — Chronicle has no other place to print it.
 */
const ESSENTIAL_LABELS: Record<string, string> = {
  Visa: "Visa status",
  Available: "Availability",
  DL: "Driving licence",
  Nationality: "Nationality",
};

export const chronicleEssentials = (
  personal: CvPersonal,
): Array<{ label: string; value: string }> => {
  const items = getEssentialChips(personal).map((chip) => ({
    label: ESSENTIAL_LABELS[chip.label] ?? chip.label,
    value: chip.value,
  }));
  const dob = personal.dateOfBirth?.trim();
  if (dob) items.push({ label: "Date of birth", value: dob });
  return items;
};

/** "Degree · Field" with the field dropped when the degree already names it. */
export const chronicleDegreeTitle = (edu: Pick<CvEducation, "degree" | "field">): string => {
  const degree = edu.degree?.trim() ?? "";
  const field = edu.field?.trim() ?? "";
  if (!degree) return field || "Degree";
  if (!field) return degree;
  return degree.toLowerCase().includes(field.toLowerCase())
    ? degree
    : `${degree} · ${field}`;
};

/* ── Template ─────────────────────────────────────────────────────────────── */

type TimelineEntry = {
  key: string;
  /** Gutter text; empty for undated entries (projects) — the dot still shows. */
  date: string;
  title: string;
  /** "Company · Location" line (company in accent) — already composed nodes. */
  subtitle: React.ReactNode;
  /** Extra quiet lines under the subtitle (education notes, attestation, links). */
  lines: React.ReactNode[];
  bullets: string[];
};

export const ChronicleTemplate = ({ data }: { data: CvData; plan?: PlanTier }) => {
  const theme = resolveTheme(data.settings, CHRONICLE_ACCENT);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  const m = theme.marginScale;
  const accent = theme.accentText;
  const { dot: dotColor, rail: railColor } = chronicleRailColors(accent);

  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const summary = data.personal.summary?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const certifications = data.certifications.filter(
    (cert) => cert.name?.trim() || cert.issuer?.trim(),
  );
  const languages = data.languages.filter((lang) => lang.name?.trim());
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills.filter((skill) => skill.name?.trim()),
  );
  const contactItems = chronicleContactItems(data.personal);
  const essentials = chronicleEssentials(data.personal);

  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const roundPhoto = data.settings.photoShape !== "square";
  const PHOTO = 72; // 54pt

  const hasSummary = summary.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const hasSkills = generalSkills.length > 0 || technicalSkills.length > 0;
  const hasLanguages = languages.length > 0;
  const hasCertifications = certifications.length > 0;

  // First rendered section carries marginTop 0; every later one gets the
  // scaled section gap (16pt = 21.33px at level 3). spaceScale touches ONLY
  // this gap.
  const sectionOrder: Array<[string, boolean]> = [
    ["profile", hasSummary],
    ["experience", hasExperience],
    ["education", hasEducation],
    ["projects", hasProjects],
    ["skills", hasSkills],
    ["languages", hasLanguages],
    ["certifications", hasCertifications],
  ];
  const firstSection = sectionOrder.find(([, present]) => present)?.[0] ?? null;
  const sectionStyle = (id: string): React.CSSProperties => ({
    marginTop: firstSection === id ? 0 : `${21.33 * sp}px`,
  });

  // pt → px (× 4/3) for the fixed geometry shared with the PDF layout.
  const px = (pt: number) => pt * (4 / 3);
  const dateTrack = px(CHRONICLE_DATE_TRACK_PT) * fs;
  const dateGap = px(CHRONICLE_DATE_GAP_PT);
  const railTrack = px(CHRONICLE_RAIL_TRACK_PT);
  const railWidth = px(CHRONICLE_RAIL_WIDTH_PT);
  const dotSize = px(CHRONICLE_DOT_PT);
  const dotTop = px(CHRONICLE_DOT_TOP_PT);

  const headingStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: "8px",
    fontSize: `${11.33 * fs}px`,
    lineHeight: 1.3 * ls,
    fontWeight: 700,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
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
    fontSize: `${11.47 * fs}px`,
    lineHeight: 1.5 * ls,
    color: SLATE_700,
  };
  const smallStyle: React.CSSProperties = {
    fontSize: `${11 * fs}px`,
    lineHeight: 1.4 * ls,
    color: SLATE_600,
  };
  const dateStyle: React.CSSProperties = {
    width: `${dateTrack}px`,
    flexShrink: 0,
    paddingRight: `${dateGap}px`,
    // Nudged so the first date line sits on the title's first line.
    paddingTop: "2px",
    boxSizing: "border-box",
    textAlign: "right",
    fontSize: `${10 * fs}px`,
    lineHeight: 1.35 * ls,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    color: SLATE_500,
  };
  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: `${12.67 * fs}px`,
    lineHeight: 1.35 * ls,
    fontWeight: 700,
    color: SLATE_900,
    overflowWrap: "anywhere",
  };
  const bulletListStyle: React.CSSProperties = {
    margin: 0,
    marginTop: "3px",
    paddingLeft: `${14 * fs}px`,
    listStyleType: "disc",
  };

  const renderBullets = (bullets: string[]) => {
    const items = bullets.map((b) => b.trim()).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <ul className="marker:text-slate-400" style={bulletListStyle}>
        {items.map((bullet, index) => (
          <li key={index} style={{ ...bodyStyle, marginBottom: "2px" }}>
            {bullet}
          </li>
        ))}
      </ul>
    );
  };

  /**
   * One timeline row: date track | rail track | content. The rail line is
   * drawn on this row only (full height, or down to the dot on the last
   * entry) so page breaks between entries never leave a dangling rail; the
   * entry gap lives INSIDE the content track so the row — and the rail —
   * stretches across it.
   */
  const renderEntry = (entry: TimelineEntry, last: boolean) => (
    <div
      key={entry.key}
      className="avoid-break [break-inside:avoid]"
      style={{ display: "flex", alignItems: "stretch" }}
    >
      <div style={dateStyle}>{entry.date}</div>
      <div
        aria-hidden="true"
        style={{ width: `${railTrack}px`, flexShrink: 0, position: "relative" }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${railWidth}px`,
            height: last ? `${dotTop + dotSize / 2}px` : "100%",
            backgroundColor: railColor,
          }}
        />
        <span
          style={{
            position: "absolute",
            top: `${dotTop}px`,
            left: `${railWidth / 2 - dotSize / 2}px`,
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            borderRadius: "50%",
            backgroundColor: dotColor,
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: last ? 0 : "12px",
        }}
      >
        <h3 style={titleStyle}>{entry.title}</h3>
        {entry.subtitle ? (
          <div style={{ ...smallStyle, marginTop: "1px" }}>{entry.subtitle}</div>
        ) : null}
        {entry.lines.map((line, index) => (
          <div key={index} style={{ ...smallStyle, marginTop: "1px" }}>
            {line}
          </div>
        ))}
        {renderBullets(entry.bullets)}
      </div>
    </div>
  );

  const renderTimeline = (entries: TimelineEntry[]) => (
    <div>
      {entries.map((entry, index) =>
        renderEntry(entry, index === entries.length - 1),
      )}
    </div>
  );

  const companyLine = (company: string, location: string): React.ReactNode =>
    company || location ? (
      <>
        {company ? <span style={{ color: accent }}>{company}</span> : null}
        {company && location ? " · " : ""}
        {location}
      </>
    ) : null;

  const experienceEntries: TimelineEntry[] = experience.map((role) => ({
    key: role.id,
    date: formatDateRange(role.startDate, role.endDate, role.isCurrent),
    title: role.role?.trim() || "Role",
    subtitle: companyLine(role.company?.trim() ?? "", role.location?.trim() ?? ""),
    lines: [],
    bullets: role.bullets ?? [],
  }));

  const educationEntries: TimelineEntry[] = education.map((edu) => {
    const notes = edu.notes?.trim() || "";
    const attestingBody = edu.attestingBody?.trim() || "";
    const lines: React.ReactNode[] = [];
    if (notes) lines.push(notes);
    if (edu.attested && attestingBody) lines.push(`Attested — ${attestingBody}`);
    return {
      key: edu.id,
      date: formatDateRange(edu.startDate, edu.endDate),
      title: chronicleDegreeTitle(edu),
      subtitle: companyLine(edu.school?.trim() ?? "", ""),
      lines,
      bullets: [],
    };
  });

  const projectEntries: TimelineEntry[] = projects.map((project) => {
    const link = project.link?.trim() || "";
    const lines: React.ReactNode[] = [];
    if (shouldShowProjectLink(link)) {
      lines.push(
        <a
          href={normalizeHref(link)}
          target="_blank"
          rel="noreferrer"
          style={{
            color: SLATE_600,
            textDecoration: "underline",
            overflowWrap: "anywhere",
          }}
        >
          {shortenDisplayUrl(link)}
        </a>,
      );
    }
    return {
      key: project.id,
      date: "",
      title: project.name?.trim() || "Project",
      subtitle: null,
      lines,
      bullets: project.bullets ?? [],
    };
  });

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

  const plainLink: React.CSSProperties = { color: "inherit", textDecoration: "none" };

  return (
    <div
      className="cv-print relative overflow-hidden bg-white"
      style={{
        fontFamily: theme.fontFamily,
        padding: `${36 * m}px ${32 * m}px`,
        fontSize: `${11.47 * fs}px`,
        lineHeight: 1.5 * ls,
        color: SLATE_800,
      }}
    >
      <div className="cv-content relative z-10">
        {/* ── Header: name / headline / contact / essentials + optional photo ── */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "18px",
            marginBottom: "18px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              // The step title is the page's h1 inside the builder (audit
              // F07); expose the CV name as level 2 to assistive tech.
              aria-level={2}
              style={{
                margin: 0,
                fontSize: `${30 * fs}px`,
                lineHeight: 1.15 * ls,
                fontWeight: 700,
                letterSpacing: "-0.3px",
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
                  marginTop: "3px",
                  fontSize: `${14 * fs}px`,
                  lineHeight: 1.3 * ls,
                  fontWeight: 500,
                  color: accent,
                }}
              >
                {headline}
              </p>
            ) : null}
            {contactItems.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  marginTop: "7px",
                  fontSize: `${11 * fs}px`,
                  lineHeight: 1.4 * ls,
                  color: SLATE_600,
                }}
              >
                {contactItems.map((item, index) => (
                  <span key={index} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {item.href ? (
                      <a href={item.href} style={plainLink}>
                        {item.text}
                      </a>
                    ) : (
                      item.text
                    )}
                    {index < contactItems.length - 1 ? (
                      <span style={{ color: SLATE_400, margin: "0 6px" }}>|</span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
            {essentials.length > 0 ? (
              <div
                style={{
                  marginTop: "3px",
                  fontSize: `${10 * fs}px`,
                  lineHeight: 1.45 * ls,
                  color: SLATE_600,
                }}
              >
                {essentials.map((item, index) => (
                  <span key={item.label}>
                    {index > 0 ? " · " : ""}
                    <span style={{ fontWeight: 700 }}>{item.label}:</span> {item.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {showPhoto && data.personal.photo ? (
            <div
              style={{
                width: `${PHOTO}px`,
                height: `${PHOTO}px`,
                borderRadius: roundPhoto ? "50%" : "4px",
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
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          ) : null}
        </header>

        {/* ── Profile ── */}
        {hasSummary ? (
          <section style={sectionStyle("profile")}>
            {heading("Profile")}
            <p style={{ ...bodyStyle, margin: 0, whiteSpace: "pre-line" }}>{summary}</p>
          </section>
        ) : null}

        {/* ── Experience (timeline) ── */}
        {hasExperience ? (
          <section style={sectionStyle("experience")}>
            {heading("Experience")}
            {renderTimeline(experienceEntries)}
          </section>
        ) : null}

        {/* ── Education (timeline) ── */}
        {hasEducation ? (
          <section style={sectionStyle("education")}>
            {heading("Education")}
            {renderTimeline(educationEntries)}
          </section>
        ) : null}

        {/* ── Projects (timeline, undated) ── */}
        {hasProjects ? (
          <section style={sectionStyle("projects")}>
            {heading("Projects")}
            {renderTimeline(projectEntries)}
          </section>
        ) : null}

        {/* ── Skills: text lines under bold sub-labels, no chips ── */}
        {hasSkills ? (
          <section style={sectionStyle("skills")}>
            {heading("Skills")}
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

        {/* ── Languages ── */}
        {hasLanguages ? (
          <section style={sectionStyle("languages")}>
            {heading("Languages")}
            <div>
              {languages.map((lang) => (
                <div key={lang.id} style={bodyStyle}>
                  <span style={{ fontWeight: 700, color: SLATE_800 }}>{lang.name.trim()}</span>
                  {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Certifications ── */}
        {hasCertifications ? (
          <section style={sectionStyle("certifications")}>
            {heading("Certifications")}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {certifications.map((cert) => {
                const certName = cert.name?.trim() || "";
                const tail = [cert.issuer?.trim(), cert.date?.trim()]
                  .filter(Boolean)
                  .join(" | ");
                return (
                  <div key={cert.id} style={bodyStyle}>
                    <span style={{ fontWeight: 700, color: SLATE_800 }}>{certName || tail}</span>
                    {certName && tail ? (
                      <span style={{ color: SLATE_600 }}>{` | ${tail}`}</span>
                    ) : null}
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
