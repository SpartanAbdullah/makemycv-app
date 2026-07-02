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

// ── Sub-components ───────────────────────────────────────────────────────────

const SidebarHeading = ({ children }: { children: string }) => (
  <div
    style={{
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.1em",
      color: "rgba(255,255,255,0.5)",
      textTransform: "uppercase" as const,
      marginBottom: "6px",
      marginTop: "18px",
    }}
  >
    {children}
  </div>
);

const MainHeading = ({ children }: { children: string }) => (
  <div style={{ marginTop: "18px", marginBottom: "6px" }}>
    <h2
      style={{
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "#1E293B",
        textTransform: "uppercase" as const,
        paddingBottom: "3px",
        borderBottom: "1px solid #E2E8F0",
        margin: 0,
      }}
    >
      {children}
    </h2>
  </div>
);

// ── Corporate Sidebar Template ───────────────────────────────────────────────

export const CorpSidebarTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#0F172A");

  const contactItems: Array<{ label: string; value: string; href?: string }> =
    [];
  if (data.personal.email?.trim())
    contactItems.push({
      label: "Email",
      value: data.personal.email.trim(),
      href: `mailto:${data.personal.email.trim()}`,
    });
  if (data.personal.phone?.trim())
    contactItems.push({
      label: "Phone",
      value: data.personal.phone.trim(),
      href: `tel:${data.personal.phone.trim()}`,
    });
  if (data.personal.location?.trim())
    contactItems.push({
      label: "Location",
      value: data.personal.location.trim(),
    });
  if (data.personal.linkedin?.trim())
    contactItems.push({
      label: "LinkedIn",
      value: shortenDisplayUrl(data.personal.linkedin),
      href: normalizeHref(data.personal.linkedin),
    });
  if (data.personal.website?.trim())
    contactItems.push({
      label: "Web",
      value: shortenDisplayUrl(data.personal.website),
      href: normalizeHref(data.personal.website),
    });
  if (data.personal.dateOfBirth?.trim())
    contactItems.push({
      label: "DOB",
      value: data.personal.dateOfBirth.trim(),
    });

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
        display: "flex",
        flexDirection: "row",
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: theme.fontFamily,
        fontSize: "11px",
      }}
    >
      {/* ── Main Content (Left) ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "36px 28px 36px 32px",
          boxSizing: "border-box" as const,
        }}
      >
        {/* Name + headline in main area */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.3px",
              lineHeight: 1.15,
            }}
          >
            {name}
          </div>
          {headline && (
            <div
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#64748B",
                marginTop: "4px",
              }}
            >
              {headline}
            </div>
          )}
          <div
            style={{
              borderBottom: `2px solid ${theme.accent}`,
              marginTop: "10px",
            }}
          />
        </div>

        {/* Summary */}
        {hasSummary && (
          <section>
            <MainHeading>Summary</MainHeading>
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
            <MainHeading>Experience</MainHeading>
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
                        color: "#0F172A",
                      }}
                    >
                      {role.role?.trim() || "Role"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#64748B",
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
                        ? " | "
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
            <MainHeading>Education</MainHeading>
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
                        color: "#0F172A",
                      }}
                    >
                      {edu.degree?.trim() || "Degree"}
                      {edu.field?.trim() ? ` \u2014 ${edu.field.trim()}` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#64748B",
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
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "1px",
                    }}
                  >
                    <span
                      style={{ fontSize: "10.5px", color: "#475569" }}
                    >
                      {edu.school?.trim() || ""}
                    </span>
                    {edu.attested && (
                      <span
                        style={{
                          fontSize: "8px",
                          color: "#15803d",
                          border: "1px solid #BBF7D0",
                          borderRadius: "3px",
                          padding: "1px 4px",
                          lineHeight: 1.4,
                          flexShrink: 0,
                        }}
                      >
                        {edu.attestingBody?.trim()
                          ? `\u2713 ${edu.attestingBody.trim()}`
                          : "\u2713 Attested"}
                      </span>
                    )}
                  </div>
                  {edu.notes?.trim() && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#64748B",
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
            <MainHeading>Projects</MainHeading>
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
                        color: "#0F172A",
                      }}
                    >
                      {project.name?.trim() || "Project"}
                    </div>
                    {showLink && (
                      <div
                        style={{
                          fontSize: "9.5px",
                          color: "#64748B",
                          marginTop: "1px",
                        }}
                      >
                        <a
                          href={normalizeHref(project.link)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#64748B",
                            textDecoration: "underline",
                          }}
                        >
                          {project.link!.trim()}
                        </a>
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

      {/* ── Right Sidebar (Dark) ── */}
      <div
        style={{
          width: "220px",
          flexShrink: 0,
          backgroundColor: theme.accent,
          minHeight: "100%",
          padding: "36px 20px",
          boxSizing: "border-box" as const,
        }}
      >
        {/* Photo */}
        {showPhoto && data.personal.photo && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius:
                  data.settings.photoShape === "square" ? 8 : "50%",
                overflow: "hidden",
                border: "2.5px solid rgba(255,255,255,0.15)",
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
          </div>
        )}

        {/* Contact */}
        {contactItems.length > 0 && (
          <div>
            <SidebarHeading>Contact</SidebarHeading>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {contactItems.map((item, i) => (
                <div key={i}>
                  <div
                    style={{
                      fontSize: "8px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.label}
                  </div>
                  {item.href ? (
                    <a
                      href={item.href}
                      style={{
                        fontSize: "10px",
                        color: "#CBD5E1",
                        lineHeight: 1.5,
                        wordBreak: "break-all" as const,
                        textDecoration: "underline",
                      }}
                    >
                      {item.value}
                    </a>
                  ) : (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#CBD5E1",
                        lineHeight: 1.5,
                        wordBreak: "break-all" as const,
                      }}
                    >
                      {item.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal */}
        {essentialChips.length > 0 && (
          <div>
            <SidebarHeading>Personal</SidebarHeading>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {essentialChips.map((chip) => (
                <div key={chip.label}>
                  <div
                    style={{
                      fontSize: "8px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                      lineHeight: 1.4,
                    }}
                  >
                    {chip.label}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#CBD5E1",
                      lineHeight: 1.5,
                    }}
                  >
                    {chip.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {hasSkills && (
          <div>
            <SidebarHeading>Skills</SidebarHeading>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap" as const,
                gap: "3px",
              }}
            >
              {data.skills.map((skill) => (
                <span
                  key={skill.id}
                  style={{
                    fontSize: "9px",
                    color: "#E2E8F0",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: "3px",
                    padding: "2px 6px",
                    lineHeight: 1.5,
                  }}
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {hasLanguages && (
          <div>
            <SidebarHeading>Languages</SidebarHeading>
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
                    fontSize: "10px",
                    color: "#CBD5E1",
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{lang.name}</span>
                  {lang.level
                    ? ` — ${formatLanguageLevel(lang.level)}`
                    : ""}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <div>
            <SidebarHeading>Certifications</SidebarHeading>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              {data.certifications.map((cert) => (
                <div key={cert.id}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#ffffff",
                      lineHeight: 1.4,
                    }}
                  >
                    {cert.name}
                  </div>
                  {(cert.issuer || cert.date) && (
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#94A3B8",
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
          </div>
        )}
      </div>
    </div>
  );
};
