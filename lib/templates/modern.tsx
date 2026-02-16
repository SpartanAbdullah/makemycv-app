import type { CvData } from "../types/cv";
import { formatRange, getFullName } from "./utils";

export const ModernTemplate = ({ data }: { data: CvData; plan?: "free" | "pro" }) => {
  const name = getFullName(data) || "Your Name";
  const [firstProject, ...remainingProjects] = data.projects;

  return (
    <div className="cv-print bg-white text-slate-900 px-10 py-10 text-[0.9rem] leading-relaxed">
      <header className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {name}
        </h1>
        <p className="text-sm text-slate-500">
          {data.personal.headline || "Headline"}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {data.personal.email && <span>{data.personal.email}</span>}
          {data.personal.phone && <span>{data.personal.phone}</span>}
          {data.personal.location && <span>{data.personal.location}</span>}
          {data.personal.website && <span>{data.personal.website}</span>}
          {data.personal.linkedin && <span>{data.personal.linkedin}</span>}
        </div>
      </header>

      <div className="mt-6 grid gap-8 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {data.personal.summary && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Profile
              </h2>
              <p className="mt-2 text-sm text-slate-700">{data.personal.summary}</p>
            </section>
          )}

          {data.experience.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Experience
              </h2>
              <div className="mt-3 space-y-4">
                {data.experience.map((role) => (
                  <div key={role.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{role.role || "Role"}</span>
                      <span className="text-xs text-slate-400">
                        {formatRange(role.startDate, role.endDate, role.isCurrent)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {role.company || "Company"}
                      {role.location ? ` - ${role.location}` : ""}
                    </div>
                    <ul className="list-disc pl-5 text-sm text-slate-700 mt-2">
                      {role.bullets.filter(Boolean).map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.projects.length > 0 && (
            <section>
              {firstProject ? (
                <div className="keep-with-next">
                  <h2 className="avoid-orphan text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Projects
                  </h2>
                  <div className="mt-3 text-sm font-semibold">
                    {firstProject.name || "Project"}
                    {firstProject.link ? ` - ${firstProject.link}` : ""}
                  </div>
                </div>
              ) : (
                <h2 className="avoid-orphan text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Projects
                </h2>
              )}
              {firstProject && (
                <ul className="list-disc pl-5 text-sm text-slate-700">
                  {firstProject.bullets.filter(Boolean).map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              )}
              {remainingProjects.length > 0 && (
                <div className="mt-3 space-y-3">
                  {remainingProjects.map((project) => (
                    <div key={project.id}>
                      <div className="text-sm font-semibold">
                        {project.name || "Project"}
                        {project.link ? ` - ${project.link}` : ""}
                      </div>
                      <ul className="list-disc pl-5 text-sm text-slate-700">
                        {project.bullets.filter(Boolean).map((bullet, index) => (
                          <li key={index}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {data.education.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Education
              </h2>
              <div className="mt-3 space-y-3">
                {data.education.map((edu) => (
                  <div key={edu.id}>
                    <div className="text-sm font-semibold">
                      {edu.school || "School"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {edu.degree || "Degree"}
                      {edu.field ? ` - ${edu.field}` : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatRange(edu.startDate, edu.endDate)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.skills.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Skills
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {data.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded-full bg-slate-100 px-3 py-1"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {data.languages.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Languages
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.languages.map((lang) => (
                  <li key={lang.id}>
                    {lang.name}
                    {lang.level ? ` - ${lang.level}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.certifications.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Certifications
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.certifications.map((cert) => (
                  <li key={cert.id}>
                    {cert.name} - {cert.issuer}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

