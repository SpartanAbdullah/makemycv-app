import type { CvData, CvSkill, PlanTier } from "../types/cv";
import { formatDateRange } from "../utils/format";
import { getFullName } from "./utils";

export const ClassicTemplate = ({ data, plan = "free" }: { data: CvData; plan?: PlanTier }) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline || "Your Headline";
  const hasSummary = Boolean(data.personal.summary);
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasProjects = data.projects.length > 0;

  const sectionClass = "cv-section mt-6";
  const headingWrapClass = "avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]";
  const headingClass = "text-[12.5px] font-semibold tracking-normal text-slate-800";
  const bodyClass = "text-[11.5px] leading-[1.45] text-slate-700";
  const bulletListClass =
    "list-disc pl-4 space-y-1 text-[11.5px] leading-[1.45] text-slate-700 marker:text-slate-400";

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
          text: data.personal.email.trim(),
          href: `mailto:${data.personal.email.trim()}`,
          wrapAnywhere: false,
        }
      : null,
    data.personal.phone?.trim()
      ? {
          text: data.personal.phone.trim(),
          href: `tel:${data.personal.phone.trim()}`,
          wrapAnywhere: false,
        }
      : null,
    data.personal.location?.trim()
      ? {
          text: data.personal.location.trim(),
          wrapAnywhere: false,
        }
      : null,
    data.personal.linkedin?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.linkedin),
          href: data.personal.linkedin.trim(),
          wrapAnywhere: true,
        }
      : null,
    data.personal.website?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.website),
          href: data.personal.website.trim(),
          wrapAnywhere: true,
        }
      : null,
  ].filter(Boolean) as Array<{ text: string; href?: string; wrapAnywhere: boolean }>;

  const toTitleCase = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .map((word) => {
        if (word.length <= 4 && word === word.toUpperCase()) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");

  const normalizeLevel = (level?: string) => (level ? toTitleCase(level) : "");

  const formatSkill = (skill: CvSkill) => toTitleCase(skill.name);

  const formatLanguage = (name: string, level?: string) => {
    const normalized = level?.toLowerCase();
    const prettyLevel =
      normalized === "beginner"
        ? "Conversational"
        : normalized === "intermediate"
          ? "Professional"
          : normalized === "advanced"
            ? "Fluent"
            : normalized
              ? toTitleCase(normalized)
              : "";
    return `${toTitleCase(name)}${prettyLevel ? ` (${prettyLevel})` : ""}`;
  };

  return (
    <div className="cv-print relative overflow-hidden bg-white px-10 py-12 text-[11.5px] leading-[1.45] text-slate-700">
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
        <header className="border-b border-slate-200 pb-2">
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr,auto] sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-[30px] font-bold leading-none tracking-tight text-slate-900">{name}</h1>
              <p className="mt-1 text-[15px] font-medium text-slate-600">{headline}</p>
            </div>
            <div className="min-w-0 sm:justify-self-end sm:max-w-[320px]">
              {contactItems.length > 0 && (
                <div className="flex max-w-[320px] flex-wrap items-center justify-start gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-slate-500 sm:justify-end">
                  {contactItems.map((item, index) => (
                    <div key={`${item.text}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
                      {item.href ? (
                        <a href={item.href} className="min-w-0">
                          <span className={item.wrapAnywhere ? "break-words [overflow-wrap:anywhere]" : ""}>
                            {item.text}
                          </span>
                        </a>
                      ) : (
                        <span className={item.wrapAnywhere ? "min-w-0 break-words [overflow-wrap:anywhere]" : "min-w-0"}>
                          {item.text}
                        </span>
                      )}
                      {index < contactItems.length - 1 ? <span className="text-slate-300">|</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

        {hasExperience && (
          <section className={sectionClass}>
            <div className={headingWrapClass}>
              <h2 className={headingClass}>Experience</h2>
            </div>
            <div className="mt-2 space-y-3">
              {data.experience.map((role) => (
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
              {data.education.map((edu) => (
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
                </div>
              ))}
            </div>
          </section>
        )}

        {hasSkills && (
          <section className={sectionClass}>
            <div className={headingWrapClass}>
              <h2 className={headingClass}>Skills</h2>
            </div>
            <p className={`mt-2 ${bodyClass}`}>{data.skills.map(formatSkill).join(", ")}</p>
          </section>
        )}

        {(hasLanguages || hasCertifications) && (
          <section className={`${sectionClass} grid gap-6 md:grid-cols-2`}>
            {hasLanguages && (
              <div>
                <div className={headingWrapClass}>
                  <h2 className={headingClass}>Languages</h2>
                </div>
                <p className={`mt-2 ${bodyClass}`}>
                  {data.languages
                    .map((lang) => formatLanguage(lang.name, normalizeLevel(lang.level)))
                    .join(" | ")}
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
            {data.projects.map((project, index) => {
              const bullets = (project.bullets ?? []).map((bullet) => bullet.trim()).filter(Boolean);
              const [firstBullet, ...remainingBullets] = bullets;
              const showLink = shouldShowProjectLink(project.link);
              const titleRow = (
                <div className={`${index === 0 ? "mt-2 " : ""}text-[12px] font-semibold text-slate-800`}>
                  {project.name?.trim() || "Project"}
                  {showLink ? (
                    <span className="font-normal text-slate-500 break-words [overflow-wrap:anywhere]">{` | ${project.link?.trim()}`}</span>
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
