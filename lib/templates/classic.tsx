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
        }
      : null,
    data.personal.phone?.trim()
      ? {
          text: data.personal.phone.trim(),
          href: `tel:${data.personal.phone.trim()}`,
        }
      : null,
    data.personal.location?.trim() ? { text: data.personal.location.trim() } : null,
    data.personal.linkedin?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.linkedin),
          href: data.personal.linkedin.trim(),
        }
      : null,
    data.personal.website?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.website),
          href: data.personal.website.trim(),
        }
      : null,
  ].filter(Boolean) as Array<{ text: string; href?: string }>;

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
    <div className="cv-print relative overflow-hidden bg-white px-10 py-12 text-[14px] leading-relaxed text-slate-900">
      {plan === "free" && (
        <div
          aria-hidden="true"
          className="cv-watermark pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
        >
          <span className="select-none rotate-[-28deg] text-[42px] font-semibold tracking-wide text-slate-500 opacity-[0.08]">
            MakeMyCV • Free
          </span>
        </div>
      )}
      <div className="cv-content relative z-10">
      <header className="border-b border-slate-200 pb-2">
        <div className="grid grid-cols-1 gap-3 items-start sm:grid-cols-[1fr,auto] sm:gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[33px] font-semibold leading-none tracking-tight">
              {name}
            </h1>
            <p className="mt-0.5 text-[15px] font-normal text-slate-600">{headline}</p>
          </div>
          <div className="min-w-0 sm:justify-self-end sm:max-w-[320px]">
            {contactItems.length > 0 && (
              <div className="flex max-w-[320px] flex-wrap justify-start gap-x-3 gap-y-1 text-xs leading-snug text-slate-600 sm:justify-end">
                {contactItems.map((item, index) => (
                  item.href ? (
                    <a
                      key={`${item.text}-${index}`}
                      href={item.href}
                      className="min-w-0"
                    >
                      <span className="break-words [overflow-wrap:anywhere]">{item.text}</span>
                    </a>
                  ) : (
                    <span
                      key={`${item.text}-${index}`}
                      className="min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      {item.text}
                    </span>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {hasSummary && (
        <section className="cv-section mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Summary</h2>
          </div>
          <p className="mt-2 text-[14px] text-slate-700">{data.personal.summary?.trim()}</p>
        </section>
      )}

      {hasExperience && (
        <section className="cv-section mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Experience</h2>
          </div>
          <div className="mt-2 space-y-2.5">
            {data.experience.map((role) => (
              <div key={role.id} className="avoid-break space-y-1 [break-inside:avoid]">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[14px]">
                    <span className="font-semibold text-slate-900">{role.role?.trim() || "Role"}</span>
                    <span className="font-normal text-slate-500">
                      {role.company ? ` | ${role.company.trim()}` : ""}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-right text-[11px] font-normal text-slate-400">
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </span>
                </div>
                {role.location && (
                  <div className="text-[11px] text-slate-400">{role.location.trim()}</div>
                )}
                <ul className="list-disc space-y-0 pl-4 text-[12px] leading-[1.3] text-slate-700 marker:text-slate-500">
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
        <section className="cv-section mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Education</h2>
          </div>
          <div className="mt-2 space-y-2.5">
            {data.education.map((edu) => (
              <div key={edu.id} className="avoid-break [break-inside:avoid]">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[14px] font-semibold text-slate-800">
                    {edu.degree?.trim() || "Degree"}
                    <span className="font-normal text-slate-600">
                      {edu.school ? ` | ${edu.school.trim()}` : ""}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-normal text-slate-400">
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </span>
                </div>
                {(edu.field || edu.notes) && (
                  <div className="text-[11px] text-slate-400">
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
        <section className="cv-section mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Skills</h2>
          </div>
          <p className="mt-2 text-[14px] text-slate-700">{data.skills.map(formatSkill).join(" | ")}</p>
        </section>
      )}

      {(hasLanguages || hasCertifications) && (
        <section className="cv-section mt-5 grid gap-5 md:grid-cols-2">
          {hasLanguages && (
            <div>
              <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
                <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Languages</h2>
              </div>
              <p className="mt-2 text-[14px] text-slate-700">
                {data.languages
                  .map((lang) => formatLanguage(lang.name, normalizeLevel(lang.level)))
                  .join(" | ")}
              </p>
            </div>
          )}
          {hasCertifications && (
            <div>
              <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
                <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Certifications</h2>
              </div>
              <div className="mt-2 space-y-1.5 text-slate-700">
                {data.certifications.map((cert) => (
                  <div key={cert.id} className="text-[13px]">
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
        <section className="cv-section mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-normal text-slate-700">Projects</h2>
          </div>
          <div className="mt-2 space-y-2.5">
            {data.projects.map((project) => {
              const bullets = project.bullets.map((bullet) => bullet.trim()).filter(Boolean);
              const bulletsCount = bullets.length;
              const [firstBullet, ...remainingBullets] = bullets;

              return (
                <div key={project.id}>
                  {bulletsCount <= 3 ? (
                    <div className="keep-with-next">
                      <div className="text-[14px] font-semibold">
                        {project.name?.trim() || "Project"}
                        {project.link ? (
                          <span className="font-normal text-slate-500">{` | ${project.link.trim()}`}</span>
                        ) : null}
                      </div>
                      {bulletsCount > 0 && (
                        <ul className="list-disc space-y-0 pl-4 text-[12px] leading-[1.3] text-slate-700 marker:text-slate-500">
                          {bullets.map((bullet, index) => (
                            <li key={index}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="keep-with-next">
                        <div className="text-[14px] font-semibold">
                          {project.name?.trim() || "Project"}
                          {project.link ? (
                            <span className="font-normal text-slate-500">{` | ${project.link.trim()}`}</span>
                          ) : null}
                        </div>
                        <ul className="list-disc space-y-0 pl-4 text-[12px] leading-[1.3] text-slate-700 marker:text-slate-500">
                          {firstBullet ? <li>{firstBullet}</li> : null}
                        </ul>
                      </div>
                      {remainingBullets.length > 0 && (
                        <ul className="list-disc space-y-0 pl-4 text-[12px] leading-[1.3] text-slate-700 marker:text-slate-500">
                          {remainingBullets.map((bullet, index) => (
                            <li key={index}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </>
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
