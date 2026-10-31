import type React from "react";
import type { CvData, CvPersonal, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { educationTitle, meaningfulEducation } from "../utils/education";
import { getEssentialChips } from "../utils/essentials";
import { splitSkills } from "../utils/skills";
import { mix } from "../utils/color";
import { getFullName } from "./utils";
import { resolveTheme } from "./theme";

/**
 * "Banner" — a full-width accent header band (large square portrait on the
 * left, name / headline / contact row on the right) over a single-column body,
 * with a UAE-essentials strip directly under the band. The Google Docs
 * Spearmint / Canva Simple Blue / Word nameplate shape that UAE builders push
 * as the photo-led CV for customer-facing roles (template audit 2026-10,
 * shortlist item 2). Accent appears only in the band, the strip, the headings
 * and company names; everything else is plain slate text, so the body stays
 * linearly parseable.
 *
 * Both renderers (this file and BannerPDFLayout in components/pdf/CVDocument.tsx)
 * mirror each other section by section; keep them in step.
 */

const SLATE_800 = "#1E293B";
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748B";

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

/* ── Shared text rules (used by the PDF layout too) ───────────────────────── */

/**
 * The essentials strip spells the chip labels out in full: a plain-text line
 * can afford "Visa status" where a chip needs "Visa", and recruiters scan the
 * strip for exactly those words. Order and filtering come from
 * getEssentialChips so the strip never disagrees with the other templates.
 */
const STRIP_LABELS: Record<string, string> = {
  Visa: "Visa status",
  Available: "Availability",
  DL: "Driving licence",
  Nationality: "Nationality",
};

export const bannerEssentials = (
  personal: CvPersonal,
): Array<{ label: string; value: string }> =>
  getEssentialChips(personal).map((chip) => ({
    label: STRIP_LABELS[chip.label] ?? chip.label,
    value: chip.value,
  }));

/** "Degree · Field | School" with the field dropped when the degree already names it. */
export const bannerEducationTitle = (edu: {
  degree?: string;
  field?: string;
}): string => educationTitle(edu.degree, edu.field, " · ");

export type BannerContactItem = { text: string; href?: string };

/** Contact row order: phone, email, location, LinkedIn, website, DOB. */
export const bannerContactItems = (personal: CvPersonal): BannerContactItem[] => {
  const items: BannerContactItem[] = [];
  const phone = personal.phone?.trim();
  const email = personal.email?.trim();
  const location = personal.location?.trim();
  const linkedin = personal.linkedin?.trim();
  const website = personal.website?.trim();
  const dob = personal.dateOfBirth?.trim();
  if (phone) items.push({ text: phone, href: `tel:${phone}` });
  if (email) items.push({ text: email, href: `mailto:${email}` });
  if (location) items.push({ text: location });
  if (linkedin)
    items.push({ text: shortenDisplayUrl(linkedin), href: normalizeHref(linkedin) });
  if (website)
    items.push({ text: shortenDisplayUrl(website), href: normalizeHref(website) });
  if (dob) items.push({ text: `DOB: ${dob}` });
  return items;
};

/* ── Section heading: bold uppercase accent text + rule to the right edge ──── */

const SectionHeading = ({
  children,
  accent,
  rule,
  isFirst = false,
  fontScale,
  lineScale,
  spaceScale,
}: {
  children: React.ReactNode;
  accent: string;
  rule: string;
  isFirst?: boolean;
  fontScale: number;
  lineScale: number;
  spaceScale: number;
}) => (
  <div
    className="avoid-orphan [break-after:avoid]"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginTop: isFirst ? 0 : `${21 * spaceScale}px`,
      marginBottom: "8px",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontSize: `${12 * fontScale}px`,
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase" as const,
        color: accent,
        lineHeight: 1.2 * lineScale,
        whiteSpace: "nowrap" as const,
      }}
    >
      {children}
    </h2>
    <div style={{ flex: 1, height: "1px", backgroundColor: rule }} />
  </div>
);

/* ── Template ─────────────────────────────────────────────────────────────── */

