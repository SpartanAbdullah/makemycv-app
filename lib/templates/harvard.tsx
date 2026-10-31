import type React from "react";
import type {
  CvCertification,
  CvData,
  CvEducation,
  CvLanguage,
  CvPersonal,
  CvSkill,
  PlanTier,
} from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { educationTitle, meaningfulEducation } from "../utils/education";
import { getEssentialChips } from "../utils/essentials";
import { splitSkills } from "../utils/skills";
import { getFullName } from "./utils";
import { resolveTheme } from "./theme";

/**
 * "Harvard" — the Harvard/MCS and Jake's Resume grammar (template audit
 * 2026-10, shortlist item 4): zero-colour, serif-led single column with a
 * centred Title Case name, a pipe-separated contact line, uppercase serif
 * headings over hairline rules, tab-stop right-aligned dates, label-prefixed
 * skills lines and no photo. Tuned for fresh graduates and "just make it
 * plain" seekers: education FIRST, the summary framed as a Career Objective,
 * one-page target (template default density level 2 / 2, not enforced).
 *
 * Fonts: name, headings and the italic sub-lines are set in the serif face
 * (--cv-font-serif live, PDF_FAMILY.serif in react-pdf); the body stays in
 * theme.fontFamily (default Inter). Instrument Serif ships weight 400 only,
 * so hierarchy comes from size and caps, never from a bold serif — and the
 * italic lines use the serif because Inter has no italic cut in either
 * renderer, which keeps the preview and the download identical.
 *
 * The accent is ignored entirely (black only); the registry flags the
 * template with `ignoresAccent` so the Colours group is hidden for it.
 * Mirrored by HarvardPDFLayout in components/pdf/CVDocument.tsx — change
 * both or neither.
 */

export const HARVARD_INK = "#000000";
/** Secondary ink for the contact and essentials lines. */
export const HARVARD_INK_SOFT = "#333333";
export const HARVARD_RULE = "#000000";

/** Page padding in pt: tighter than the shared 27/24 sheet (22 top/bottom, 20 sides). */
export const HARVARD_PAGE_PADDING_PT = { vertical: 22, horizontal: 20 };

/**
 * Template default density. Applied when a user switches TO Harvard with the
 * density controls still at their neutral defaults; reverted to neutral when
 * they switch away with these values still in place (see
 * settingsForTemplate in lib/templates/index.tsx).
 */
export const HARVARD_DENSITY_DEFAULTS = { fontSize: 2, sectionSpacing: 2 } as const;

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

export type HarvardContactItem = { text: string; href?: string };

/** Contact line order: location, phone, email, LinkedIn, website. */
export const harvardContactItems = (personal: CvPersonal): HarvardContactItem[] => {
  const items: HarvardContactItem[] = [];
  const location = personal.location?.trim();
  const phone = personal.phone?.trim();
  const email = personal.email?.trim();
  const linkedin = personal.linkedin?.trim();
  const website = personal.website?.trim();
  if (location) items.push({ text: location });
  if (phone) items.push({ text: phone, href: `tel:${phone}` });
  if (email) items.push({ text: email, href: `mailto:${email}` });
  if (linkedin)
    items.push({ text: shortenDisplayUrl(linkedin), href: normalizeHref(linkedin) });
  if (website)
    items.push({ text: shortenDisplayUrl(website), href: normalizeHref(website) });
  return items;
};

/**
 * Third header line: "Nationality: X | Visa: Y | Available: Z" (+ "Driving
 * licence: Z" when set). Values and filtering come from getEssentialChips;
 * only the order changes — nationality first, as on a graduate CV.
 */
export const harvardEssentials = (
  personal: CvPersonal,
): Array<{ label: string; value: string }> => {
  const chips = new Map(
    getEssentialChips(personal).map((chip) => [chip.label, chip.value]),
  );
  const items: Array<{ label: string; value: string }> = [];
  const nationality = chips.get("Nationality");
  if (nationality) items.push({ label: "Nationality", value: nationality });
  const visa = chips.get("Visa");
  if (visa) items.push({ label: "Visa", value: visa });
  const available = chips.get("Available");
  if (available) items.push({ label: "Available", value: available });
  const licence = chips.get("DL");
  if (licence) items.push({ label: "Driving licence", value: licence });
  return items;
};

