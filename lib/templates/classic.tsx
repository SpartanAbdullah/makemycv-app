import type { CvData, CvSkill } from "../types/cv";
import { compactContact, formatDateRange } from "../utils/format";
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
  const contactLine = compactContact([
    data.personal.email,
    data.personal.phone,
    data.personal.location,
    data.personal.linkedin,
    data.personal.website,
  ]);

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
    <div className="cv-print bg-white text-slate-900 px-10 py-12 text-[15px] leading-relaxed">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-[34px] font-semibold tracking-tight">
              {name}
            </h1>
            <p className="mt-0.5 text-[17px] text-slate-600">{headline}</p>
          </div>
          <div className="text-[12.5px] text-slate-500 md:text-right">
            {contactLine && <div className="leading-snug">{contactLine}</div>}
          </div>
        </div>
      </header>

      {hasSummary && (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
            Summary
          </h2>
          <p className="mt-2 text-slate-700">{data.personal.summary?.trim()}</p>
        </section>
      )}

      {hasExperience && (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
            Experience
          </h2>
          <div className="mt-3 space-y-4">
            {data.experience.map((role) => (
              <div key={role.id} className="space-y-1 avoid-break">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[15px]">
                    <span className="font-semibold">{role.role?.trim() || "Role"}</span>
                    <span className="text-slate-600 font-normal">
                      {role.company ? ` • ${role.company.trim()}` : ""}
                    </span>
                  </div>
                  <span className="text-[12px] text-slate-500 whitespace-nowrap">
                    {formatDateRange(role.startDate, role.endDate, role.isCurrent)}
                  </span>
                </div>
                {role.location && (
                  <div className="text-[12px] text-slate-500">{role.location.trim()}</div>
                )}
                <ul className="list-disc pl-4 text-[15px] text-slate-700 space-y-0.5 leading-snug">
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
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
            Education
          </h2>
          <div className="mt-3 space-y-3">
            {data.education.map((edu) => (
              <div key={edu.id} className="avoid-break">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[15px] font-semibold text-slate-800">
                    {edu.degree?.trim() || "Degree"}
                    <span className="font-normal text-slate-600">
                      {edu.school ? ` • ${edu.school.trim()}` : ""}
                    </span>
                  </div>
                  <span className="text-[12px] text-slate-500 whitespace-nowrap">
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </span>
                </div>
                {(edu.field || edu.notes) && (
                  <div className="text-[12px] text-slate-500">
                    {edu.field ? <span>{edu.field.trim()}</span> : null}
                    {edu.field && edu.notes ? <span> • </span> : null}
                    {edu.notes ? <span>{edu.notes.trim()}</span> : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {hasSkills && (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
            Skills
          </h2>
          <p className="mt-2 text-slate-700">
            {data.skills.map(formatSkill).join(" • ")}
          </p>
        </section>
      )}

      {(hasLanguages || hasCertifications) && (
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          {hasLanguages && (
            <div>
              <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
                Languages
              </h2>
              <p className="mt-2 text-slate-700">
                {data.languages
                  .map((lang) => formatLanguage(lang.name, lang.level))
                  .join(" • ")}
              </p>
            </div>
          )}
          {hasCertifications && (
            <div>
              <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
                Certifications
              </h2>
              <div className="mt-2 space-y-2 text-slate-700">
                {data.certifications.map((cert) => (
                  <div key={cert.id} className="text-[14px] avoid-break">
                    <span className="font-semibold">{cert.name.trim()}</span>
                    <span className="text-slate-600">
                      {cert.issuer ? ` • ${cert.issuer.trim()}` : ""}
                      {cert.date ? ` • ${cert.date.trim()}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {hasProjects && (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-slate-600 avoid-orphan">
            Projects
          </h2>
          <div className="mt-3 space-y-3">
            {data.projects.map((project) => (
              <div key={project.id} className="avoid-break">
                <div className="text-[15px] font-semibold">
                  {project.name?.trim() || "Project"}
                  {project.link ? (
                    <span className="font-normal text-slate-600">{` • ${project.link.trim()}`}</span>
                  ) : null}
                </div>
                <ul className="list-disc pl-4 text-[15px] text-slate-700 space-y-0.5 leading-snug">
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
