import type React from "react";
import type { CvData, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { getEssentialChips } from "../utils/essentials";
import { resolveTheme } from "./theme";

/**
 * "Sandstone" — warm beige left sidebar with a profile photo, inspired by the
 * founder's cvtoolspro "Rotterdam" reference. The sidebar leads with a PERSONAL
 * DETAILS block (nationality / visa / DOB / availability) — exactly the fields
 * UAE recruiters screen first — plus contact and languages. The main column
 * opens with "About Me" (summary) then Experience → Education → Skills →
 * Certifications → Projects. Distinct from Onyx (dark, summary-in-sidebar).
 */

const SIDEBAR_BG = "#ECE3D2";
const SIDE_TEXT = "#44403C";
const SIDE_MUTED = "#78716C";
const NAME_COLOR = "#292524";

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

const SideLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.14em",
      color: SIDE_MUTED,
      marginBottom: "7px",
      textTransform: "uppercase" as const,
    }}
  >
    {children}
  </div>
);

const MainHeading = ({
  children,
  accent,
  isFirst = false,
}: {
  children: React.ReactNode;
  accent: string;
  isFirst?: boolean;
}) => (
  <div
    style={{
      marginTop: isFirst ? 0 : "18px",
      borderBottom: `1.5px solid ${accent}`,
      paddingBottom: "3px",
      marginBottom: "9px",
    }}
  >
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: NAME_COLOR,
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </span>
  </div>
);

