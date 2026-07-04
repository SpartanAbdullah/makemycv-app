import type React from "react";
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

/**
 * "Professional" — centered single-column template inspired by the Enhancv /
 * cvtoolspro layout the founder liked: centered name, a pipe-separated headline
 * strip, a centered contact line, and centered section headings with a
 * full-width rule. Rendered in two picker variants (with / without photo) via
 * the `showPhoto` flag — see ProfessionalTemplate / ProfessionalPhotoTemplate.
 *
 * Single-column and text-first, so it stays ATS-friendly. Honors the same
 * domain-personalization features as the other single-column templates
 * (skills-first ordering, technical/general skill split).
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

const ProSection = ({
  title,
  headingStyle,
  children,
}: {
  title: string;
  headingStyle: React.CSSProperties;
  children: React.ReactNode;
}) => (
  <section>
    <h2 style={headingStyle}>{title}</h2>
    {children}
  </section>
);

const ProfessionalBase = ({
  data,
  showPhoto,
}: {
  data: CvData;
  showPhoto: boolean;
}) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim() || "";
  const theme = resolveTheme(data.settings, "#1f2937");
  // Accent appears only as text/border on a white page → use the readable form.
  const accent = theme.accentText;

  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const projects = meaningfulProjects(data.projects);
  const { general: generalSkills, technical: technicalSkills } = splitSkills(
    data.skills,
  );

  const hasSummary = Boolean(data.personal.summary?.trim());
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasProjects = projects.length > 0;
  const skillsFirst = isSkillsFirst(data.settings.domain);

  const photo =
    showPhoto && theme.photoVisible && data.personal.photo
      ? data.personal.photo
      : null;

  const essentialChips = getEssentialChips(data.personal);

  const email = data.personal.email?.trim() || "";
  const phone = data.personal.phone?.trim() || "";
  const locationText = data.personal.location?.trim() || "";
  const linkedin = data.personal.linkedin?.trim() || "";
  const website = data.personal.website?.trim() || "";
  const plainLink = { color: "inherit", textDecoration: "none" } as const;
  const contactParts = [
    email ? (
      <a key="e" href={`mailto:${email}`} style={plainLink}>
        {email}
      </a>
    ) : null,
    phone ? (
      <a key="p" href={`tel:${phone}`} style={plainLink}>
        {phone}
      </a>
    ) : null,
    locationText ? <span key="l">{locationText}</span> : null,
    linkedin ? (
      <a key="li" href={normalizeHref(linkedin)} target="_blank" rel="noreferrer" style={plainLink}>
        {shortenDisplayUrl(linkedin)}
      </a>
    ) : null,
    website ? (
      <a key="w" href={normalizeHref(website)} target="_blank" rel="noreferrer" style={plainLink}>
        {shortenDisplayUrl(website)}
      </a>
    ) : null,
  ].filter(Boolean);

  const headingStyle = {
    fontSize: `${11 * theme.fontScale}px`,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#111827",
    textTransform: "uppercase" as const,
    textAlign: "center" as const,
    borderBottom: `1.5px solid ${accent}`,
    paddingBottom: "4px",
    marginBottom: "10px",
    marginTop: `${18 * theme.spaceScale}px`,
  };

  const bulletListClass =
    "list-disc pl-4 space-y-1 text-[calc(11px*var(--fs))] leading-[calc(1.5*var(--lh))] text-slate-700 marker:text-slate-400";

  const skillsSection = hasSkills ? (
    <>
      {generalSkills.length > 0 && (
        <ProSection headingStyle={headingStyle} title="Skills">
          <p className="text-[calc(11.5px*var(--fs))] leading-[calc(1.5*var(--lh))] text-slate-700 text-center">
            {generalSkills.map((sk) => sk.name).join("  •  ")}
          </p>
        </ProSection>
      )}
      {technicalSkills.length > 0 && (
        <ProSection headingStyle={headingStyle} title="Technical Skills">
          <p className="text-[calc(11.5px*var(--fs))] leading-[calc(1.5*var(--lh))] text-slate-700 text-center">
            {technicalSkills.map((sk) => sk.name).join("  •  ")}
          </p>
        </ProSection>
      )}
    </>
  ) : null;

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        padding: `${40 * theme.marginScale}px ${44 * theme.marginScale}px`,
        fontFamily: theme.fontFamily,
        fontSize: `${11.5 * theme.fontScale}px`,
        color: "#1a1a1a",
        lineHeight: 1.5 * theme.lineScale,
        boxSizing: "border-box" as const,
        ["--fs" as string]: theme.fontScale,
        ["--lh" as string]: theme.lineScale,
        ["--sp" as string]: theme.spaceScale,
      }}
    >
      {/* ── Centered header ── */}
      <header style={{ textAlign: "center", paddingBottom: "6px" }}>
        {photo && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={name}
              style={{
                width: "84px",
                height: "84px",
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${accent}`,
              }}
            />
          </div>
        )}
        <div
          style={{
            fontSize: `${28 * theme.fontScale}px`,
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "1px",
            textTransform: "uppercase",
            lineHeight: 1.15 * theme.lineScale,
          }}
        >
          {name}
        </div>
        {headline && (
          <div
            style={{
              fontSize: `${12.5 * theme.fontScale}px`,
              fontWeight: 500,
              color: accent,
              marginTop: "5px",
              letterSpacing: "0.02em",
            }}
          >
            {headline}
          </div>
        )}
        {contactParts.length > 0 && (
          <div
            style={{
              fontSize: `${10.5 * theme.fontScale}px`,
              color: "#6B7280",
              marginTop: "7px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {contactParts.map((part, i) => (
              <span key={i} style={{ display: "inline-flex", gap: "6px" }}>
                {i > 0 && <span style={{ color: "#CBD5E1" }}>•</span>}
                {part}
              </span>
            ))}
          </div>
        )}
        {essentialChips.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {essentialChips.map((chip) => (
              <span
                key={chip.label}
                style={{
                  fontSize: `${9.5 * theme.fontScale}px`,
                  color: "#374151",
                  background: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  borderRadius: "999px",
                  padding: "2px 9px",
                }}
              >
                <span style={{ color: "#6B7280" }}>{chip.label}: </span>
                {chip.value}
              </span>
            ))}
          </div>
        )}
      </header>

      {hasSummary && (
        <ProSection headingStyle={headingStyle} title="Summary">
          <p className="text-[calc(11.5px*var(--fs))] leading-[calc(1.55*var(--lh))] text-slate-700">
            {data.personal.summary?.trim()}
          </p>
        </ProSection>
      )}

      {skillsFirst ? skillsSection : null}

      {hasExperience && (
        <ProSection headingStyle={headingStyle} title="Experience">
          <div className="space-y-3">
            {experience.map((role) => (
              <div key={role.id} className="avoid-break space-y-1 [break-inside:avoid]">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[calc(12px*var(--fs))] leading-[calc(1.35*var(--lh))]">
                    <span className="font-semibold text-slate-800">{role.role?.trim() || "Role"}</span>
                    <span className="font-normal text-slate-600">
                      {role.company ? ` | ${role.company.trim()}` : ""}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-right text-[calc(11px*var(--fs))] text-slate-500">
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </span>
                </div>
                {role.location && (
                  <div className="text-[calc(11px*var(--fs))] text-slate-500">{role.location.trim()}</div>
                )}
                <ul className={bulletListClass}>
                  {role.bullets
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </ProSection>
      )}

      {hasEducation && (
        <ProSection headingStyle={headingStyle} title="Education">
          <div className="space-y-3">
            {education.map((edu) => (
              <div key={edu.id} className="avoid-break [break-inside:avoid]">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[calc(12px*var(--fs))] font-semibold text-slate-800">
                    {[edu.degree?.trim(), edu.field?.trim()].filter(Boolean).join(" · ") || "Degree"}
                    <span className="font-normal text-slate-600">
                      {edu.school ? ` | ${edu.school.trim()}` : ""}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-[calc(11px*var(--fs))] text-slate-500">
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </span>
                </div>
                {edu.notes && <div className="mt-0.5 text-[calc(11px*var(--fs))] text-slate-500">{edu.notes.trim()}</div>}
                {edu.attested && edu.attestingBody?.trim() && (
                  <p className="mt-0.5 text-[calc(11px*var(--fs))] font-medium text-green-700">
                    {"✓"} Attested — {edu.attestingBody.trim()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ProSection>
      )}

      {skillsFirst ? null : skillsSection}

      {(hasLanguages || hasCertifications) && (
        <section
          style={{ display: "grid", gridTemplateColumns: hasLanguages && hasCertifications ? "1fr 1fr" : "1fr", gap: "24px" }}
        >
          {hasLanguages && (
            <div>
              <h2 style={headingStyle}>Languages</h2>
              <p className="text-[calc(11.5px*var(--fs))] leading-[calc(1.5*var(--lh))] text-slate-700 text-center">
                {data.languages.map((lang, i) => (
                  <span key={lang.id}>
                    <span className="font-semibold">{lang.name}</span>
                    {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                    {i < data.languages.length - 1 ? "  •  " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
          {hasCertifications && (
            <div>
              <h2 style={headingStyle}>Certifications</h2>
              <div className="space-y-1 text-center text-slate-700">
                {data.certifications.map((cert) => (
                  <div key={cert.id} className="text-[calc(11px*var(--fs))] leading-[calc(1.45*var(--lh))]">
                    <span className="font-semibold">{cert.name.trim()}</span>
                    <span className="text-slate-500">
                      {cert.issuer ? ` | ${cert.issuer.trim()}` : ""}
                      {cert.date ? ` | ${cert.date.trim()}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {hasProjects && (
        <ProSection headingStyle={headingStyle} title="Projects">
          <div className="space-y-2">
            {projects.map((project) => {
              const bullets = (project.bullets ?? []).map((b) => b.trim()).filter(Boolean);
              return (
                <div key={project.id} className="avoid-break [break-inside:avoid]">
                  <div className="text-[calc(12px*var(--fs))] font-semibold text-slate-800">
                    {project.name?.trim() || "Project"}
                    {shouldShowProjectLink(project.link) && (
                      <span className="ml-1 text-[calc(10.5px*var(--fs))] font-normal text-slate-500">
                        {shortenDisplayUrl(project.link!.trim())}
                      </span>
                    )}
                  </div>
                  {bullets.length > 0 && (
                    <ul className={bulletListClass}>
                      {bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </ProSection>
      )}
    </div>
  );
};

export const ProfessionalTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => <ProfessionalBase data={data} showPhoto={false} />;

export const ProfessionalPhotoTemplate = ({
  data,
}: {
  data: CvData;
  plan?: PlanTier;
}) => <ProfessionalBase data={data} showPhoto={true} />;
