import type { CvData, PlanTier } from "../types/cv";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { isSkillsFirst } from "../data/sectionOrder";
import { formatLanguageLevel } from "../language";
import { getFullName } from "./utils";
import { getEssentialChips } from "../utils/essentials";
import { resolveTheme } from "./theme";

export const ClassicTemplate = ({ data, plan = "free" }: { data: CvData; plan?: PlanTier }) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline?.trim();
  const theme = resolveTheme(data.settings, "#1e5b54");
  const photoVisible = theme.photoVisible;
  const hasSummary = Boolean(data.personal.summary);
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasLanguages = data.languages.length > 0;
  const projects = meaningfulProjects(data.projects);
  const hasProjects = projects.length > 0;

  const sectionClass = "cv-section mt-6";
  const headingWrapClass = "avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]";
  const headingClass = "text-[12.5px] font-semibold tracking-normal text-slate-800";
  const bodyClass = "text-[11.5px] leading-[1.45] text-slate-700";
  const bulletListClass =
    "list-disc pl-4 space-y-1 text-[11.5px] leading-[1.45] text-slate-700 marker:text-slate-400";

  // Skills-first domains (e.g. IT) lead with the skills block, above experience.
  // The section is extracted so it renders exactly once, in the right place.
  const skillsFirst = isSkillsFirst(data.settings.domain);
  const skillsSection = hasSkills ? (
    <section className={sectionClass}>
      <div className={headingWrapClass}>
        <h2 className={headingClass}>Skills</h2>
      </div>
      <p className={`mt-2 ${bodyClass}`}>{data.skills.map((skill) => skill.name).join(", ")}</p>
    </section>
  ) : null;

  const shouldShowProjectLink = (value?: string) => {
    const normalized = value?.trim();
    if (!normalized) return false;
    return normalized.toLowerCase() !== "no link was pasted";
  };

  const shortenDisplayUrl = (value: string) => {
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

  const contactItems = [
    data.personal.email?.trim()
      ? {
          icon: "✉️",
          text: data.personal.email.trim(),
          href: `mailto:${data.personal.email.trim()}`,
          wrapAnywhere: false,
        }
      : null,
    data.personal.phone?.trim()
      ? {
          icon: "📞",
          text: data.personal.phone.trim(),
          href: `tel:${data.personal.phone.trim()}`,
          wrapAnywhere: false,
        }
      : null,
    data.personal.location?.trim()
      ? {
          icon: "📍",
          text: data.personal.location.trim(),
          wrapAnywhere: false,
        }
      : null,
    data.personal.linkedin?.trim()
      ? {
          icon: "💼",
          text: shortenDisplayUrl(data.personal.linkedin),
          href: normalizeHref(data.personal.linkedin),
          wrapAnywhere: true,
        }
      : null,
    data.personal.website?.trim()
      ? {
          icon: "🌐",
          text: shortenDisplayUrl(data.personal.website),
          href: normalizeHref(data.personal.website),
          wrapAnywhere: true,
        }
      : null,
    data.personal.dateOfBirth?.trim()
      ? { icon: "🎂", text: `DOB: ${data.personal.dateOfBirth.trim()}`, wrapAnywhere: false }
      : null,
  ].filter(Boolean) as Array<{ icon: string; text: string; href?: string; wrapAnywhere: boolean }>;

  const essentialChips = getEssentialChips(data.personal);

  return (
    <div
      className="cv-print relative overflow-hidden bg-white px-8 py-9 text-[11.5px] leading-[1.45] text-slate-700"
      style={{ fontFamily: theme.fontFamily }}
    >
      {plan === "free" && (
        <div
          aria-hidden="true"
          className="cv-watermark pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
        >
          <span className="select-none rotate-[-28deg] text-[42px] font-semibold tracking-wide text-slate-500 opacity-[0.08]">
            MakeMyCV | Free
          </span>
        </div>
      )}
      <div className="cv-content relative z-10">
        <header className="border-b border-slate-200 pb-3 mb-4">
          <div className="relative flex items-start">

            {/* Left block: Name + Headline + Contact */}
            <div className="flex flex-col gap-1 flex-1 min-w-0 pr-24">
              <h1
                className="text-[28px] font-bold leading-tight tracking-tight text-slate-900"
                style={{ lineHeight: 1.1 }}
              >
                {name}
              </h1>
              {headline ? (
                <p className="text-[14px] font-medium text-slate-500 mt-0.5">
                  {headline}
                </p>
              ) : null}

              {contactItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[10.5px] leading-snug text-slate-500">
                  {contactItems.map((item, index) => (
                    <div key={`${item.text}-${index}`} className="inline-flex min-w-0 items-center gap-1">
                      <span
                        style={{ fontSize: "10px", lineHeight: 1, flexShrink: 0 }}
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      {item.href ? (
                        <a href={item.href} className="min-w-0 underline decoration-slate-300 underline-offset-2 hover:text-slate-700">
                          <span className={item.wrapAnywhere ? "break-words [overflow-wrap:anywhere]" : ""}>
                            {item.text}
                          </span>
                        </a>
                      ) : (
                        <span className={item.wrapAnywhere ? "min-w-0 break-words [overflow-wrap:anywhere]" : "min-w-0"}>
                          {item.text}
                        </span>
                      )}
                      {index < contactItems.length - 1 ? (
                        <span className="text-slate-300 ml-1">|</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {essentialChips.length > 0 && (
                <div className="mt-1.5 text-[10px] leading-snug text-slate-600">
                  {essentialChips.map((chip, idx) => (
                    <span key={chip.label}>
                      <span className="font-semibold text-slate-800">{chip.label}:</span>{" "}
                      <span>{chip.value}</span>
                      {idx < essentialChips.length - 1 ? (
                        <span className="text-slate-300 mx-1.5">·</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Photo: absolute top-right */}
            {data.personal.photo && data.personal.showPhoto && photoVisible && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 76,
                  height: 76,
                  borderRadius: data.settings.photoShape === "square" ? 8 : "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "2px solid #e2e8f0",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.personal.photo}
                  alt={`${data.personal.firstName} ${data.personal.lastName}`}
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
        </header>

        {hasSummary && (
          <section className={sectionClass}>
            <div className={headingWrapClass}>
              <h2 className={headingClass}>Summary</h2>
            </div>
            <p className={`mt-2 ${bodyClass}`}>{data.personal.summary?.trim()}</p>
          </section>
        )}

        {skillsFirst ? skillsSection : null}

        {hasExperience && (
          <section className={sectionClass}>
            <div className={headingWrapClass}>
              <h2 className={headingClass}>Experience</h2>
            </div>
            <div className="mt-2 space-y-3">
              {experience.map((role) => (
                <div key={role.id} className="avoid-break space-y-1 [break-inside:avoid]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[12px] leading-[1.35]">
                      <span className="font-semibold text-slate-800">{role.role?.trim() || "Role"}</span>
                      <span className="font-normal text-slate-700">
                        {role.company ? ` | ${role.company.trim()}` : ""}
                      </span>
                    </div>
                    <span className="whitespace-nowrap text-right text-[11px] font-normal text-slate-500">
                      {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                    </span>
                  </div>
                  {role.location && <div className="text-[11px] text-slate-500">{role.location.trim()}</div>}
                  <ul className={bulletListClass}>
                    {role.bullets
                      .map((bullet) => bullet.trim())
                      .filter(Boolean)
                      .map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasEducation && (
          <section className={sectionClass}>
            <div className={headingWrapClass}>
              <h2 className={headingClass}>Education</h2>
            </div>
            <div className="mt-2 space-y-3">
              {education.map((edu) => (
                <div key={edu.id} className="avoid-break [break-inside:avoid]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[12px] font-semibold text-slate-800">
                      {edu.degree?.trim() || "Degree"}
                      <span className="font-normal text-slate-700">
                        {edu.school ? ` | ${edu.school.trim()}` : ""}
                      </span>
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-normal text-slate-500">
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </span>
                  </div>
                  {(edu.field || edu.notes) && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      {edu.field ? <span>{edu.field.trim()}</span> : null}
                      {edu.field && edu.notes ? <span> | </span> : null}
                      {edu.notes ? <span>{edu.notes.trim()}</span> : null}
                    </div>
                  )}
                  {edu.attested && edu.attestingBody?.trim() && (
                    <p className="mt-0.5 text-xs font-medium text-green-700">
                      {"\u2713"} Attested — {edu.attestingBody.trim()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {skillsFirst ? null : skillsSection}

        {(hasLanguages || hasCertifications) && (
          <section className={`${sectionClass} grid gap-6 md:grid-cols-2`}>
            {hasLanguages && (
              <div>
                <div className={headingWrapClass}>
                  <h2 className={headingClass}>Languages</h2>
                </div>
                <p className={`mt-2 ${bodyClass}`}>
                  {data.languages.map((lang, index) => (
                    <span key={lang.id}>
                      <span className="font-semibold">{lang.name}</span>
                      {lang.level ? ` — ${formatLanguageLevel(lang.level)}` : ""}
                      {index < data.languages.length - 1 ? " | " : ""}
                    </span>
                  ))}
                </p>
              </div>
            )}
            {hasCertifications && (
              <div>
                <div className={headingWrapClass}>
                  <h2 className={headingClass}>Certifications</h2>
                </div>
                <div className="mt-2 space-y-2 text-slate-700">
                  {data.certifications.map((cert) => (
                    <div key={cert.id} className="text-[11.5px] leading-[1.45]">
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
          <section className={sectionClass}>
            {projects.map((project, index) => {
              const bullets = (project.bullets ?? []).map((bullet) => bullet.trim()).filter(Boolean);
              const [firstBullet, ...remainingBullets] = bullets;
              const showLink = shouldShowProjectLink(project.link);
              const titleRow = (
                <div className={`${index === 0 ? "mt-2 " : ""}text-[12px] font-semibold text-slate-800`}>
                  {project.name?.trim() || "Project"}
                  {showLink ? (
                    <span className="font-normal text-slate-500 break-words [overflow-wrap:anywhere]">
                      {" | "}
                      <a
                        href={normalizeHref(project.link)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-slate-300 underline-offset-2"
                      >
                        {project.link?.trim()}
                      </a>
                    </span>
                  ) : null}
                </div>
              );

              if (index === 0) {
                return (
                  <div key={project.id}>
                    <div className="keep-with-next">
                      <div className={headingWrapClass}>
                        <h2 className={headingClass}>Projects</h2>
                      </div>
                      {titleRow}
                      {firstBullet && (
                        <ul className={bulletListClass}>
                          <li>{firstBullet}</li>
                        </ul>
                      )}
                    </div>
                    {remainingBullets.length > 0 && (
                      <ul className={bulletListClass}>
                        {remainingBullets.map((bullet, bulletIndex) => (
                          <li key={bulletIndex}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }

              return (
                <div key={project.id} className="mt-3">
                  <div className="keep-with-next">
                    {titleRow}
                    {firstBullet && (
                      <ul className={bulletListClass}>
                        <li>{firstBullet}</li>
                      </ul>
                    )}
                  </div>
                  {remainingBullets.length > 0 && (
                    <ul className={bulletListClass}>
                      {remainingBullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
};
