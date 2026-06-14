"use client";

import { Icon } from "../builder/Icon";
import type { CvSkill } from "../../lib/types/cv";

/**
 * "Download for this job" — focus the CV's skills on the matched role (drop the
 * irrelevant ones) and download a tailored copy, WITHOUT touching the master CV.
 * The master keeps every skill; this is a per-job output. Hidden skills are one
 * tap away from being kept, so nothing is ever lost.
 */
export const JdTailor = ({
  focused,
  onToggleFocus,
  totalSkills,
  hiddenSkills,
  onKeep,
  onDownloadPdf,
  onDownloadDocx,
  downloading,
  error,
}: {
  focused: boolean;
  onToggleFocus: (next: boolean) => void;
  totalSkills: number;
  hiddenSkills: CvSkill[];
  onKeep: (name: string) => void;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
  downloading: boolean;
  error: string | null;
}) => {
  const kept = totalSkills - hiddenSkills.length;

  return (
    <div
      style={{
        background: "var(--ff-card)",
        border: "1px solid var(--ff-line)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              display: "grid", placeItems: "center", background: "var(--ff-accent-soft)",
            }}
          >
            <Icon name="download" size={15} color="var(--ff-accent-dark)" />
          </span>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--ff-ink)" }}>
            Download for this job
          </div>
        </div>

        {/* Focus toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={focused}
          onClick={() => onToggleFocus(!focused)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 10px 6px 12px", borderRadius: 999, cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600,
            border: `1px solid ${focused ? "var(--ff-accent)" : "var(--ff-line-strong)"}`,
            background: focused ? "var(--ff-accent-soft)" : "var(--ff-card)",
            color: focused ? "var(--ff-accent-dark)" : "var(--ff-muted)",
          }}
        >
          Focus skills on this job
          <span
            style={{
              width: 30, height: 18, borderRadius: 999, position: "relative", flexShrink: 0,
              background: focused ? "var(--ff-accent-dark)" : "var(--ff-line-strong)",
              transition: "background 160ms",
            }}
          >
            <span
              style={{
                position: "absolute", top: 2, left: focused ? 14 : 2, width: 14, height: 14,
                borderRadius: "50%", background: "#fff", transition: "left 160ms",
              }}
            />
          </span>
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--ff-muted)", lineHeight: 1.55, margin: "12px 0 0" }}>
        {focused ? (
          <>
            Keeping the <strong style={{ color: "var(--ff-ink-2)" }}>{kept}</strong> of {totalSkills} skills
            relevant to this role.{" "}
            <span style={{ color: "var(--ff-faint)" }}>Your master CV keeps all {totalSkills} — this only changes the copy you download.</span>
          </>
        ) : (
          <>
            Your CV lists <strong style={{ color: "var(--ff-ink-2)" }}>{totalSkills}</strong> skills. Turn on focus to
            keep just the ones this job asks for — your master CV is never changed.
          </>
        )}
      </p>

      {focused && hiddenSkills.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ff-muted)", marginBottom: 8 }}>
            Hidden for this job ({hiddenSkills.length}) — tap to keep
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {hiddenSkills.map((s) => (
              <button
                key={s.id}
                type="button"
                title={`Keep “${s.name}” on this version`}
                onClick={() => onKeep(s.name)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 999, cursor: "pointer",
                  fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ff-muted)",
                  background: "var(--ff-sunken)", border: "1px dashed var(--ff-line-strong)",
                }}
              >
                <Icon name="plus" size={10} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          className="cv-btn-primary"
          style={{ padding: "11px 18px", opacity: downloading ? 0.6 : 1, cursor: downloading ? "not-allowed" : "pointer" }}
          onClick={onDownloadPdf}
          disabled={downloading}
        >
          <Icon name="download" size={14} />
          {downloading ? "Preparing…" : focused ? "Download tailored CV" : "Download CV"}
        </button>
        <button
          type="button"
          className="cv-btn-secondary"
          style={{ padding: "11px 16px", opacity: downloading ? 0.6 : 1, cursor: downloading ? "not-allowed" : "pointer" }}
          onClick={onDownloadDocx}
          disabled={downloading}
        >
          Word (.docx)
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: "var(--ff-red)", fontWeight: 500, margin: "10px 0 0" }}>{error}</p>
      )}
    </div>
  );
};
