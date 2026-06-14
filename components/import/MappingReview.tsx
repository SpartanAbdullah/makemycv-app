"use client";

import { useId, useState } from "react";
import type { ParsedDocument } from "../../lib/importers/adapter";
import type {
  CvCertification,
  CvData,
  CvEducation,
  CvExperience,
  CvPersonal,
} from "../../lib/types/cv";
import { mapParsedToCv } from "../../lib/importers/fieldMapper";
import { getDir } from "../../lib/utils/rtl";

// The import pipeline is heuristic — role ↔ company and school ↔ degree
// sometimes get swapped, locations can end up in company, etc. Rather than
// silently committing the wrong values into the Zustand store, every parsed
// field is shown here as an EDITABLE input. The user reviews, corrects, and
// confirms; only the corrected `edited` state is passed to `onConfirm`.
//
// Scope is intentionally narrow: edit / clear / delete / swap on the
// already-detected items. Adding new entries that the parser missed is not
// supported here — the user can do that in the regular builder after import.

type MergeMode = "replace" | "merge";

type EditableCv = Partial<CvData>;

type Props = {
  source: string;
  parsed: ParsedDocument;
  onConfirm: (data: EditableCv, mode: MergeMode) => void;
  onCancel: () => void;
};

export const MappingReview = ({ source, parsed, onConfirm, onCancel }: Props) => {
  // Seed once from the initial mapping. MappingReview re-mounts on each
  // import (parent toggles its `phase === "review"` conditional), so a fresh
  // file always re-seeds — no stale-state risk.
  const [edited, setEdited] = useState<EditableCv>(() => mapParsedToCv(parsed));
  const [mode, setMode] = useState<MergeMode>("replace");

  // ── Personal / contact updaters ────────────────────────────────────────
  const updatePersonal = (
    key: keyof CvPersonal,
    value: string,
  ) => {
    setEdited((prev) => ({
      ...prev,
      personal: {
        ...(prev.personal ?? blankPersonal()),
        [key]: value,
      },
    }));
  };

  // ── Experience updaters ────────────────────────────────────────────────
  const updateExperience = (
    idx: number,
    patch: Partial<CvExperience>,
  ) => {
    setEdited((prev) => {
      const list = [...(prev.experience ?? [])];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, experience: list };
    });
  };

  const updateExperienceBullet = (
    expIdx: number,
    bulletIdx: number,
    value: string,
  ) => {
    setEdited((prev) => {
      const list = [...(prev.experience ?? [])];
      const exp = list[expIdx];
      if (!exp) return prev;
      const bullets = [...exp.bullets];
      bullets[bulletIdx] = value;
      list[expIdx] = { ...exp, bullets };
      return { ...prev, experience: list };
    });
  };

  const removeExperienceBullet = (expIdx: number, bulletIdx: number) => {
    setEdited((prev) => {
      const list = [...(prev.experience ?? [])];
      const exp = list[expIdx];
      if (!exp) return prev;
      list[expIdx] = {
        ...exp,
        bullets: exp.bullets.filter((_, i) => i !== bulletIdx),
      };
      return { ...prev, experience: list };
    });
  };

  const removeExperience = (idx: number) => {
    setEdited((prev) => ({
      ...prev,
      experience: (prev.experience ?? []).filter((_, i) => i !== idx),
    }));
  };

  const swapRoleCompany = (idx: number) => {
    setEdited((prev) => {
      const list = [...(prev.experience ?? [])];
      const e = list[idx];
      if (!e) return prev;
      list[idx] = { ...e, role: e.company, company: e.role };
      return { ...prev, experience: list };
    });
  };

  // ── Education updaters ─────────────────────────────────────────────────
  const updateEducation = (idx: number, patch: Partial<CvEducation>) => {
    setEdited((prev) => {
      const list = [...(prev.education ?? [])];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, education: list };
    });
  };

  const removeEducation = (idx: number) => {
    setEdited((prev) => ({
      ...prev,
      education: (prev.education ?? []).filter((_, i) => i !== idx),
    }));
  };

  const swapSchoolDegree = (idx: number) => {
    setEdited((prev) => {
      const list = [...(prev.education ?? [])];
      const e = list[idx];
      if (!e) return prev;
      list[idx] = { ...e, school: e.degree, degree: e.school };
      return { ...prev, education: list };
    });
  };

  // ── Skill / language list updaters ─────────────────────────────────────
  const removeSkill = (idx: number) => {
    setEdited((prev) => ({
      ...prev,
      skills: (prev.skills ?? []).filter((_, i) => i !== idx),
    }));
  };

  const removeLanguage = (idx: number) => {
    setEdited((prev) => ({
      ...prev,
      languages: (prev.languages ?? []).filter((_, i) => i !== idx),
    }));
  };

  // ── Certification updaters ─────────────────────────────────────────────
  const updateCertification = (
    idx: number,
    patch: Partial<CvCertification>,
  ) => {
    setEdited((prev) => {
      const list = [...(prev.certifications ?? [])];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, certifications: list };
    });
  };

  const removeCertification = (idx: number) => {
    setEdited((prev) => ({
      ...prev,
      certifications: (prev.certifications ?? []).filter((_, i) => i !== idx),
    }));
  };

  // ── Projects updaters ───────────────────────────────────────────────────
  const updateProject = (
    idx: number,
    patch: Partial<NonNullable<EditableCv["projects"]>[number]>,
  ) => {
    setEdited((prev) => {
      const list = [...(prev.projects ?? [])];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, projects: list };
    });
  };

  const removeProject = (idx: number) => {
    setEdited((prev) => ({
      ...prev,
      projects: (prev.projects ?? []).filter((_, i) => i !== idx),
    }));
  };

  // ── Counts (footer button label + "no data" message) ───────────────────
  const sectionCount = [
    edited.personal?.firstName || edited.personal?.email ? 1 : 0,
    edited.experience?.length ?? 0,
    edited.education?.length ?? 0,
    edited.skills?.length ? 1 : 0,
    edited.languages?.length ? 1 : 0,
    edited.certifications?.length ? 1 : 0,
    edited.projects?.length ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const hasPersonal = Boolean(
    edited.personal &&
      (edited.personal.firstName ||
        edited.personal.lastName ||
        edited.personal.email ||
        edited.personal.phone ||
        edited.personal.location ||
        edited.personal.linkedin ||
        edited.personal.website ||
        edited.personal.summary),
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Import from ${source} — review and edit before import`}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Import from {source}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-slate-900">
              Review &amp; edit extracted fields
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {sectionCount === 0
                ? "No fields could be extracted. Try a different file."
                : "Fix anything that looks wrong, then confirm to import. Common mis-mappings: role ↔ company, school ↔ degree."}
            </p>
            {sectionCount > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                We can&apos;t read visa status, notice period, nationality or
                projects from files — you&apos;ll add those in the next steps.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cancel import"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {sectionCount === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No structured content was detected. The file may be image-based
              or use an unsupported layout.
            </div>
          )}

          {/* Contact */}
          {hasPersonal && (
            <Section title="Contact information">
              <Grid>
                <TextField
                  label="First name"
                  value={edited.personal?.firstName ?? ""}
                  onChange={(v) => updatePersonal("firstName", v)}
                />
                <TextField
                  label="Last name"
                  value={edited.personal?.lastName ?? ""}
                  onChange={(v) => updatePersonal("lastName", v)}
                />
                <TextField
                  label="Headline"
                  hint="Seeded from your most recent role — edit if it grabbed a company name."
                  value={edited.personal?.headline ?? ""}
                  onChange={(v) => updatePersonal("headline", v)}
                  fullSpan
                />
                <TextField
                  label="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={edited.personal?.email ?? ""}
                  onChange={(v) => updatePersonal("email", v)}
                />
                <TextField
                  label="Phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={edited.personal?.phone ?? ""}
                  onChange={(v) => updatePersonal("phone", v)}
                />
                <TextField
                  label="Location"
                  value={edited.personal?.location ?? ""}
                  onChange={(v) => updatePersonal("location", v)}
                />
                <TextField
                  label="LinkedIn"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={edited.personal?.linkedin ?? ""}
                  onChange={(v) => updatePersonal("linkedin", v)}
                />
                <TextField
                  label="Website"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={edited.personal?.website ?? ""}
                  onChange={(v) => updatePersonal("website", v)}
                  fullSpan
                />
              </Grid>
            </Section>
          )}

          {/* Summary */}
          {edited.personal?.summary !== undefined && (
            <Section title="Summary">
              <textarea
                className="min-h-[6rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                value={edited.personal.summary}
                dir={getDir(edited.personal.summary)}
                onChange={(e) => updatePersonal("summary", e.target.value)}
                placeholder="Empty — leave blank to skip, or paste a 2–3 line professional summary."
              />
            </Section>
          )}

          {/* Experience */}
          {edited.experience?.length ? (
            <Section title={`Work experience (${edited.experience.length})`}>
              <div className="space-y-3">
                {edited.experience.map((exp, i) => (
                  <ExperienceCard
                    key={exp.id}
                    index={i}
                    exp={exp}
                    onPatch={(patch) => updateExperience(i, patch)}
                    onPatchBullet={(b, v) => updateExperienceBullet(i, b, v)}
                    onRemoveBullet={(b) => removeExperienceBullet(i, b)}
                    onSwap={() => swapRoleCompany(i)}
                    onRemove={() => removeExperience(i)}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Education */}
          {edited.education?.length ? (
            <Section title={`Education (${edited.education.length})`}>
              <div className="space-y-3">
                {edited.education.map((edu, i) => (
                  <EducationCard
                    key={edu.id}
                    edu={edu}
                    onPatch={(patch) => updateEducation(i, patch)}
                    onSwap={() => swapSchoolDegree(i)}
                    onRemove={() => removeEducation(i)}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Skills */}
          {edited.skills?.length ? (
            <Section title={`Skills (${edited.skills.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {edited.skills.map((s, i) => (
                  <Chip key={s.id} label={s.name} onRemove={() => removeSkill(i)} />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Languages */}
          {edited.languages?.length ? (
            <Section title={`Languages (${edited.languages.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {edited.languages.map((l, i) => (
                  <Chip key={l.id} label={l.name} onRemove={() => removeLanguage(i)} />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Certifications */}
          {edited.certifications?.length ? (
            <Section title={`Certifications (${edited.certifications.length})`}>
              <div className="space-y-3">
                {edited.certifications.map((c, i) => (
                  <CertificationCard
                    key={c.id}
                    cert={c}
                    onPatch={(patch) => updateCertification(i, patch)}
                    onRemove={() => removeCertification(i)}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Projects — kept by the wave-3 parser instead of discarded */}
          {edited.projects?.length ? (
            <Section title={`Projects (${edited.projects.length})`}>
              <div className="space-y-3">
                {edited.projects.map((p, i) => (
                  <EntryShell key={p.id} index={i} onRemove={() => removeProject(i)}>
                    <Grid>
                      <TextField
                        label="Project name"
                        value={p.name}
                        onChange={(v) => updateProject(i, { name: v })}
                      />
                      <TextField
                        label="Link"
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        value={p.link ?? ""}
                        onChange={(v) => updateProject(i, { link: v })}
                      />
                    </Grid>
                    {p.bullets.filter(Boolean).length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {p.bullets.map((b, bi) => (
                          <input
                            key={bi}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                            value={b}
                            dir={getDir(b)}
                            onChange={(e) => {
                              const bullets = [...p.bullets];
                              bullets[bi] = e.target.value;
                              updateProject(i, { bullets });
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </EntryShell>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Unplaced content — never silently dropped (audit Wave 3) */}
          {(parsed.unplaced?.length ?? 0) > 0 && (
            <Section title="We couldn't place this">
              <p className="mb-2 text-xs text-slate-500">
                Lines we found in the file but couldn&apos;t map to a field.
                Nothing here will be imported — copy anything you need into
                the builder after confirming.
              </p>
              <textarea
                readOnly
                rows={Math.min(6, (parsed.unplaced?.length ?? 0) + 1)}
                className="w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
                value={(parsed.unplaced ?? []).join("\n")}
              />
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="mergeMode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="accent-slate-900"
              />
              <span className="text-slate-700 font-medium">Replace current CV</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="mergeMode"
                value="merge"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
                className="accent-slate-900"
              />
              <span className="text-slate-700 font-medium">Merge into current CV</span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={sectionCount === 0}
              onClick={() => onConfirm(edited, mode)}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Import
              {sectionCount > 0 ? ` (${sectionCount} section${sectionCount !== 1 ? "s" : ""})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Small reusable building blocks ────────────────────────────────────────

function blankPersonal(): CvPersonal {
  return {
    firstName: "",
    lastName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
    summary: "",
  };
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
      {title}
    </p>
    {children}
  </div>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
    {children}
  </div>
);

const TextField = ({
  label,
  hint,
  value,
  onChange,
  fullSpan,
  type,
  inputMode,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  fullSpan?: boolean;
  type?: "text" | "email" | "tel" | "url";
  inputMode?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
}) => {
  // Programmatically associate the label with the input (was a bare <label>).
  const id = useId();
  return (
    <div className={fullSpan ? "sm:col-span-2" : ""}>
      <label
        htmlFor={id}
        className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
        value={value}
        dir={getDir(value)}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
};

const Chip = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
    dir={getDir(label)}
  >
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
    >
      ×
    </button>
  </span>
);

// ── Editable cards ────────────────────────────────────────────────────────

const EntryShell = ({
  index,
  onSwap,
  swapLabel,
  onRemove,
  children,
}: {
  index?: number;
  onSwap?: () => void;
  swapLabel?: string;
  onRemove: () => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Entry {typeof index === "number" ? index + 1 : ""}
      </span>
      <div className="flex items-center gap-1">
        {onSwap && swapLabel ? (
          <button
            type="button"
            onClick={onSwap}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
            title="Swap if the parser put values in the wrong slots"
          >
            ⇄ {swapLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
          title="Drop this entry from the import"
        >
          Delete
        </button>
      </div>
    </div>
    {children}
  </div>
);

const ExperienceCard = ({
  index,
  exp,
  onPatch,
  onPatchBullet,
  onRemoveBullet,
  onSwap,
  onRemove,
}: {
  index: number;
  exp: CvExperience;
  onPatch: (patch: Partial<CvExperience>) => void;
  onPatchBullet: (bulletIdx: number, value: string) => void;
  onRemoveBullet: (bulletIdx: number) => void;
  onSwap: () => void;
  onRemove: () => void;
}) => (
  <EntryShell
    index={index}
    onSwap={onSwap}
    swapLabel="Role ↔ Company"
    onRemove={onRemove}
  >
    <Grid>
      <TextField
        label="Role"
        value={exp.role}
        onChange={(v) => onPatch({ role: v })}
      />
      <TextField
        label="Company"
        value={exp.company}
        onChange={(v) => onPatch({ company: v })}
      />
      <TextField
        label="Location"
        value={exp.location}
        onChange={(v) => onPatch({ location: v })}
      />
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Currently working here
        </label>
        <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="accent-slate-900"
            checked={exp.isCurrent}
            onChange={(e) =>
              onPatch({
                isCurrent: e.target.checked,
                endDate: e.target.checked ? "Present" : exp.endDate,
              })
            }
          />
          Present
        </label>
      </div>
      <TextField
        label="Start"
        value={exp.startDate}
        onChange={(v) => onPatch({ startDate: v })}
      />
      <TextField
        label="End"
        value={exp.endDate}
        onChange={(v) => onPatch({ endDate: v })}
      />
    </Grid>

    {exp.bullets.length > 0 ? (
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Achievements ({exp.bullets.length})
        </p>
        <div className="space-y-1.5">
          {exp.bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                value={b}
                dir={getDir(b)}
                onChange={(e) => onPatchBullet(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => onRemoveBullet(i)}
                aria-label="Remove bullet"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </EntryShell>
);

const EducationCard = ({
  edu,
  onPatch,
  onSwap,
  onRemove,
}: {
  edu: CvEducation;
  onPatch: (patch: Partial<CvEducation>) => void;
  onSwap: () => void;
  onRemove: () => void;
}) => (
  <EntryShell onSwap={onSwap} swapLabel="School ↔ Degree" onRemove={onRemove}>
    <Grid>
      <TextField
        label="School"
        value={edu.school}
        onChange={(v) => onPatch({ school: v })}
      />
      <TextField
        label="Degree"
        value={edu.degree}
        onChange={(v) => onPatch({ degree: v })}
      />
      <TextField
        label="Field of study"
        value={edu.field}
        onChange={(v) => onPatch({ field: v })}
      />
      <TextField
        label="Notes"
        value={edu.notes ?? ""}
        onChange={(v) => onPatch({ notes: v })}
      />
      <TextField
        label="Start"
        value={edu.startDate}
        onChange={(v) => onPatch({ startDate: v })}
      />
      <TextField
        label="End"
        value={edu.endDate}
        onChange={(v) => onPatch({ endDate: v })}
      />
    </Grid>
  </EntryShell>
);

const CertificationCard = ({
  cert,
  onPatch,
  onRemove,
}: {
  cert: CvCertification;
  onPatch: (patch: Partial<CvCertification>) => void;
  onRemove: () => void;
}) => (
  <EntryShell onRemove={onRemove}>
    <Grid>
      <TextField
        label="Name"
        value={cert.name}
        onChange={(v) => onPatch({ name: v })}
        fullSpan
      />
      <TextField
        label="Issuer"
        value={cert.issuer}
        onChange={(v) => onPatch({ issuer: v })}
      />
      <TextField
        label="Date"
        value={cert.date ?? ""}
        onChange={(v) => onPatch({ date: v })}
      />
    </Grid>
  </EntryShell>
);