/** "Degree · Field" with the field dropped when the degree already names it. */
export const harvardDegreeTitle = (edu: Pick<CvEducation, "degree" | "field">): string =>
  educationTitle(edu.degree, edu.field, " · ");

/**
 * Compact CEFR-style level for the "Languages:" line — "Arabic (Native),
 * English (C2)" — where the full "Full Professional (C2)" label would nest
 * parentheses. Unknown tokens fall back to the shared label.
 */
const HARVARD_LEVELS: Record<string, string> = {
  native: "Native",
  full_professional: "C2",
  professional: "C1",
  conversational: "B1–B2",
  elementary: "A1–A2",
  advanced: "C1",
  fluent: "C1",
  intermediate: "B1–B2",
  beginner: "A1–A2",
};

export const harvardLanguageLevel = (level?: string): string =>
  level ? HARVARD_LEVELS[level] ?? formatLanguageLevel(level) : "";

export const harvardLanguagesLine = (languages: CvLanguage[]): string =>
  languages
    .map((lang) => {
      const name = lang.name?.trim();
      if (!name) return "";
      const level = harvardLanguageLevel(lang.level);
      return level ? `${name} (${level})` : name;
    })
    .filter(Boolean)
    .join(", ");

/** "name (issuer, year); name (issuer)" — semicolons because issuers carry commas. */
export const harvardCertificationsLine = (certifications: CvCertification[]): string =>
  certifications
    .map((cert) => {
      const certName = cert.name?.trim() ?? "";
      const tail = [cert.issuer?.trim(), cert.date?.trim()].filter(Boolean).join(", ");
      if (!certName) return tail;
      return tail ? `${certName} (${tail})` : certName;
    })
    .filter(Boolean)
    .join("; ");

export const harvardSkillsLine = (skills: CvSkill[]): string =>
  skills.map((skill) => skill.name.trim()).filter(Boolean).join(", ");

/** The label-prefixed lines of SKILLS & INTERESTS, in order, empties dropped. */
export const harvardSkillLines = (
  data: CvData,
): Array<{ label: string; value: string }> => {
  const { general, technical } = splitSkills(
    data.skills.filter((skill) => skill.name?.trim()),
  );
  const lines: Array<{ label: string; value: string }> = [];
  const technicalLine = harvardSkillsLine(technical);
  if (technicalLine) lines.push({ label: "Technical", value: technicalLine });
  const generalLine = harvardSkillsLine(general);
  if (generalLine) lines.push({ label: "Skills", value: generalLine });
  const languagesLine = harvardLanguagesLine(data.languages);
  if (languagesLine) lines.push({ label: "Languages", value: languagesLine });
  const certificationsLine = harvardCertificationsLine(
    data.certifications.filter((cert) => cert.name?.trim() || cert.issuer?.trim()),
  );
  if (certificationsLine) lines.push({ label: "Certifications", value: certificationsLine });
  return lines;
};

/* ── Template ─────────────────────────────────────────────────────────────── */

