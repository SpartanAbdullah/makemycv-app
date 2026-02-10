import type { CvData, CvSkill } from "../types/cv";
import { formatDateRange } from "../utils/format";
import { getFullName } from "./utils";

export const ClassicTemplate = ({ data }: { data: CvData }) => {
  const name = getFullName(data) || "Your Name";
  const headline = data.personal.headline || "Your Headline";
  const hasSummary = Boolean(data.personal.summary);
  const hasExperience = data.experience.length > 0;
  const hasEducation = data.education.length > 0;
  const hasSkills = data.skills.length > 0;
  const hasCertifications = data.certifications.length > 0;
  const hasLanguages = data.languages.length > 0;
  const hasProjects = data.projects.length > 0;
  const contactItems = [
    data.personal.email,
    data.personal.phone,
    data.personal.location,
    data.personal.linkedin,
    data.personal.website,
  ]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

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
    <div className="cv-print bg-white px-10 py-12 text-[14px] leading-relaxed text-slate-900">
      <header className="border-b border-slate-200 pb-3">
        <div className="flex flex-col gap-1.5">
          <div>
            <h1 className="font-display text-[33px] font-semibold leading-none tracking-tight">
              {name}
            </h1>
            <p className="mt-0.5 text-[15px] font-normal text-slate-600">{headline}</p>
          </div>
          <div className="text-[12px] text-slate-500">
            {contactItems.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 leading-snug">
                {contactItems.map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className="after:ml-3 after:text-slate-300 after:content-['|'] last:after:content-none"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {hasSummary && (
        <section className="mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Summary</h2>
          </div>
          <p className="mt-2 text-[14px] text-slate-700">{data.personal.summary?.trim()}</p>
        </section>
      )}

      {hasExperience && (
        <section className="mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Experience</h2>
          </div>
          <div className="mt-2.5 space-y-3">
            {data.experience.map((role) => (
              <div key={role.id} className="avoid-break space-y-1 [break-inside:avoid]">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[14px]">
                    <span className="font-semibold">{role.role?.trim() || "Role"}</span>
                    <span className="font-normal text-slate-600">
                      {role.company ? ` | ${role.company.trim()}` : ""}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-normal text-slate-400">
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </span>
                </div>
                {role.location && (
                  <div className="text-[11px] text-slate-400">{role.location.trim()}</div>
                )}
                <ul className="list-disc space-y-0.5 pl-4 text-[12px] leading-snug text-slate-700 marker:text-slate-500">
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
        <section className="mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Education</h2>
          </div>
          <div className="mt-2.5 space-y-2.5">
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
        <section className="mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Skills</h2>
          </div>
          <p className="mt-2 text-[14px] text-slate-700">{data.skills.map(formatSkill).join(" | ")}</p>
        </section>
      )}

      {(hasLanguages || hasCertifications) && (
        <section className="mt-5 grid gap-5 md:grid-cols-2">
          {hasLanguages && (
            <div>
              <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
                <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Languages</h2>
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
                <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Certifications</h2>
              </div>
              <div className="mt-2 space-y-1.5 text-slate-700">
                {data.certifications.map((cert) => (
                  <div key={cert.id} className="avoid-break text-[13px] [break-inside:avoid]">
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
        <section className="mt-5">
          <div className="avoid-orphan border-b border-slate-200 pb-1 [break-after:avoid]">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-700">Projects</h2>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {data.projects.map((project) => (
              <div key={project.id} className="avoid-break [break-inside:avoid]">
                <div className="text-[14px] font-semibold">
                  {project.name?.trim() || "Project"}
                  {project.link ? (
                    <span className="font-normal text-slate-500">{` | ${project.link.trim()}`}</span>
                  ) : null}
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-[12px] leading-snug text-slate-700 marker:text-slate-500">
                  {project.bullets
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
    </div>
  );
};
