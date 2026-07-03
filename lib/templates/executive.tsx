import type React from "react";
import type { CvData, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { getEssentialChips } from "../utils/essentials";
import { resolveTheme } from "./theme";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

const SidebarLabel = ({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) => (
  <div
    style={{
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.1em",
      color,
      marginBottom: "8px",
      textTransform: "uppercase" as const,
    }}
  >
    {children}
  </div>
);

const RightHeading = ({
  children,
  isFirst = false,
  accent = "#1E2A4A",
}: {
  children: React.ReactNode;
  isFirst?: boolean;
  accent?: string;
}) => (
  <div
    style={{
      marginTop: isFirst ? 0 : "20px",
      borderBottom: `1px solid ${accent}`,
      paddingBottom: "3px",
      marginBottom: "8px",
    }}
  >
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: accent,
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </span>
  </div>
);

// ── Executive Template ────────────────────────────────────────────────────────

export const ExecutiveTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const firstName = data.personal.firstName?.trim() || "First";
  const lastName = data.personal.lastName?.trim() || "Last";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#1E2A4A");
  const { onAccent, onAccentMuted } = theme;

  const contactItems = [
    data.personal.email?.trim()
      ? {
          icon: "✉️",
          text: data.personal.email.trim(),
          href: `mailto:${data.personal.email.trim()}`,
        }
      : null,
    data.personal.phone?.trim()
      ? {
          icon: "📞",
          text: data.personal.phone.trim(),
          href: `tel:${data.personal.phone.trim()}`,
        }
      : null,
    data.personal.location?.trim()
      ? { icon: "📍", text: data.personal.location.trim() }
      : null,
    data.personal.linkedin?.trim()
      ? {
          icon: "💼",
          text: shortenDisplayUrl(data.personal.linkedin),
          href: normalizeHref(data.personal.linkedin),
        }
      : null,
    data.personal.website?.trim()
      ? {
          icon: "🌐",
          text: shortenDisplayUrl(data.personal.website),
          href: normalizeHref(data.personal.website),
        }
      : null,
    data.personal.dateOfBirth?.trim()
      ? { icon: "🎂", text: `DOB: ${data.personal.dateOfBirth.trim()}` }
      : null,
  ].filter(Boolean) as Array<{ icon: string; text: string; href?: string }>;

  const essentialChips = getEssentialChips(data.personal);

  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;
  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );
  const photoSize = 88;

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
      {/* ── Left Sidebar ── */}
      <div
        style={{
          width: "200px",
          flexShrink: 0,
          backgroundColor: theme.accent,
          minHeight: "100%",
          padding: "28px 20px",
          overflow: "hidden",
          boxSizing: "border-box" as const,
        }}
      >
        {/* Photo */}
        {showPhoto && data.personal.photo && (
          <div
            style={{
              width: photoSize,
              height: photoSize,
              borderRadius:
                data.settings.photoShape === "square" ? 8 : "50%",
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.2)",
              marginBottom: "16px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.personal.photo}
              alt={`${firstName} ${lastName}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        )}

        {/* Name block */}
        <div
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.15)",
            paddingBottom: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              lineHeight: 1.15,
              color: onAccent,
            }}
          >
            {firstName}
            <br />
            {lastName}
          </div>
          {headline && (
            <div
              style={{
                fontSize: "12px",
                fontWeight: 400,
                color: onAccentMuted,
                marginTop: "6px",
                lineHeight: 1.4,
              }}
            >
              {headline}
            </div>
          )}
        </div>

        {/* Contact */}
        {contactItems.length > 0 && (
          <div>
            <SidebarLabel color={onAccentMuted}>Contact</SidebarLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {contactItems.map((item, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}
                >
                  <span
                    style={{ fontSize: "10px", flexShrink: 0, lineHeight: 1.6 }}
                  >
                    {item.icon}
                  </span>
                  {item.href ? (
                    <a
                      href={item.href}
                      style={{
                        fontSize: "10px",
                        color: onAccentMuted,
                        lineHeight: 1.6,
                        wordBreak: "break-all" as const,
                        textDecoration: "underline",
                      }}
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span
                      style={{
                        fontSize: "10px",
                        color: onAccentMuted,
                        lineHeight: 1.6,
                      }}
                    >
                      {item.text}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal */}
        {essentialChips.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <SidebarLabel color={onAccentMuted}>Personal</SidebarLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {essentialChips.map((chip) => (
                <div
                  key={chip.label}
                  style={{
                    fontSize: "10px",
                    color: onAccentMuted,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      color: onAccentMuted,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {chip.label}:
                  </span>{" "}
                  {chip.value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {hasSkills && (
          <div style={{ marginTop: "20px" }}>
            <SidebarLabel color={onAccentMuted}>Skills</SidebarLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {data.skills.map((skill) => (
                <div
                  key={skill.id}
                  style={{ display: "flex", alignItems: "baseline", gap: "6px" }}
                >
                  <span
                    style={{
                      color: onAccentMuted,
                      fontSize: "12px",
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ·
                  </span>
                  <span
                    style={{ fontSize: "10px", color: onAccentMuted, lineHeight: 1.7 }}
                  >
                    {skill.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {hasLanguages && (
          <div style={{ marginTop: "20px" }}>
            <SidebarLabel color={onAccentMuted}>Languages</SidebarLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {data.languages.map((lang) => (
                <div
                  key={lang.id}
                  style={{ fontSize: "10px", color: onAccentMuted, lineHeight: 1.7 }}
                >
                  <span style={{ fontWeight: 600 }}>{lang.name}</span>
                  {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <div style={{ marginTop: "20px" }}>
            <SidebarLabel color={onAccentMuted}>Certifications</SidebarLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {data.certifications.map((cert) => (
                <div key={cert.id}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: onAccent,
                      lineHeight: 1.4,
                    }}
                  >
                    {cert.name}
                  </div>
                  <div
                    style={{
                      fontSize: "9px",
                      color: onAccentMuted,
                      lineHeight: 1.4,
                    }}
                  >
                    {cert.issuer}
                    {cert.date ? ` · ${cert.date}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Column ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: "#ffffff",
          padding: "28px 28px 28px 28px",
          boxSizing: "border-box" as const,
        }}
      >
        {/* Summary */}
        {hasSummary && (
          <section>
            <RightHeading isFirst accent={theme.accentText}>Summary</RightHeading>
            <p
              style={{
                fontSize: "11px",
                color: "#374151",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {data.personal.summary!.trim()}
            </p>
          </section>
        )}

        {/* Experience */}
        {hasExperience && (
          <section>
            <RightHeading isFirst={!hasSummary} accent={theme.accentText}>Experience</RightHeading>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {experience.map((role) => (
                <div
                  key={role.id}
                  style={{
                    pageBreakInside: "avoid" as const,
                    breakInside: "avoid" as const,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {role.role?.trim() || "Role"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        whiteSpace: "nowrap" as const,
                        marginLeft: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                    </span>
                  </div>
                  {(role.company || role.location) && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#374151",
                        marginTop: "1px",
                      }}
                    >
                      {role.company?.trim() || ""}
                      {role.company?.trim() && role.location?.trim() ? " | " : ""}
                      {role.location?.trim() || ""}
                    </div>
                  )}
                  {role.bullets.filter(Boolean).length > 0 && (
                    <ul
                      style={{
                        margin: "4px 0 0 0",
                        paddingLeft: "12px",
                        listStyleType: "disc",
                      }}
                    >
                      {role.bullets
                        .filter(Boolean)
                        .map((bullet, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: "11px",
                              color: "#374151",
                              lineHeight: 1.55,
                            }}
                          >
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

        {/* Education */}
        {hasEducation && (
          <section>
            <RightHeading isFirst={!hasSummary && !hasExperience} accent={theme.accentText}>
              Education
            </RightHeading>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {education.map((edu) => (
                <div
                  key={edu.id}
                  style={{
                    pageBreakInside: "avoid" as const,
                    breakInside: "avoid" as const,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {edu.degree?.trim() || "Degree"}
                      {edu.field?.trim() ? ` — ${edu.field.trim()}` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        whiteSpace: "nowrap" as const,
                        marginLeft: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "1px",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#374151" }}>
                      {edu.school?.trim() || ""}
                    </span>
                    {edu.attested && (
                      <span
                        style={{
                          fontSize: "8px",
                          color: theme.accentText,
                          border: `1px solid ${theme.accentText}`,
                          borderRadius: "3px",
                          padding: "1px 4px",
                          lineHeight: 1.4,
                          flexShrink: 0,
                        }}
                      >
                        {edu.attestingBody?.trim()
                          ? `\u2713 ATTESTED — ${edu.attestingBody.trim()}`
                          : "ATTESTED"}
                      </span>
                    )}
                  </div>
                  {edu.notes?.trim() && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        marginTop: "1px",
                      }}
                    >
                      {edu.notes.trim()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {hasProjects && (
          <section>
            <RightHeading
              isFirst={!hasSummary && !hasExperience && !hasEducation}
              accent={theme.accentText}
            >
              Projects
            </RightHeading>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {projects.map((project) => {
                const bullets = (project.bullets ?? []).filter(Boolean);
                const showLink = shouldShowProjectLink(project.link);
                return (
                  <div
                    key={project.id}
                    style={{
                      pageBreakInside: "avoid" as const,
                      breakInside: "avoid" as const,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {project.name?.trim() || "Project"}
                    </div>
                    {showLink && (
                      <a
                        href={normalizeHref(project.link)}
                        style={{
                          fontSize: "10px",
                          color: theme.accentText,
                          textDecoration: "none",
                          wordBreak: "break-all" as const,
                        }}
                      >
                        {project.link!.trim()}
                      </a>
                    )}
                    {bullets.length > 0 && (
                      <ul
                        style={{
                          margin: "3px 0 0 0",
                          paddingLeft: "12px",
                          listStyleType: "disc",
                        }}
                      >
                        {bullets.map((bullet, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: "11px",
                              color: "#374151",
                              lineHeight: 1.55,
                            }}
                          >
                            {bullet}
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
