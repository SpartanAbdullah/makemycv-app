import type { CvData, PlanTier } from "../types/cv";
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

const SectionHeading = ({
  children,
  isFirst = false,
}: {
  children: string;
  isFirst?: boolean;
}) => (
  <div style={{ marginTop: isFirst ? 0 : "20px", marginBottom: "8px" }}>
    <h2
      style={{
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "#111827",
        textTransform: "uppercase" as const,
        paddingBottom: "3px",
        borderBottom: "1.5px solid #111827",
        margin: 0,
      }}
    >
      {children}
    </h2>
  </div>
);

// ── ATS Clean Template ────────────────────────────────────────────────────────

export const ATSCleanTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";

  // Contact line — plain text only, no emoji, separated by middle dot
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

  // Determine which section is rendered first (for marginTop: 0)
  const firstSection = hasSummary
    ? "summary"
    : hasExperience
      ? "experience"
      : hasEducation
        ? "education"
        : hasSkills
          ? "skills"
          : hasLanguages
            ? "languages"
            : hasCertifications
              ? "certifications"
              : hasProjects
                ? "projects"
                : null;

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        padding: "48px 52px",
        fontFamily: "inherit",
        fontSize: "11.5px",
        color: "#1a1a1a",
        lineHeight: 1.55,
        boxSizing: "border-box" as const,
      }}
    >
      {/* ── Header ── */}
      <div>
        <div
          style={{
            fontSize: "26px",
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "-0.3px",
            marginBottom: "2px",
            lineHeight: 1.2,
          }}
        >
          {name}
        </div>

        {headline && (
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            {headline}
          </div>
        )}

        {contactParts.length > 0 && (
          <div
            style={{
              fontSize: "10.5px",
              color: "#6B7280",
              marginBottom: "4px",
              lineHeight: 1.55,
            }}
          >
            {contactParts.join(" · ")}
          </div>
        )}

        <div
          style={{
            borderBottom: "2px solid #111827",
            marginTop: "8px",
            marginBottom: "16px",
          }}
        />
      </div>

      {/* ── Summary ── */}
      {hasSummary && (
        <section>
          <SectionHeading isFirst={firstSection === "summary"}>
            Summary
          </SectionHeading>
          <p
            style={{
              fontSize: "11.5px",
              color: "#374151",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {data.personal.summary!.trim()}
          </p>
        </section>
      )}

      {/* ── Experience ── */}
      {hasExperience && (
        <section>
          <SectionHeading isFirst={firstSection === "experience"}>
            Experience
          </SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.experience.map((role) => (
              <div
                key={role.id}
                style={{
                  pageBreakInside: "avoid" as const,
                  breakInside: "avoid" as const,
                }}
              >
                {/* Title row */}
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
                      fontSize: "10.5px",
                      color: "#6B7280",
                      flexShrink: 0,
                      paddingLeft: "8px",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {formatRange(role.startDate, role.endDate, role.isCurrent)}
                  </span>
                </div>

                {/* Company + location */}
                {(role.company || role.location) && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#374151",
                      marginTop: "1px",
                      marginBottom: "4px",
                    }}
                  >
                    {role.company?.trim() || ""}
                    {role.company?.trim() && role.location?.trim() ? " · " : ""}
                    {role.location?.trim() || ""}
                  </div>
                )}

                {/* Bullets */}
                {role.bullets.filter(Boolean).length > 0 && (
                  <ul
                    style={{
                      listStyleType: "disc",
                      paddingLeft: "16px",
                      margin: 0,
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

      {/* ── Education ── */}
      {hasEducation && (
        <section>
          <SectionHeading isFirst={firstSection === "education"}>
            Education
          </SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.education.map((edu) => (
              <div
                key={edu.id}
                style={{
                  pageBreakInside: "avoid" as const,
                  breakInside: "avoid" as const,
                }}
              >
                {/* Degree row */}
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
                    {edu.degree?.trim() || "Degree"}
                    {edu.field?.trim() ? ` in ${edu.field.trim()}` : ""}
                  </span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      color: "#6B7280",
                      flexShrink: 0,
                      paddingLeft: "8px",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {formatRange(edu.startDate, edu.endDate)}
                  </span>
                </div>

                {/* Institution */}
                <div
                  style={{
                    fontSize: "11px",
                    color: "#374151",
                    marginTop: "1px",
                  }}
                >
                  {edu.school?.trim() || ""}
                  {edu.attested && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        marginLeft: "8px",
                      }}
                    >
                      (Attested)
                    </span>
                  )}
                </div>

                {/* Notes */}
                {edu.notes?.trim() && (
                  <div
                    style={{
                      fontSize: "10.5px",
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

      {/* ── Skills ── */}
      {hasSkills && (
        <section>
          <SectionHeading isFirst={firstSection === "skills"}>
            Skills
          </SectionHeading>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap" as const,
              gap: "6px",
            }}
          >
            {data.skills.map((skill) => (
              <span
                key={skill.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "10.5px",
                  color: "#111827",
                  border: "1px solid #D1D5DB",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  backgroundColor: "#F9FAFB",
                  lineHeight: 1.5,
                }}
              >
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Languages ── */}
      {hasLanguages && (
        <section>
          <SectionHeading isFirst={firstSection === "languages"}>
            Languages
          </SectionHeading>
          <p
            style={{
              fontSize: "11px",
              color: "#374151",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {data.languages
              .map((lang) =>
                lang.level
                  ? `${lang.name} (${lang.level})`
                  : lang.name,
              )
              .join(", ")}
          </p>
        </section>
      )}

      {/* ── Certifications ── */}
      {hasCertifications && (
        <section>
          <SectionHeading isFirst={firstSection === "certifications"}>
            Certifications
          </SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {data.certifications.map((cert) => (
              <div
                key={cert.id}
                style={{ fontSize: "11px", color: "#374151", lineHeight: 1.55 }}
              >
                <span style={{ fontWeight: 600 }}>{cert.name}</span>
                {cert.issuer ? ` · ${cert.issuer}` : ""}
                {cert.date ? ` · ${cert.date}` : ""}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Projects ── */}
      {hasProjects && (
        <section>
          <SectionHeading isFirst={firstSection === "projects"}>
            Projects
          </SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                      fontSize: "11.5px",
                      color: "#111827",
                    }}
                  >
                    {project.name?.trim() || "Project"}
                  </div>

                  {/* URL as plain text — no <a> tag for ATS safety */}
                  {showLink && (
                    <div
                      style={{
                        fontSize: "10px",
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
                        paddingLeft: "16px",
                        margin: "3px 0 0 0",
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
  );
};
