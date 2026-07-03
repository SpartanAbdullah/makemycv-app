import type { CvData, PlanTier } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { getFullName } from "./utils";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { isSkillsFirst } from "../data/sectionOrder";
import { splitSkills } from "../utils/skills";
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
  const theme = resolveTheme(data.settings, "#111827");

  // Contact line — no emoji, separated by middle dot. Links are clickable but
  // visually plain (inherit colour, no underline) so the ATS-safe look holds.
  const plainLink = {
    color: "inherit",
    textDecoration: "none",
  } as const;
  const email = data.personal.email?.trim() || "";
  const phone = data.personal.phone?.trim() || "";
  const locationText = data.personal.location?.trim() || "";
  const linkedin = data.personal.linkedin?.trim() || "";
  const website = data.personal.website?.trim() || "";
  const dateOfBirth = data.personal.dateOfBirth?.trim() || "";
  const contactParts = [
    email ? (
      <a href={`mailto:${email}`} style={plainLink}>
        {email}
      </a>
    ) : null,
    phone ? (
      <a href={`tel:${phone}`} style={plainLink}>
        {phone}
      </a>
    ) : null,
    locationText || null,
    linkedin ? (
      <a
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
        href={normalizeHref(website)}
        target="_blank"
        rel="noreferrer"
        style={plainLink}
      >
        {shortenDisplayUrl(website)}
      </a>
    ) : null,
    dateOfBirth ? `DOB: ${dateOfBirth}` : null,
  ].filter((part) => part !== null);

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

  // Skills-first domains (e.g. IT) lead with the skills block, above experience.
  const skillsFirst = isSkillsFirst(data.settings.domain);

  // Determine which section is rendered first (for marginTop: 0). When
  // skills-first and there's no summary, skills becomes the first section.
  const firstSection = hasSummary
    ? "summary"
    : skillsFirst && hasSkills
      ? "skills"
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

  // Extracted so the skills block renders exactly once, in the right place.
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );
  const renderSkillChips = (list: typeof data.skills) => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "6px",
      }}
    >
      {list.map((skill) => (
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
  );
  const skillsSection = hasSkills ? (
    <>
      {generalSkills.length > 0 && (
        <section>
          <SectionHeading isFirst={firstSection === "skills"}>
            Skills
          </SectionHeading>
          {renderSkillChips(generalSkills)}
        </section>
      )}
      {technicalSkills.length > 0 && (
        <section>
          <SectionHeading
            isFirst={firstSection === "skills" && generalSkills.length === 0}
          >
            Technical Skills
          </SectionHeading>
          {renderSkillChips(technicalSkills)}
        </section>
      )}
    </>
  ) : null;

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        padding: `${36 * theme.marginScale}px ${32 * theme.marginScale}px`,
        fontFamily: theme.fontFamily,
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
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
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
                {contactParts.map((part, i) => (
                  <span key={i}>
                    {i > 0 ? " · " : ""}
                    {part}
                  </span>
                ))}
              </div>
            )}
            {essentialChips.length > 0 && (
              <div
                style={{
                  fontSize: "10px",
                  color: "#374151",
                  lineHeight: 1.55,
                  marginTop: "2px",
                }}
              >
                {essentialChips
                  .map((c) => `${c.label}: ${c.value}`)
                  .join(" · ")}
              </div>
            )}
          </div>

          {showPhoto && data.personal.photo && (
            <div
              style={{
                width: 72,
                height: 72,
                flexShrink: 0,
                borderRadius:
                  data.settings.photoShape === "square" ? 6 : "50%",
                overflow: "hidden",
                border: "1px solid #E5E7EB",
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

        <div
          style={{
            borderBottom: `2px solid ${theme.accentText}`,
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

      {skillsFirst ? skillsSection : null}

      {/* ── Experience ── */}
      {hasExperience && (
        <section>
          <SectionHeading isFirst={firstSection === "experience"}>
            Experience
          </SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {experience.map((role) => (
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
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
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
            {education.map((edu) => (
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
                    {formatDateRange(edu.startDate, edu.endDate)}
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
                        color: "#15803d",
                        marginLeft: "8px",
                      }}
                    >
                      {edu.attestingBody?.trim()
                        ? `\u2713 Attested — ${edu.attestingBody.trim()}`
                        : "(Attested)"}
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

      {/* ── Skills (rendered above if skills-first) ── */}
      {skillsFirst ? null : skillsSection}

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
            {data.languages.map((lang, i) => (
              <span key={lang.id}>
                {i > 0 ? ", " : ""}
                <span style={{ fontWeight: 600 }}>{lang.name}</span>
                {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
              </span>
            ))}
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
                      fontSize: "11.5px",
                      color: "#111827",
                    }}
                  >
                    {project.name?.trim() || "Project"}
                  </div>

                  {/* Clickable but visually plain — link annotations don't affect ATS text extraction; loud styling would. */}
                  {showLink && (
                    <a
                      href={normalizeHref(project.link)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "block",
                        fontSize: "10px",
                        color: "#6B7280",
                        textDecoration: "none",
                        marginTop: "1px",
                      }}
                    >
                      ({project.link!.trim()})
                    </a>
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
