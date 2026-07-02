import type { CvData } from "../types/cv";
import { formatLanguageLevel } from "../language";
import { formatDateRange, normalizeHref } from "../utils/format";
import { meaningfulProjects } from "../utils/projects";
import { meaningfulExperience } from "../utils/experience";
import { meaningfulEducation } from "../utils/education";
import { getFullName } from "./utils";
import { getEssentialChips } from "../utils/essentials";
import { resolveTheme } from "./theme";

export const ModernTemplate = ({
  data,
}: {
  data: CvData;
  plan?: "free" | "pro";
}) => {
  const name = getFullName(data) || "Your Name";
  const theme = resolveTheme(data.settings, "#1e5b54");
  const projects = meaningfulProjects(data.projects);
  const experience = meaningfulExperience(data.experience);
  const education = meaningfulEducation(data.education);
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
        }
      : null,
    data.personal.phone?.trim()
      ? {
          text: data.personal.phone.trim(),
          href: `tel:${data.personal.phone.trim()}`,
        }
      : null,
    data.personal.location?.trim()
      ? { text: data.personal.location.trim() }
      : null,
    data.personal.website?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.website),
          href: normalizeHref(data.personal.website),
        }
      : null,
    data.personal.linkedin?.trim()
      ? {
          text: shortenDisplayUrl(data.personal.linkedin),
          href: normalizeHref(data.personal.linkedin),
        }
      : null,
    data.personal.dateOfBirth?.trim()
      ? { text: `DOB: ${data.personal.dateOfBirth.trim()}` }
      : null,
  ].filter(Boolean) as Array<{ text: string; href?: string }>;

  const essentialChips = getEssentialChips(data.personal);

  return (
    <div
      className="cv-print bg-white text-slate-900 px-8 py-9 text-[0.9rem] leading-relaxed"
      style={{ fontFamily: theme.fontFamily }}
    >
      <header className="border-b border-slate-200 pb-4">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ flex: 1, minWidth: 0 }} className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {name}
            </h1>
            {data.personal.headline?.trim() && (
              <p className="text-sm text-slate-500">
                {data.personal.headline}
              </p>
            )}
            {contactItems.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {contactItems.map((item, index) =>
                  item.href ? (
                    <a
                      key={`${item.text}-${index}`}
                      href={item.href}
                      className="min-w-0 underline decoration-slate-300 underline-offset-2"
                    >
                      <span className="break-words [overflow-wrap:anywhere]">
                        {item.text}
                      </span>
                    </a>
                  ) : (
                    <span
                      key={`${item.text}-${index}`}
                      className="min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      {item.text}
                    </span>
                  ),
                )}
              </div>
            )}
            {essentialChips.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {essentialChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] leading-snug text-slate-700"
                  >
                    <span className="font-semibold uppercase tracking-wider text-emerald-700 text-[9px]">
                      {chip.label}
                    </span>
                    <span>{chip.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {data.personal.photo && data.personal.showPhoto && theme.photoVisible && (
            <div
              style={{
                width: 80,
                height: 80,
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

      <div
        className="mt-6 grid gap-8"
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr" }}
      >
        <div className="space-y-6">
          {data.personal.summary && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Profile
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {data.personal.summary}
              </p>
            </section>
          )}

          {experience.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Experience
              </h2>
              <div className="mt-3 space-y-4">
                {experience.map((role) => (
                  <div
                    key={role.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{role.role || "Role"}</span>
                      <span className="text-xs text-slate-400">
                        {formatDateRange(
                          role.startDate,
                          role.endDate,
                          role.isCurrent,
                        )}
                      </span>
                    </div>
                    {(role.company?.trim() || role.location) && (
                      <div className="text-xs text-slate-500">
                        {role.company?.trim() || ""}
                        {role.company?.trim() && role.location
                          ? ` - ${role.location}`
                          : role.location || ""}
                      </div>
                    )}
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

          {data.languages.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Languages
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.languages.map((lang) => (
                  <li key={lang.id}>
                    <span className="font-semibold">{lang.name}</span>
                    {lang.level
                      ? ` — ${formatLanguageLevel(lang.level)}`
                      : ""}
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
                    {cert.name}
                    {cert.issuer || cert.date
                      ? ` — ${[cert.issuer, cert.date]
                          .filter(Boolean)
                          .join(" · ")}`
                      : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {projects.length > 0 && (
            <section>
              {projects.map((project, index) => {
                const bullets = (project.bullets ?? []).filter(Boolean);
                const [firstBullet, ...remainingBullets] = bullets;
                const showLink = shouldShowProjectLink(project.link);
                const titleRow = (
                  <div
                    className={`${index === 0 ? "mt-3 " : ""}text-sm font-semibold`}
                  >
                    {project.name || "Project"}
                    {showLink ? (
                      <a
                        href={normalizeHref(project.link)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-slate-300 underline-offset-2 [overflow-wrap:anywhere]"
                      >{` - ${project.link?.trim()}`}</a>
                    ) : (
                      ""
                    )}
                  </div>
                );

                if (index === 0) {
                  return (
                    <div key={project.id}>
                      <div className="keep-with-next">
                        <h2 className="avoid-orphan text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Projects
                        </h2>
                        {titleRow}
                        {firstBullet && (
                          <ul className="list-disc pl-5 text-sm text-slate-700">
                            <li>{firstBullet}</li>
                          </ul>
                        )}
                      </div>
                      {remainingBullets.length > 0 && (
                        <ul className="list-disc pl-5 text-sm text-slate-700">
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
                        <ul className="list-disc pl-5 text-sm text-slate-700">
                          <li>{firstBullet}</li>
                        </ul>
                      )}
                    </div>
                    {remainingBullets.length > 0 && (
                      <ul className="list-disc pl-5 text-sm text-slate-700">
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

        <aside className="space-y-6" style={{ width: "200px", flexShrink: 0 }}>
          {education.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Education
              </h2>
              <div className="mt-3 space-y-3">
                {education.map((edu) => (
                  <div key={edu.id}>
                    <div className="text-sm font-semibold">
                      {edu.school || "School"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {edu.degree || "Degree"}
                      {edu.field ? ` - ${edu.field}` : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </div>
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
        </aside>
      </div>
    </div>
  );
};