export const BannerTemplate = ({ data }: { data: CvData; plan?: PlanTier }) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#1e5b54");
  const { accent, accentText, accentSoft, onAccent, onAccentMuted } = theme;
  const fs = theme.fontScale;
  const ls = theme.lineScale;
  const sp = theme.spaceScale;
  const m = theme.marginScale;

  // Opaque blends only — the PDF twin cannot use alpha colours, and keeping
  // the live ring/rule identical means the preview matches the download.
  const photoRing = mix(onAccent, accent, 0.75);
  const headingRule = mix(accentSoft, accentText, 0.25);

  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const essentials = bannerEssentials(data.personal);
  const contactItems = bannerContactItems(data.personal);

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = experience.length > 0;
  const hasSkills = generalSkills.length > 0 || technicalSkills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const roundPhoto = data.settings.photoShape !== "square";

  // Headings carry the first-section rule: the first visible section has no
  // top gap, every later one gets 16pt × spaceScale.
  let sectionIndex = 0;
  const heading = (label: string) => {
    const isFirst = sectionIndex === 0;
    sectionIndex += 1;
    return (
      <SectionHeading
        accent={accentText}
        rule={headingRule}
        isFirst={isFirst}
        fontScale={fs}
        lineScale={ls}
        spaceScale={sp}
      >
        {label}
      </SectionHeading>
    );
  };

  const bodyText = {
    fontSize: `${11.5 * fs}px`,
    lineHeight: 1.5 * ls,
    color: SLATE_700,
  };
  const entryTitle = {
    fontSize: `${12 * fs}px`,
    fontWeight: 700,
    color: SLATE_800,
    lineHeight: 1.35 * ls,
  };
  const entryDate = {
    fontSize: `${11 * fs}px`,
    color: SLATE_500,
    lineHeight: 1.35 * ls,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
    textAlign: "right" as const,
  };
  const subLine = {
    fontSize: `${11 * fs}px`,
    color: SLATE_600,
    lineHeight: 1.4 * ls,
  };

  const Bullets = ({ bullets }: { bullets: string[] }) => {
    const items = bullets.map((b) => b.trim()).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <ul
        className="list-disc marker:text-slate-400"
        style={{ margin: "4px 0 0", paddingLeft: "16px" }}
      >
        {items.map((bullet, i) => (
          <li key={i} style={{ ...bodyText, marginBottom: "2px" }}>
            {bullet}
          </li>
        ))}
      </ul>
    );
  };

  const skillLine = (skills: typeof generalSkills) =>
    skills.map((skill) => skill.name.trim()).filter(Boolean).join(" · ");
  const showSkillLabels = generalSkills.length > 0 && technicalSkills.length > 0;

  return (
    <div
      className="cv-print cv-bidi relative overflow-hidden bg-white"
      style={{
        fontFamily: theme.fontFamily,
        color: SLATE_700,
        fontSize: `${11.5 * fs}px`,
        lineHeight: 1.5 * ls,
      }}
    >
      {/* ── Accent band (page 1 only). The root carries no padding, so the band
          and strip run edge to edge and the body below re-adds the 32px × m
          side padding — the same geometry as negative margins against a padded
          root, without relying on them. ── */}
      <header
        style={{
          backgroundColor: accent,
          padding: `27px ${32 * m}px`,
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        {showPhoto && data.personal.photo && (
          <div
            style={{
              width: 128,
              height: roundPhoto ? 128 : 158,
              borderRadius: roundPhoto ? "50%" : 4,
              overflow: "hidden",
              flexShrink: 0,
              border: `2px solid ${photoRing}`,
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
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            // Level 2 for assistive tech: inside the builder the step title is
            // the page's h1 (audit F07).
            aria-level={2}
            style={{
              margin: 0,
              fontSize: `${30 * fs}px`,
              fontWeight: 700,
              color: onAccent,
              letterSpacing: "-0.3px",
              lineHeight: 1.15 * ls,
            }}
          >
            {name}
          </h1>
          {headline && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: `${14.5 * fs}px`,
                color: onAccentMuted,
                lineHeight: 1.35 * ls,
              }}
            >
              {headline}
            </p>
          )}
          {contactItems.length > 0 && (
            <div
              style={{
                marginTop: "10px",
                fontSize: `${11 * fs}px`,
                color: onAccent,
                lineHeight: 1.6 * ls,
                overflowWrap: "anywhere" as const,
              }}
            >
              {contactItems.map((item, i) => (
                <span key={`${item.text}-${i}`}>
                  {i > 0 ? " · " : ""}
                  {item.href ? (
                    <a
                      href={item.href}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {item.text}
                    </a>
                  ) : (
                    item.text
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── UAE essentials strip ── */}
      {essentials.length > 0 && (
        <div
          style={{
            backgroundColor: accentSoft,
            padding: `5px ${32 * m}px`,
            fontSize: `${10 * fs}px`,
            color: accentText,
            lineHeight: 1.5 * ls,
          }}
        >
          {essentials.map((item, i) => (
            <span key={item.label}>
              {i > 0 ? " · " : ""}
              <span style={{ fontWeight: 700 }}>{item.label}:</span> {item.value}
            </span>
          ))}
        </div>
      )}

      {/* ── Single-column body ── */}
      <div
        className="cv-content"
        style={{ padding: `21px ${32 * m}px ${36 * m}px` }}
      >
        {hasSummary && (
          <section className="cv-section">
            {heading("Profile")}
            <p style={{ ...bodyText, margin: 0, whiteSpace: "pre-line" }}>
              {data.personal.summary?.trim()}
            </p>
          </section>
        )}

        {hasExperience && (
          <section className="cv-section">
            {heading("Work Experience")}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {experience.map((role) => {
                const company = role.company?.trim();
                const location = role.location?.trim();
                return (
                  <div key={role.id} className="avoid-break [break-inside:avoid]">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <span style={{ ...entryTitle, flex: 1, minWidth: 0 }}>
                        {role.role?.trim() || "Role"}
                      </span>
                      <span style={entryDate}>
                        {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                      </span>
                    </div>
                    {(company || location) && (
                      <div style={{ ...subLine, marginTop: "1px" }}>
                        {company ? (
                          <span style={{ color: accentText }}>{company}</span>
                        ) : null}
                        {company && location ? " · " : ""}
                        {location}
                      </div>
                    )}
                    <Bullets bullets={role.bullets ?? []} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasSkills && (
          <section className="cv-section">
            {heading("Skills")}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {generalSkills.length > 0 && (
                <div>
                  {showSkillLabels && (
                    <div style={{ ...subLine, color: SLATE_800, fontWeight: 700 }}>
                      General
                    </div>
                  )}
                  <p style={{ ...bodyText, margin: 0 }}>{skillLine(generalSkills)}</p>
                </div>
              )}
              {technicalSkills.length > 0 && (
                <div>
                  {showSkillLabels && (
                    <div style={{ ...subLine, color: SLATE_800, fontWeight: 700 }}>
                      Technical
                    </div>
                  )}
                  <p style={{ ...bodyText, margin: 0 }}>{skillLine(technicalSkills)}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {hasLanguages && (
          <section className="cv-section">
            {heading("Languages")}
            <div>
              {data.languages.map((lang) => (
                <div key={lang.id} style={bodyText}>
                  <span style={{ fontWeight: 700, color: SLATE_800 }}>
                    {lang.name.trim()}
                  </span>
                  {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                </div>
              ))}
            </div>
          </section>
        )}

        {hasCertifications && (
          <section className="cv-section">
            {heading("Certifications")}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {data.certifications.map((cert) => (
                <div key={cert.id} style={bodyText}>
                  <span style={{ fontWeight: 700, color: SLATE_800 }}>
                    {cert.name.trim()}
                  </span>
                  <span style={{ color: SLATE_500 }}>
                    {cert.issuer?.trim() ? ` | ${cert.issuer.trim()}` : ""}
                    {cert.date?.trim() ? ` | ${cert.date.trim()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasEducation && (
          <section className="cv-section">
            {heading("Education")}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {education.map((edu) => {
                const school = edu.school?.trim();
                const notes = edu.notes?.trim();
                const attestingBody = edu.attestingBody?.trim();
                return (
                  <div key={edu.id} className="avoid-break [break-inside:avoid]">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <span style={{ ...entryTitle, flex: 1, minWidth: 0 }}>
                        {bannerEducationTitle(edu)}
                        {school ? (
                          <span style={{ fontWeight: 400, color: SLATE_700 }}>
                            {` | ${school}`}
                          </span>
                        ) : null}
                      </span>
                      <span style={entryDate}>
                        {formatDateRange(edu.startDate, edu.endDate)}
                      </span>
                    </div>
                    {notes && (
                      <div style={{ ...subLine, color: SLATE_500, marginTop: "1px" }}>
                        {notes}
                      </div>
                    )}
                    {edu.attested && attestingBody && (
                      <div style={{ ...subLine, marginTop: "1px", fontWeight: 500 }}>
                        {`Attested — ${attestingBody}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasProjects && (
          <section className="cv-section">
            {heading("Projects")}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {projects.map((project) => {
                const showLink = shouldShowProjectLink(project.link);
                return (
                  <div key={project.id} className="avoid-break [break-inside:avoid]">
                    <div style={entryTitle}>{project.name?.trim() || "Project"}</div>
                    {showLink && project.link ? (
                      <div style={{ ...subLine, marginTop: "1px", overflowWrap: "anywhere" as const }}>
                        <a
                          href={normalizeHref(project.link)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: SLATE_600, textDecoration: "underline" }}
                        >
                          {shortenDisplayUrl(project.link)}
                        </a>
                      </div>
                    ) : null}
                    <Bullets bullets={project.bullets ?? []} />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
