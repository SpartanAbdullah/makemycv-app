import type { CvData, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { getFullName } from "./utils";
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

// ── Section Heading ───────────────────────────────────────────────────────────

const SectionHeading = ({
  children,
  accent = "#1B2A4A",
}: {
  children: string;
  accent?: string;
}) => (
  <div style={{ marginTop: "16px", marginBottom: "6px" }}>
    <h2
      style={{
        fontSize: "9.5px",
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: accent,
        textTransform: "uppercase" as const,
        paddingBottom: "3px",
        borderBottom: "1px solid #CBD5E1",
        margin: 0,
      }}
    >
      {children}
    </h2>
  </div>
);

// ── Executive Split Header Template ──────────────────────────────────────────

export const ExecSplitTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#1B2A4A");
  const { onAccent, onAccentMuted } = theme;

  const contactItems = [
    data.personal.email?.trim()
      ? {
          text: data.personal.email.trim(),
          href: `mailto:${data.personal.email.trim()}`,
        }
      : null,
    data.personal.phone?.trim()
      ? {
          text: data.personal.phone.trim(),
          href: `tel:${data.personal.phone.trim()}`,
        }
      : null,
    data.personal.location?.trim()
      ? { text: data.personal.location.trim() }
      : null,
    data.personal.linkedin?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.linkedin),
          href: normalizeHref(data.personal.linkedin),
        }
      : null,
    data.personal.website?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.website),
          href: normalizeHref(data.personal.website),
        }
      : null,
    data.personal.dateOfBirth?.trim()
      ? { text: `DOB: ${data.personal.dateOfBirth.trim()}` }
      : null,
  ].filter(Boolean) as Array<{ text: string; href?: string }>;

  const essentialChips = getEssentialChips(data.personal);

  const hasSummary = Boolean(data.personal.summary?.trim());
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;

  const showPhoto = Boolean(
    data.personal.photo && data.personal.showPhoto && theme.photoVisible,
  );

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: theme.fontFamily,
        fontSize: "11px",
        color: "#1a1a1a",
        lineHeight: 1.5,
        boxSizing: "border-box" as const,
      }}
    >
      {/* ── Dark Header ── */}
      <div
        style={{
          backgroundColor: theme.accent,
          padding: "28px 32px 24px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: onAccent,
              letterSpacing: "-0.3px",
              lineHeight: 1.15,
            }}
          >
            {name}
          </div>
          {headline && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 400,
                color: onAccentMuted,
                marginTop: "4px",
                lineHeight: 1.4,
              }}
            >
              {headline}
            </div>
          )}
          {contactItems.length > 0 && (
            <div
              style={{
                fontSize: "10px",
                color: onAccentMuted,
                marginTop: "10px",
                lineHeight: 1.6,
              }}
            >
              {contactItems.map((item, i) => (
                <span key={`${item.text}-${i}`}>
                  {i > 0 ? "  \u00B7  " : ""}
                  {item.href ? (
                    <a
                      href={item.href}
                      style={{
                        color: onAccentMuted,
                        textDecoration: "underline",
                      }}
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
          {essentialChips.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginTop: "8px",
              }}
            >
              {essentialChips.map((chip) => (
                <span
                  key={chip.label}
                  style={{
                    fontSize: "9px",
                    color: onAccentMuted,
                    background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: "999px",
                    padding: "2px 8px",
                    lineHeight: 1.5,
                    letterSpacing: "0.02em",
                  }}
                >
                  <span style={{ color: onAccentMuted, marginRight: 4, fontWeight: 700 }}>
                    {chip.label}
                  </span>
                  {chip.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {showPhoto && data.personal.photo && (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius:
                data.settings.photoShape === "square" ? 8 : "50%",
              overflow: "hidden",
              flexShrink: 0,
              marginLeft: "20px",
              border: "2.5px solid rgba(255,255,255,0.25)",
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
      </div>

      {/* ── Body: 2-column layout ── */}
      <div
        style={{
          display: "flex",
          padding: "20px 32px 40px 32px",
          gap: "28px",
        }}
      >
        {/* Left Column — Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Experience */}
          {hasExperience && (
            <section>
              <SectionHeading accent={theme.accentText}>Experience</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
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
                          fontWeight: 700,
                          fontSize: "11.5px",
                          color: "#111827",
                        }}
                      >
                        {role.role?.trim() || "Role"}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#6B7280",
                          flexShrink: 0,
                          paddingLeft: "8px",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {formatDateRange(
                          role.startDate,
                          role.endDate,
                          role.isCurrent,
                        )}
                      </span>
                    </div>
                    {(role.company || role.location) && (
                      <div
                        style={{
                          fontSize: "10.5px",
                          color: "#475569",
                          marginTop: "1px",
                          marginBottom: "3px",
                        }}
                      >
                        {role.company?.trim() || ""}
                        {role.company?.trim() && role.location?.trim()
                          ? " \u00B7 "
                          : ""}
                        {role.location?.trim() || ""}
                      </div>
                    )}
                    {role.bullets.filter(Boolean).length > 0 && (
                      <ul
                        style={{
                          listStyleType: "disc",
                          paddingLeft: "14px",
                          margin: 0,
                        }}
                      >
                        {role.bullets
                          .filter(Boolean)
                          .map((bullet, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: "10.5px",
                                color: "#374151",
                                lineHeight: 1.5,
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
              <SectionHeading accent={theme.accentText}>Education</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
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
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#111827",
                        }}
                      >
                        {edu.degree?.trim() || "Degree"}
                        {edu.field?.trim() ? ` in ${edu.field.trim()}` : ""}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#6B7280",
                          flexShrink: 0,
                          paddingLeft: "8px",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {formatDateRange(edu.startDate, edu.endDate)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        color: "#475569",
                        marginTop: "1px",
                      }}
                    >
                      {edu.school?.trim() || ""}
                      {edu.attested && (
                        <span
                          style={{
                            fontSize: "9px",
                            color: "#15803d",
                            marginLeft: "8px",
                          }}
                        >
                          {edu.attestingBody?.trim()
                            ? `\u2713 Attested \u2014 ${edu.attestingBody.trim()}`
                            : "(Attested)"}
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
              <SectionHeading accent={theme.accentText}>Projects</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
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
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#111827",
                        }}
                      >
                        {project.name?.trim() || "Project"}
                      </div>
                      {showLink && (
                        <div
                          style={{
                            fontSize: "9.5px",
                            color: "#6B7280",
                            marginTop: "1px",
                          }}
                        >
                          (
                          <a
                            href={normalizeHref(project.link)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "#6B7280",
                              textDecoration: "underline",
                            }}
                          >
                            {project.link!.trim()}
                          </a>
                          )
                        </div>
                      )}
                      {bullets.length > 0 && (
                        <ul
                          style={{
                            listStyleType: "disc",
                            paddingLeft: "14px",
                            margin: "2px 0 0 0",
                          }}
                        >
                          {bullets.map((bullet, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: "10.5px",
                                color: "#374151",
                                lineHeight: 1.5,
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

        {/* Right Column — Summary, Skills, Languages, Certifications */}
        <div style={{ width: "200px", flexShrink: 0 }}>
          {/* Summary */}
          {hasSummary && (
            <section>
              <SectionHeading accent={theme.accentText}>Summary</SectionHeading>
              <p
                style={{
                  fontSize: "10.5px",
                  color: "#374151",
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {data.personal.summary!.trim()}
              </p>
            </section>
          )}

          {/* Skills */}
          {hasSkills && (
            <section>
              <SectionHeading accent={theme.accentText}>Skills</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap" as const,
                  gap: "4px",
                }}
              >
                {data.skills.map((skill) => (
                  <span
                    key={skill.id}
                    style={{
                      display: "inline-flex",
                      fontSize: "9.5px",
                      color: theme.accentText,
                      border: "1px solid #CBD5E1",
                      borderRadius: "3px",
                      padding: "1px 6px",
                      backgroundColor: "#F1F5F9",
                      lineHeight: 1.5,
                    }}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Languages */}
          {hasLanguages && (
            <section>
              <SectionHeading accent={theme.accentText}>Languages</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {data.languages.map((lang) => (
                  <div
                    key={lang.id}
                    style={{
                      fontSize: "10.5px",
                      color: "#374151",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{lang.name}</span>
                    {lang.level
                      ? ` — ${formatLanguageLevel(lang.level)}`
                      : ""}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certifications */}
          {hasCertifications && (
            <section>
              <SectionHeading accent={theme.accentText}>Certifications</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {data.certifications.map((cert) => (
                  <div key={cert.id}>
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 600,
                        color: "#111827",
                        lineHeight: 1.4,
                      }}
                    >
                      {cert.name}
                    </div>
                    {(cert.issuer || cert.date) && (
                      <div
                        style={{
                          fontSize: "9.5px",
                          color: "#6B7280",
                          lineHeight: 1.4,
                        }}
                      >
                        {[cert.issuer?.trim(), cert.date?.trim()]
                          .filter(Boolean)
                          .join(" \u00B7 ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

