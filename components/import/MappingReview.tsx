"use client";

import { useState } from "react";
import type { ParsedDocument } from "../../lib/importers/adapter";
import type { CvData } from "../../lib/types/cv";
import { mapParsedToCv } from "../../lib/importers/fieldMapper";
import { getDir } from "../../lib/utils/rtl";

type MergeMode = "replace" | "merge";

type Props = {
  source: string;
  parsed: ParsedDocument;
  onConfirm: (data: Partial<CvData>, mode: MergeMode) => void;
  onCancel: () => void;
};

export const MappingReview = ({ source, parsed, onConfirm, onCancel }: Props) => {
  const mapped = mapParsedToCv(parsed);
  const [mode, setMode] = useState<MergeMode>("replace");

  const sectionCount = [
    mapped.personal?.firstName || mapped.personal?.email ? 1 : 0,
    mapped.experience?.length ?? 0,
    mapped.education?.length ?? 0,
    mapped.skills?.length ? 1 : 0,
    mapped.languages?.length ? 1 : 0,
    mapped.certifications?.length ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Import from ${source} — mapping review`}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Import from {source}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-slate-900">
              Review extracted fields
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {sectionCount === 0
                ? "No fields could be extracted. Try a different file."
                : `Found ${sectionCount} section${sectionCount !== 1 ? "s" : ""}. Confirm to import.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cancel import"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {sectionCount === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No structured content was detected. The file may be image-based
              or use an unsupported layout.
            </div>
          )}

          {/* Contact */}
          {mapped.personal && (mapped.personal.firstName || mapped.personal.email) && (
            <Section title="Contact Information">
              <Grid>
                {mapped.personal.firstName && (
                  <KV label="Name">
                    {mapped.personal.firstName} {mapped.personal.lastName}
                  </KV>
                )}
                {mapped.personal.email && (
                  <KV label="Email">{mapped.personal.email}</KV>
                )}
                {mapped.personal.phone && (
                  <KV label="Phone">{mapped.personal.phone}</KV>
                )}
                {mapped.personal.location && (
                  <KV label="Location">{mapped.personal.location}</KV>
                )}
                {mapped.personal.linkedin && (
                  <KV label="LinkedIn">{mapped.personal.linkedin}</KV>
                )}
                {mapped.personal.website && (
                  <KV label="Website">{mapped.personal.website}</KV>
                )}
              </Grid>
            </Section>
          )}

          {/* Summary */}
          {mapped.personal?.summary && (
            <Section title="Summary">
              <p
                className="text-sm text-slate-700 leading-relaxed"
                dir={getDir(mapped.personal.summary)}
              >
                {mapped.personal.summary}
              </p>
            </Section>
          )}

          {/* Experience */}
          {mapped.experience?.length ? (
            <Section title={`Work Experience (${mapped.experience.length})`}>
              <div className="space-y-3">
                {mapped.experience.map((exp, i) => (
                  <ExperienceCard key={i} exp={exp} />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Education */}
          {mapped.education?.length ? (
            <Section title={`Education (${mapped.education.length})`}>
              <div className="space-y-3">
                {mapped.education.map((edu, i) => (
                  <EducationCard key={i} edu={edu} />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Skills */}
          {mapped.skills?.length ? (
            <Section title={`Skills (${mapped.skills.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {mapped.skills.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                    dir={getDir(s.name)}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Languages */}
          {mapped.languages?.length ? (
            <Section title={`Languages (${mapped.languages.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {mapped.languages.map((l) => (
                  <span
                    key={l.id}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Certifications */}
          {mapped.certifications?.length ? (
            <Section title={`Certifications (${mapped.certifications.length})`}>
              <div className="space-y-1">
                {mapped.certifications.map((c) => (
                  <p key={c.id} className="text-sm text-slate-700">
                    {c.name}
                    {c.issuer ? ` — ${c.issuer}` : ""}
                    {c.date ? ` (${c.date})` : ""}
                  </p>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          {/* Merge mode */}
          <div className="mb-4 flex gap-3">
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

          <div className="flex gap-3 justify-end">
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
              onClick={() => onConfirm(mapped, mode)}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Import {sectionCount > 0 ? `(${sectionCount} section${sectionCount !== 1 ? "s" : ""})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Sub-components --------------------------------------------------------

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
  <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
);

const KV = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-sm text-slate-800">{children}</p>
  </div>
);

const ExperienceCard = ({
  exp,
}: {
  exp: NonNullable<ReturnType<typeof mapParsedToCv>["experience"]>[number];
}) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-sm font-semibold text-slate-800">
      {exp.role || "(Role not detected)"}
    </p>
    <p className="text-xs text-slate-500">
      {exp.company || "(Company not detected)"}
      {exp.location ? ` · ${exp.location}` : ""}
    </p>
    <p className="mt-0.5 text-xs text-slate-400">
      {exp.startDate || "—"} → {exp.isCurrent ? "Present" : exp.endDate || "—"}
    </p>
    {exp.bullets?.length > 0 && (
      <ul className="mt-2 list-disc pl-4 space-y-0.5">
        {exp.bullets.map((b, i) => (
          <li key={i} className="text-xs text-slate-600" dir={getDir(b)}>
            {b}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const EducationCard = ({
  edu,
}: {
  edu: NonNullable<ReturnType<typeof mapParsedToCv>["education"]>[number];
}) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-sm font-semibold text-slate-800">
      {edu.school || "(School not detected)"}
    </p>
    <p className="text-xs text-slate-500">
      {[edu.degree, edu.field].filter(Boolean).join(", ") || "(Degree not detected)"}
    </p>
    <p className="mt-0.5 text-xs text-slate-400">
      {edu.startDate || "—"} → {edu.endDate || "—"}
    </p>
  </div>
);
