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
 * "Onyx" — charcoal left sidebar with a prominent circular photo, inspired by
 * the founder's cvtoolspro "Most Selected" reference. The sidebar background IS
 * the accent (default charcoal), so picking a custom colour recolours the band;
 * all sidebar text uses the contrast-safe onAccent/onAccentMuted derivatives so
 * a light pick stays readable, and main-column headings use accentText (auto-
 * darkened) so they never vanish on white. Skills are text (no bars — an
 * ATS/honesty call).
 */

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

const SideLabel = ({
  children,
  color,
  theme,
}: {
  children: React.ReactNode;
  color: string;
  theme: ReturnType<typeof resolveTheme>;
}) => (
  <div
    style={{
      fontSize: `${9 * theme.fontScale}px`,
      fontWeight: 700,
      letterSpacing: "0.14em",
      color,
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
  theme,
  isFirst = false,
}: {
  children: React.ReactNode;
  accent: string;
  theme: ReturnType<typeof resolveTheme>;
  isFirst?: boolean;
}) => (
  <div
    style={{
      marginTop: isFirst ? 0 : `${18 * theme.spaceScale}px`,
      borderBottom: `1.5px solid ${accent}`,
      paddingBottom: "3px",
      marginBottom: "9px",
    }}
  >
    <span
      style={{
        fontSize: `${11 * theme.fontScale}px`,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "#1f2937",
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </span>
  </div>
);

export const OnyxTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => {
  const firstName = data.personal.firstName?.trim() || "First";
  const lastName = data.personal.lastName?.trim() || "Last";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#262626");
  const { accent, accentText, onAccent, onAccentMuted } = theme;
  const m = theme.marginScale;

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

  // Border tint that reads on both dark and light bands.
  const bandBorder =
    onAccent === "#FFFFFF" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: theme.fontFamily,
        fontSize: `${11 * theme.fontScale}px`,
      }}
    >
      {/* ── Accent band sidebar ── */}
      <div
        style={{
          width: "220px",
          flexShrink: 0,
          backgroundColor: accent,
          padding: "30px 22px",
          boxSizing: "border-box" as const,
          color: onAccentMuted,
        }}
      >
        {showPhoto && data.personal.photo && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <div
              style={{
                width: 108,
                height: 108,
                borderRadius: data.settings.photoShape === "square" ? 10 : "50%",
                overflow: "hidden",
                border: `3px solid ${bandBorder}`,
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

        <div
          style={{
            fontSize: `${21 * theme.fontScale}px`,
            fontWeight: 700,
            lineHeight: 1.15 * theme.lineScale,
            color: onAccent,
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          {firstName} {lastName}
        </div>
        {headline && (
          <div
            style={{
              fontSize: `${11 * theme.fontScale}px`,
              color: onAccentMuted,
              marginTop: "5px",
              textAlign: "center",
              lineHeight: 1.4 * theme.lineScale,
              paddingBottom: "14px",
              borderBottom: `1px solid ${bandBorder}`,
              marginBottom: "14px",
            }}
          >
            {headline}
          </div>
        )}

        {hasSummary && (
          <div style={{ marginBottom: `${18 * theme.spaceScale}px` }}>
            <SideLabel color={onAccentMuted} theme={theme}>About Me</SideLabel>
            <p style={{ fontSize: `${10 * theme.fontScale}px`, color: onAccentMuted, lineHeight: 1.6 * theme.lineScale, margin: 0 }}>
              {data.personal.summary!.trim()}
            </p>
          </div>
        )}

        {contactItems.length > 0 && (
          <div style={{ marginBottom: `${18 * theme.spaceScale}px` }}>
            <SideLabel color={onAccentMuted} theme={theme}>Contact</SideLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {contactItems.map((item, i) =>
                item.href ? (
                  <a
                    key={i}
                    href={item.href}
                    style={{
                      fontSize: `${10 * theme.fontScale}px`,
                      color: onAccentMuted,
                      lineHeight: 1.5 * theme.lineScale,
                      wordBreak: "break-all" as const,
                      textDecoration: "none",
                    }}
                  >
                    {item.text}
                  </a>
                ) : (
                  <span key={i} style={{ fontSize: `${10 * theme.fontScale}px`, color: onAccentMuted, lineHeight: 1.5 * theme.lineScale }}>
                    {item.text}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {hasLanguages && (
          <div style={{ marginBottom: `${18 * theme.spaceScale}px` }}>
            <SideLabel color={onAccentMuted} theme={theme}>Languages</SideLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {data.languages.map((lang) => (
                <div key={lang.id} style={{ fontSize: `${10 * theme.fontScale}px`, color: onAccentMuted, lineHeight: 1.5 * theme.lineScale }}>
                  <span style={{ fontWeight: 600, color: onAccent }}>{lang.name}</span>
                  {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                </div>
              ))}
            </div>
          </div>
        )}

        {essentialChips.length > 0 && (
          <div>
            <SideLabel color={onAccentMuted} theme={theme}>Details</SideLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {essentialChips.map((chip) => (
                <div key={chip.label} style={{ fontSize: `${10 * theme.fontScale}px`, color: onAccentMuted, lineHeight: 1.45 * theme.lineScale }}>
                  <span style={{ color: onAccent, fontWeight: 700 }}>{chip.label}:</span> {chip.value}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main column ── */}
      <div style={{ flex: 1, minWidth: 0, padding: `${30 * m}px ${30 * m}px`, boxSizing: "border-box" as const }}>
        {hasExperience && (
          <section>
            <MainHeading accent={accentText} theme={theme} isFirst>
              Experience
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {experience.map((role) => (
                <div key={role.id} style={{ pageBreakInside: "avoid" as const, breakInside: "avoid" as const }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: `${12 * theme.fontScale}px`, fontWeight: 700, color: "#111827" }}>
                      {role.role?.trim() || "Role"}
                    </span>
                    <span style={{ fontSize: `${10 * theme.fontScale}px`, color: "#6B7280", whiteSpace: "nowrap" as const, marginLeft: "8px", flexShrink: 0 }}>
                      {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                    </span>
                  </div>
                  {(role.company || role.location) && (
                    <div style={{ fontSize: `${11 * theme.fontScale}px`, color: accentText, fontWeight: 600, marginTop: "1px" }}>
                      {role.company?.trim() || ""}
                      {role.company?.trim() && role.location?.trim() ? " · " : ""}
                      <span style={{ color: "#6B7280", fontWeight: 400 }}>{role.location?.trim() || ""}</span>
                    </div>
                  )}
                  {role.bullets.filter(Boolean).length > 0 && (
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: "14px", listStyleType: "disc" }}>
                      {role.bullets.filter(Boolean).map((bullet, i) => (
                        <li key={i} style={{ fontSize: `${11 * theme.fontScale}px`, color: "#374151", lineHeight: 1.55 * theme.lineScale }}>
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
            <MainHeading accent={accentText} theme={theme} isFirst={!hasExperience}>
              Education
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {education.map((edu) => (
                <div key={edu.id} style={{ pageBreakInside: "avoid" as const, breakInside: "avoid" as const }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: `${11.5 * theme.fontScale}px`, fontWeight: 700, color: "#111827" }}>
                      {edu.degree?.trim() || "Degree"}
                      {edu.field?.trim() ? ` — ${edu.field.trim()}` : ""}
                    </span>
                    <span style={{ fontSize: `${10 * theme.fontScale}px`, color: "#6B7280", whiteSpace: "nowrap" as const, marginLeft: "8px", flexShrink: 0 }}>
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </span>
                  </div>
                  {edu.school?.trim() && (
                    <div style={{ fontSize: `${11 * theme.fontScale}px`, color: accentText, fontWeight: 600, marginTop: "1px" }}>
                      {edu.school.trim()}
                    </div>
                  )}
                  {edu.attested && edu.attestingBody?.trim() && (
                    <div style={{ fontSize: `${9.5 * theme.fontScale}px`, color: "#15803d", marginTop: "1px" }}>
                      {"✓"} Attested — {edu.attestingBody.trim()}
                    </div>
                  )}
                  {edu.notes?.trim() && (
                    <div style={{ fontSize: `${10 * theme.fontScale}px`, color: "#6B7280", marginTop: "1px" }}>{edu.notes.trim()}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {hasSkills && (
          <section>
            <MainHeading accent={accentText} theme={theme} isFirst={!hasExperience && !hasEducation}>
              Skills
            </MainHeading>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.skills.map((skill) => (
                <span
                  key={skill.id}
                  style={{
                    fontSize: `${10.5 * theme.fontScale}px`,
                    color: "#374151",
                    background: "#F3F4F6",
                    border: "1px solid #E5E7EB",
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
            <MainHeading accent={accentText} theme={theme} isFirst={!hasExperience && !hasEducation && !hasSkills}>
              Certifications
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {data.certifications.map((cert) => (
                <div key={cert.id} style={{ fontSize: `${11 * theme.fontScale}px`, color: "#374151", lineHeight: 1.45 * theme.lineScale }}>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{cert.name.trim()}</span>
                  <span style={{ color: "#6B7280" }}>
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
              accent={accentText}
              theme={theme}
              isFirst={!hasExperience && !hasEducation && !hasSkills && !hasCertifications}
            >
              Projects
            </MainHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {projects.map((project) => {
                const bullets = (project.bullets ?? []).filter(Boolean);
                return (
                  <div key={project.id} style={{ pageBreakInside: "avoid" as const, breakInside: "avoid" as const }}>
                    <div style={{ fontSize: `${11.5 * theme.fontScale}px`, fontWeight: 700, color: "#111827" }}>
                      {project.name?.trim() || "Project"}
                      {shouldShowProjectLink(project.link) && (
                        <span style={{ marginLeft: "6px", fontSize: `${10 * theme.fontScale}px`, fontWeight: 400, color: accentText }}>
                          {shortenDisplayUrl(project.link!.trim())}
                        </span>
                      )}
                    </div>
                    {bullets.length > 0 && (
                      <ul style={{ margin: "3px 0 0 0", paddingLeft: "14px", listStyleType: "disc" }}>
                        {bullets.map((b, i) => (
                          <li key={i} style={{ fontSize: `${11 * theme.fontScale}px`, color: "#374151", lineHeight: 1.55 * theme.lineScale }}>
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