export const HarvardTemplate = ({ data }: { data: CvData; plan?: PlanTier }) => {
  const theme = resolveTheme(data.settings);
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  const m = theme.marginScale;
  const serif = "var(--cv-font-serif)";

  const name = getFullName(data) || "Your Name";
  const summary = data.personal.summary?.trim() || "";
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const contactItems = harvardContactItems(data.personal);
  const essentials = harvardEssentials(data.personal);
  const skillLines = harvardSkillLines(data);

  const hasObjective = summary.length > 0;
  const hasEducation = education.length > 0;
  const hasExperience = experience.length > 0;
  const hasProjects = projects.length > 0;
  const hasSkills = skillLines.length > 0;

  // Education-first order; when education is empty the list simply falls
  // through to experience first. First rendered section has marginTop 0;
  // later ones get 10pt × spaceScale (13.33px at level 3).
  const sectionOrder: Array<[string, boolean]> = [
    ["objective", hasObjective],
    ["education", hasEducation],
    ["experience", hasExperience],
    ["projects", hasProjects],
    ["skills", hasSkills],
  ];
  const firstSection = sectionOrder.find(([, present]) => present)?.[0] ?? null;
  const sectionStyle = (id: string): React.CSSProperties => ({
    marginTop: firstSection === id ? 0 : `${13.33 * sp}px`,
  });

  const px = (pt: number) => pt * (4 / 3);

  const headingStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: "6px",
    paddingBottom: "2px",
    borderBottom: `${px(0.5)}px solid ${HARVARD_RULE}`,
    fontFamily: serif,
    fontSize: `${12 * fs}px`,
    lineHeight: 1.25 * ls,
    fontWeight: 400,
    letterSpacing: `${px(0.5)}px`,
    textTransform: "uppercase",
    color: HARVARD_INK,
  };
  // Render helpers, not components (react-hooks/static-components).
  const heading = (label: string) => (
    <h2 className="avoid-orphan [break-after:avoid]" style={headingStyle}>
      {label}
    </h2>
  );

  const bodyStyle: React.CSSProperties = {
    fontSize: `${13.33 * fs}px`,
    lineHeight: 1.35 * ls,
    color: HARVARD_INK,
  };
  const boldStyle: React.CSSProperties = { ...bodyStyle, fontWeight: 700 };
  // Serif italic is the only true italic both renderers can draw; it sits a
  // touch larger than the sans body because Instrument Serif's x-height is
  // smaller.
  const italicStyle: React.CSSProperties = {
    fontFamily: serif,
    fontStyle: "italic",
    fontSize: `${14 * fs}px`,
    lineHeight: 1.3 * ls,
    color: HARVARD_INK,
  };
  const rightStyle: React.CSSProperties = {
    ...bodyStyle,
    whiteSpace: "nowrap",
    flexShrink: 0,
    textAlign: "right",
  };
  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "12px",
  };
  const bulletListStyle: React.CSSProperties = {
    margin: 0,
    marginTop: "2px",
    paddingLeft: `${16 * fs}px`,
    listStyleType: "disc",
  };
  const stackStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  };

  const renderBullets = (bullets: string[]) => {
    const items = bullets.map((b) => b.trim()).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <ul className="marker:text-black" style={bulletListStyle}>
        {items.map((bullet, index) => (
          <li key={index} style={{ ...bodyStyle, marginBottom: "1px" }}>
            {bullet}
          </li>
        ))}
      </ul>
    );
  };

  const plainLink: React.CSSProperties = { color: "inherit", textDecoration: "none" };
  const bar = <span style={{ color: "#999999", margin: "0 6px" }}>|</span>;

  return (
    <div
      className="cv-print cv-bidi relative overflow-hidden bg-white"
      style={{
        fontFamily: theme.fontFamily,
        padding: `${px(HARVARD_PAGE_PADDING_PT.vertical) * m}px ${
          px(HARVARD_PAGE_PADDING_PT.horizontal) * m
        }px`,
        fontSize: `${13.33 * fs}px`,
        lineHeight: 1.35 * ls,
        color: HARVARD_INK,
      }}
    >
      <div className="cv-content relative z-10">
        {/* ── Header, all centred: serif name, pipe contact line, essentials ── */}
        <header style={{ textAlign: "center", marginBottom: "12px" }}>
          <h1
            // The step title is the page's h1 inside the builder (audit
            // F07); expose the CV name as level 2 to assistive tech.
            aria-level={2}
            style={{
              margin: 0,
              fontFamily: serif,
              fontSize: `${26.67 * fs}px`,
              lineHeight: 1.15 * ls,
              fontWeight: 400,
              color: HARVARD_INK,
              overflowWrap: "anywhere",
            }}
          >
            {name}
          </h1>
          {contactItems.length > 0 ? (
            <div
              style={{
                marginTop: "4px",
                fontSize: `${11 * fs}px`,
                lineHeight: 1.45 * ls,
                color: HARVARD_INK_SOFT,
                overflowWrap: "anywhere",
              }}
            >
              {contactItems.map((item, index) => (
                <span key={index}>
                  {index > 0 ? bar : null}
                  {item.href ? (
                    <a href={item.href} style={plainLink}>
                      {item.text}
                    </a>
                  ) : (
                    item.text
                  )}
                </span>
              ))}
            </div>
          ) : null}
          {essentials.length > 0 ? (
            <div
              style={{
                marginTop: "2px",
                fontSize: `${10 * fs}px`,
                lineHeight: 1.45 * ls,
                color: HARVARD_INK_SOFT,
              }}
            >
              {essentials.map((item, index) => (
                <span key={item.label}>
                  {index > 0 ? bar : null}
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        {/* ── Career Objective ── */}
        {hasObjective ? (
          <section style={sectionStyle("objective")}>
            {heading("CAREER OBJECTIVE")}
            <p style={{ ...bodyStyle, margin: 0, whiteSpace: "pre-line" }}>{summary}</p>
          </section>
        ) : null}

        {/* ── Education (first) ── */}
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
                    <div style={rowStyle}>
                      <span style={{ ...boldStyle, flex: 1, minWidth: 0 }}>
                        {harvardDegreeTitle(edu)}
                      </span>
                      <span style={rightStyle}>
                        {formatDateRange(edu.startDate, edu.endDate)}
                      </span>
                    </div>
                    {school ? <div style={italicStyle}>{school}</div> : null}
                    {notes ? <div style={bodyStyle}>{notes}</div> : null}
                    {edu.attested && attestingBody ? (
                      <div style={bodyStyle}>{`Attested — ${attestingBody}`}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Experience & Internships ── */}
        {hasExperience ? (
          <section style={sectionStyle("experience")}>
            {heading("EXPERIENCE & INTERNSHIPS")}
            <div style={stackStyle}>
              {experience.map((role) => {
                const company = role.company?.trim() || "";
                const location = role.location?.trim() || "";
                const title = role.role?.trim() || "";
                const dates = formatDateRange(role.startDate, role.endDate, role.isCurrent);
                return (
                  <div key={role.id} className="avoid-break [break-inside:avoid]">
                    <div style={rowStyle}>
                      <span style={{ ...boldStyle, flex: 1, minWidth: 0 }}>
                        {company || title || "Role"}
                      </span>
                      {location ? <span style={rightStyle}>{location}</span> : null}
                    </div>
                    {company && (title || dates) ? (
                      <div style={rowStyle}>
                        <span style={{ ...italicStyle, flex: 1, minWidth: 0 }}>{title}</span>
                        {dates ? <span style={rightStyle}>{dates}</span> : null}
                      </div>
                    ) : dates ? (
                      <div style={rowStyle}>
                        <span style={{ flex: 1 }} />
                        <span style={rightStyle}>{dates}</span>
                      </div>
                    ) : null}
                    {renderBullets(role.bullets ?? [])}
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
                return (
                  <div key={project.id} className="avoid-break [break-inside:avoid]">
                    <div style={boldStyle}>{project.name?.trim() || "Project"}</div>
                    {shouldShowProjectLink(link) ? (
                      <div style={{ ...bodyStyle, overflowWrap: "anywhere" }}>
                        <a
                          href={normalizeHref(link)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: HARVARD_INK_SOFT, textDecoration: "underline" }}
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

        {/* ── Skills & Interests: label-prefixed lines ── */}
        {hasSkills ? (
          <section style={sectionStyle("skills")}>
            {heading("SKILLS & INTERESTS")}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {skillLines.map((line) => (
                <p key={line.label} style={{ ...bodyStyle, margin: 0 }}>
                  <span style={{ fontWeight: 700 }}>{line.label}:</span> {line.value}
                </p>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};
