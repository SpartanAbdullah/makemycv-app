import type { CvData, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatRange, getFullName } from "./utils";

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

const SectionHeading = ({ children }: { children: string }) => (
  <div style={{ marginTop: "16px", marginBottom: "6px" }}>
    <h2
      style={{
        fontSize: "9.5px",
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "#1B2A4A",
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

  const contactParts: string[] = [
    data.personal.email?.trim() || "",
    data.personal.phone?.trim() || "",
    data.personal.location?.trim() || "",
    data.personal.linkedin?.trim()
      ? shortenDisplayUrl(data.personal.linkedin)
      : "",
    data.personal.website?.trim()
      ? shortenDisplayUrl(data.personal.website)
      : "",
    data.personal.nationality?.trim() || "",
    data.personal.drivingLicense?.trim()
      ? `DL: ${data.personal.drivingLicense.trim()}`
      : "",
    data.personal.dateOfBirth?.trim()
      ? `DOB: ${data.personal.dateOfBirth.trim()}`
      : "",
  ].filter(Boolean);

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = data.projects.length > 0;

  const showPhoto = Boolean(data.personal.photo && data.personal.showPhoto);

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: "inherit",
        fontSize: "11px",
        color: "#1a1a1a",
        lineHeight: 1.5,
        boxSizing: "border-box" as const,
      }}
    >
      {/* ── Dark Header ── */}
      <div
        style={{
          backgroundColor: "#1B2A4A",
          padding: "28px 48px 24px 48px",
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
              color: "#ffffff",
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
                color: "#94A3B8",
                marginTop: "4px",
                lineHeight: 1.4,
              }}
            >
              {headline}
            </div>
          )}
          {contactParts.length > 0 && (
            <div
              style={{
                fontSize: "10px",
                color: "#CBD5E1",
                marginTop: "10px",
                lineHeight: 1.6,
              }}
            >
              {contactParts.join("  \u00B7  ")}
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
          padding: "20px 48px 40px 48px",
          gap: "28px",
        }}
      >
        {/* Left Column — Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Experience */}
          {hasExperience && (
            <section>
              <SectionHeading>Experience</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {data.experience.map((role) => (
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
                        {formatRange(
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
              <SectionHeading>Education</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {data.education.map((edu) => (
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
                        {formatRange(edu.startDate, edu.endDate)}
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
              <SectionHeading>Projects</SectionHeading>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {data.projects.map((project) => {
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
                          ({project.link!.trim()})
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
              <SectionHeading>Summary</SectionHeading>
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
              <SectionHeading>Skills</SectionHeading>
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
                      color: "#1B2A4A",
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
              <SectionHeading>Languages</SectionHeading>
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
                    {lang.name}
                    {lang.level
                      ? ` (${formatLanguageLevel(lang.level)})`
                      : ""}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certifications */}
          {hasCertifications && (
            <section>
              <SectionHeading>Certifications</SectionHeading>
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