export const SandstoneTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const firstName = data.personal.firstName?.trim() || "First";
  const lastName = data.personal.lastName?.trim() || "Last";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#8A6D3B");
  const accent = theme.accent;

  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const essentialChips = getEssentialChips(data.personal);

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasProjects = projects.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  // Personal-details block — the UAE recruiter-screen fields. Reuses the
  // essential chips (visa / availability / driving licence / nationality) and
  // layers DOB when present.
  const personalDetails = [
    ...essentialChips.map((c) => ({ label: c.label, value: c.value })),
    data.personal.dateOfBirth?.trim()
      ? { label: "Date of birth", value: data.personal.dateOfBirth.trim() }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const contactItems = [
    data.personal.email?.trim()
      ? { text: data.personal.email.trim(), href: `mailto:${data.personal.email.trim()}` }
      : null,
    data.personal.phone?.trim()
      ? { text: data.personal.phone.trim(), href: `tel:${data.personal.phone.trim()}` }
      : null,
    data.personal.location?.trim() ? { text: data.personal.location.trim() } : null,
    data.personal.linkedin?.trim()
      ? { text: shortenDisplayUrl(data.personal.linkedin), href: normalizeHref(data.personal.linkedin) }
      : null,
    data.personal.website?.trim()
      ? { text: shortenDisplayUrl(data.personal.website), href: normalizeHref(data.personal.website) }
      : null,
  ].filter(Boolean) as Array<{ text: string; href?: string }>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: theme.fontFamily,
        fontSize: "11px",
      }}
    >
      {/* ── Warm sidebar ── */}
      <div
        style={{
          width: "230px",
          flexShrink: 0,
          backgroundColor: SIDEBAR_BG,
          padding: "30px 22px",
          boxSizing: "border-box" as const,
          color: SIDE_TEXT,
        }}
      >
        {showPhoto && data.personal.photo && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: data.settings.photoShape === "square" ? 10 : "50%",
                overflow: "hidden",
                border: "3px solid rgba(0,0,0,0.08)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.personal.photo}
                alt={`${firstName} ${lastName}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: "20px", fontWeight: 700, color: NAME_COLOR, textAlign: "center", lineHeight: 1.2 }}>
          {firstName} {lastName}
        </div>
        {headline && (
          <div
            style={{
              fontSize: "11px",
              color: accent,
              fontWeight: 600,
              marginTop: "4px",
              textAlign: "center",
              lineHeight: 1.4,
              paddingBottom: "14px",
              borderBottom: "1px solid rgba(0,0,0,0.10)",
              marginBottom: "14px",
            }}
          >
            {headline}
          </div>
        )}

        {personalDetails.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <SideLabel>Personal Details</SideLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {personalDetails.map((d) => (
                <div key={d.label} style={{ fontSize: "10px", lineHeight: 1.4 }}>
                  <div style={{ color: SIDE_MUTED, fontWeight: 700, fontSize: "8.5px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {d.label}
                  </div>
                  <div style={{ color: SIDE_TEXT }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contactItems.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <SideLabel>Contact</SideLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {contactItems.map((item, i) =>
                item.href ? (
                  <a
                    key={i}
                    href={item.href}
                    style={{ fontSize: "10px", color: SIDE_TEXT, lineHeight: 1.5, wordBreak: "break-all" as const, textDecoration: "none" }}
                  >
                    {item.text}
                  </a>
                ) : (
                  <span key={i} style={{ fontSize: "10px", color: SIDE_TEXT, lineHeight: 1.5 }}>
                    {item.text}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {hasLanguages && (
          <div>
            <SideLabel>Languages</SideLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {data.languages.map((lang) => (
                <div key={lang.id} style={{ fontSize: "10px", color: SIDE_TEXT, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: NAME_COLOR }}>{lang.name}</span>
                  {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main column ── */}
      <div style={{ flex: 1, minWidth: 0, padding: "30px 30px", boxSizing: "border-box" as const }}>
        {hasSummary && (
          <section>
            <MainHeading accent={accent} isFirst>
              About Me
            </MainHeading>
            <p style={{ fontSize: "11px", color: "#44403C", lineHeight: 1.6, margin: 0 }}>
              {data.personal.summary!.trim()}
            </p>
          </section>
        )}

        {hasExperience && (
          <section>
            <MainHeading accent={accent} isFirst={!hasSummary}>
              Work Experience
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {experience.map((role) => (
                <div key={role.id} style={{ pageBreakInside: "avoid" as const, breakInside: "avoid" as const }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: NAME_COLOR }}>
                      {role.role?.trim() || "Role"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#78716C", whiteSpace: "nowrap" as const, marginLeft: "8px", flexShrink: 0 }}>
                      {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                    </span>
                  </div>
                  {(role.company || role.location) && (
                    <div style={{ fontSize: "11px", color: accent, fontWeight: 600, marginTop: "1px" }}>
                      {role.company?.trim() || ""}
                      {role.company?.trim() && role.location?.trim() ? " · " : ""}
                      <span style={{ color: "#78716C", fontWeight: 400 }}>{role.location?.trim() || ""}</span>
                    </div>
                  )}
                  {role.bullets.filter(Boolean).length > 0 && (
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: "14px", listStyleType: "disc" }}>
                      {role.bullets.filter(Boolean).map((bullet, i) => (
                        <li key={i} style={{ fontSize: "11px", color: "#44403C", lineHeight: 1.55 }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {hasEducation && (
          <section>
            <MainHeading accent={accent} isFirst={!hasSummary && !hasExperience}>
              Education
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {education.map((edu) => (
                <div key={edu.id} style={{ pageBreakInside: "avoid" as const, breakInside: "avoid" as const }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 700, color: NAME_COLOR }}>
                      {edu.degree?.trim() || "Degree"}
                      {edu.field?.trim() ? ` — ${edu.field.trim()}` : ""}
                    </span>
                    <span style={{ fontSize: "10px", color: "#78716C", whiteSpace: "nowrap" as const, marginLeft: "8px", flexShrink: 0 }}>
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </span>
                  </div>
                  {edu.school?.trim() && (
                    <div style={{ fontSize: "11px", color: accent, fontWeight: 600, marginTop: "1px" }}>
                      {edu.school.trim()}
                    </div>
                  )}
                  {edu.attested && edu.attestingBody?.trim() && (
                    <div style={{ fontSize: "9.5px", color: "#15803d", marginTop: "1px" }}>
                      {"✓"} Attested — {edu.attestingBody.trim()}
                    </div>
                  )}
                  {edu.notes?.trim() && (
                    <div style={{ fontSize: "10px", color: "#78716C", marginTop: "1px" }}>{edu.notes.trim()}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {hasSkills && (
          <section>
            <MainHeading accent={accent} isFirst={!hasSummary && !hasExperience && !hasEducation}>
              Skills
            </MainHeading>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.skills.map((skill) => (
                <span
                  key={skill.id}
                  style={{
                    fontSize: "10.5px",
                    color: "#44403C",
                    background: "#F5F0E6",
                    border: "1px solid #E2D8C4",
                    borderRadius: "4px",
                    padding: "2px 9px",
                  }}
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {hasCertifications && (
          <section>
            <MainHeading accent={accent} isFirst={!hasSummary && !hasExperience && !hasEducation && !hasSkills}>
              Certifications
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {data.certifications.map((cert) => (
                <div key={cert.id} style={{ fontSize: "11px", color: "#44403C", lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: NAME_COLOR }}>{cert.name.trim()}</span>
                  <span style={{ color: "#78716C" }}>
                    {cert.issuer ? ` | ${cert.issuer.trim()}` : ""}
                    {cert.date ? ` | ${cert.date.trim()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasProjects && (
          <section>
            <MainHeading
              accent={accent}
              isFirst={!hasSummary && !hasExperience && !hasEducation && !hasSkills && !hasCertifications}
            >
              Projects
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {projects.map((project) => {
                const bullets = (project.bullets ?? []).filter(Boolean);
                return (
                  <div key={project.id} style={{ pageBreakInside: "avoid" as const, breakInside: "avoid" as const }}>
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: NAME_COLOR }}>
                      {project.name?.trim() || "Project"}
                      {shouldShowProjectLink(project.link) && (
                        <span style={{ marginLeft: "6px", fontSize: "10px", fontWeight: 400, color: accent }}>
                          {shortenDisplayUrl(project.link!.trim())}
                        </span>
                      )}
                    </div>
                    {bullets.length > 0 && (
                      <ul style={{ margin: "3px 0 0 0", paddingLeft: "14px", listStyleType: "disc" }}>
                        {bullets.map((b, i) => (
                          <li key={i} style={{ fontSize: "11px", color: "#44403C", lineHeight: 1.55 }}>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
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
