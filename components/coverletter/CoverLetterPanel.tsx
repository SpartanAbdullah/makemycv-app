"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useCoverLetter } from "../../hooks/useCoverLetter";
import {
  COVER_LETTER_LIMITS,
  buildCoverLetterRequest,
  buildCvExcerpt,
  excerptIsUsable,
} from "../../lib/coverLetter/payload";
import { exportCoverLetterDocx } from "../../lib/coverLetter/docx";
import { hasPlaceholder } from "../../lib/ai/placeholders";
import { track } from "../../lib/analytics";
import { PLACEHOLDER_HINT, PlaceholderText } from "../ai/PlaceholderText";
import { Field } from "../forms/Field";
import { Icon } from "../builder/Icon";
import { Logo } from "../Logo";

/**
 * Cover letter v1 (2026-10-24, audit WP-9) — product #2 in CLAUDE.md.
 *
 * Flow: job details (company, title, optional hiring manager + job ad) →
 * one click → a 3-paragraph letter written ONLY from an excerpt of the CV →
 * edit in place → copy or download as .docx.
 *
 * Privacy: this is the first feature that sends CV text to a server, so the
 * disclosure is on the page, above the button, in the same words as
 * lib/coverLetter/payload.ts (which decides the excerpt). Keep the two in sync.
 *
 * Truthfulness: {{number}} placeholders come back highlighted; copy and
 * download stay disabled until the user replaces every one.
 */

const SEED_KEY = "makemycv:coverLetterSeed";
type Seed = { v: 1; jobTitle?: string; jobText?: string };

/** JD Match hands the role title + pasted ad across in sessionStorage (tab-local, never the CV). */
export function stashCoverLetterSeed(seed: Omit<Seed, "v">) {
  try {
    window.sessionStorage.setItem(SEED_KEY, JSON.stringify({ v: 1, ...seed }));
  } catch {
    /* storage unavailable — the page simply starts blank */
  }
}

const readSeed = (): Seed | null => {
  try {
    const raw = window.sessionStorage.getItem(SEED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Seed>;
    return parsed?.v === 1 ? (parsed as Seed) : null;
  } catch {
    return null;
  }
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--ff-line)",
  background: "var(--ff-card)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--ff-ink)",
};

export const CoverLetterPanel = () => {
  const router = useRouter();
  const cv = useCvStore((s) => s.data);
  const hydrated = useCvStore((s) => s.hydrated);
  const jdTarget = useCvStore((s) => s.jdTarget);
  const { letter: generated, isLoading, error, generate } = useCoverLetter();

  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [jobText, setJobText] = useState("");
  const [showJobText, setShowJobText] = useState(false);
  const [letter, setLetter] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    bindCvStorage();
  }, []);

  // Prefill from JD Match (same tab) or the stored JD target. Only fills
  // empty inputs so a user's own typing is never overwritten.
  useEffect(() => {
    if (!hydrated) return;
    const seed = readSeed();
    setJobTitle((v) => v || seed?.jobTitle || jdTarget?.jobTitle || "");
    if (seed?.jobText) {
      setJobText((v) => v || seed.jobText || "");
      setShowJobText(true);
    }
  }, [hydrated, jdTarget?.jobTitle]);

  useEffect(() => {
    if (generated !== null) {
      setLetter(generated);
      setEditing(false);
    }
  }, [generated]);

  const excerpt = useMemo(() => buildCvExcerpt(cv), [cv]);
  const cvUsable = excerptIsUsable(excerpt);
  const canGenerate = cvUsable && company.trim().length > 0 && jobTitle.trim().length > 0 && !isLoading;
  const blocked = hasPlaceholder(letter);
  const placeholderCount = useMemo(() => (letter.match(/\{\{\s*[a-z][a-z _-]*\s*\}\}/gi) ?? []).length, [letter]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    const req = buildCoverLetterRequest(cv, { company, jobTitle, hiringManager, jobText });
    const out = await generate(req);
    track("cover_letter_generate", {
      outcome: out ? "ok" : "error",
      with_job_text: req.jobText.length > 0,
      placeholders: out ? (out.match(/\{\{/g) ?? []).length : 0,
    });
  };

  const handleCopy = async () => {
    if (blocked || !letter.trim()) return;
    try {
      await navigator.clipboard.writeText(letter.trim());
      setCopied(true);
      track("cover_letter_export", { format: "copy" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is still selectable in edit mode */
      setEditing(true);
    }
  };

  const handleDocx = async () => {
    if (blocked || !letter.trim() || exporting) return;
    setExporting(true);
    try {
      await exportCoverLetterDocx({ letter: letter.trim(), cv, company, jobTitle });
      track("cover_letter_export", { format: "docx" });
    } finally {
      setExporting(false);
    }
  };

  const excerptSummary = [
    excerpt.headline && "your headline",
    excerpt.summary && "your summary",
    excerpt.latestRole && `your latest role (${excerpt.latestRole.title || "untitled"}${excerpt.latestRole.bullets.length ? `, ${excerpt.latestRole.bullets.length} bullet${excerpt.latestRole.bullets.length === 1 ? "" : "s"}` : ""})`,
    excerpt.skills.length && `${excerpt.skills.length} skill${excerpt.skills.length === 1 ? "" : "s"}`,
    (excerpt.visaStatus || excerpt.availability) && "your visa / availability line",
  ].filter(Boolean) as string[];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          rowGap: 8,
          padding: "10px 20px",
          flexShrink: 0,
          background: "var(--ff-card)",
          borderBottom: "1px solid var(--ff-line)",
        }}
      >
        <Logo variant="horizontal" height={32} href={null} />
        <button
          type="button"
          onClick={() => router.push("/builder")}
          className="cv-btn-secondary"
          style={{ height: "var(--topbar-control-h)", padding: "0 16px" }}
        >
          <Icon name="chevron-left" size={14} />
          Back to the builder
        </button>
      </header>

      <div style={{ width: "100%", maxWidth: 820, margin: "0 auto", padding: "24px 16px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--ff-ink)", margin: 0 }}>
            Cover letter
          </h1>
          <p style={{ fontSize: 14, color: "var(--ff-muted)", marginTop: 6, lineHeight: 1.5 }}>
            Three short paragraphs, written only from what is already in your CV. Nothing is invented: where a
            figure would help, you get a <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{"{{number}}"}</code>{" "}
            to fill in yourself.
          </p>
        </div>

        {hydrated && !cvUsable && (
          <div
            role="status"
            style={{ padding: 16, borderRadius: 14, background: "var(--ff-card)", border: "1px solid var(--ff-line)", display: "flex", flexDirection: "column", gap: 10 }}
          >
            <strong style={{ fontSize: 15, color: "var(--ff-ink)" }}>Your CV is empty on this device</strong>
            <span style={{ fontSize: 13, color: "var(--ff-muted)", lineHeight: 1.5 }}>
              The letter is written from your CV — add at least a role, a summary or a few skills first.
            </span>
            <button type="button" className="cv-btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/builder")}>
              Build my CV
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleGenerate();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18, borderRadius: 16, background: "var(--ff-card)", boxShadow: "var(--shadow-float)" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <Field label="Company" required>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={COVER_LETTER_LIMITS.company}
                placeholder="e.g. Emirates NBD"
                autoComplete="organization"
                style={inputStyle}
              />
            </Field>
            <Field label="Job title" required>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={COVER_LETTER_LIMITS.jobTitle}
                placeholder="e.g. Operations Manager"
                autoComplete="organization-title"
                style={inputStyle}
              />
            </Field>
            <Field label="Hiring manager" optional hint="Leave blank for “Dear Hiring Manager”.">
              <input
                value={hiringManager}
                onChange={(e) => setHiringManager(e.target.value)}
                maxLength={COVER_LETTER_LIMITS.hiringManager}
                placeholder="e.g. Ms. Fatima Al Ali"
                style={inputStyle}
              />
            </Field>
          </div>

          {showJobText ? (
            <Field label="Job ad" optional hint="Used to see what the employer wants — never as a source of facts about you.">
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                maxLength={COVER_LETTER_LIMITS.jobTextChars}
                rows={6}
                placeholder="Paste the job description here"
                style={{ ...inputStyle, height: "auto", padding: 12, lineHeight: 1.5, resize: "vertical" }}
              />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setShowJobText(true)}
              className="cv-btn-ghost"
              style={{ alignSelf: "flex-start" }}
            >
              <Icon name="plus" size={14} />
              Paste the job ad (optional, makes it sharper)
            </button>
          )}

          {/* Disclosure — the one place CV text leaves the browser. Mirrors
              lib/coverLetter/payload.ts; the privacy policy on www repeats it. */}
          <div
            style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ff-muted)", padding: "10px 12px", borderRadius: 10, background: "var(--ff-paper)", border: "1px solid var(--ff-line)" }}
          >
            <strong style={{ color: "var(--ff-ink)" }}>What leaves your browser:</strong>{" "}
            {excerptSummary.length ? excerptSummary.join(", ") : "an excerpt of your CV"} and the job details above are sent to our server
            and on to Anthropic (Claude) to write the letter, then discarded. Your contact details, photo and the rest of your CV
            stay on this device.
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--ff-red)", lineHeight: 1.5 }}>
              {error.message}{" "}
              {error.code === "RATE_LIMITED" && error.supportUrl && (
                <a href={error.supportUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                  Support MakeMyCV
                </a>
              )}
            </div>
          )}

          <button type="submit" className="cv-btn-primary" disabled={!canGenerate} style={{ alignSelf: "flex-start" }}>
            <Icon name="sparkle" size={14} />
            {isLoading ? "Writing…" : letter ? "Write it again" : "Write my cover letter"}
          </button>
        </form>

        {letter && (
          <section aria-label="Your cover letter" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {blocked && (
              <div role="status" style={{ fontSize: 13, color: "var(--ff-warn)", lineHeight: 1.5 }}>
                {placeholderCount} figure{placeholderCount === 1 ? "" : "s"} to fill in. {PLACEHOLDER_HINT}
              </div>
            )}
            {editing ? (
              <textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                rows={16}
                aria-label="Edit your cover letter"
                style={{ ...inputStyle, height: "auto", padding: 16, lineHeight: 1.6, fontSize: 15, resize: "vertical" }}
              />
            ) : (
              <div
                style={{ whiteSpace: "pre-wrap", padding: 20, borderRadius: 16, background: "var(--ff-card)", boxShadow: "var(--shadow-float)", fontSize: 15, lineHeight: 1.6, color: "var(--ff-ink)" }}
              >
                <PlaceholderText text={letter} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" className="cv-btn-secondary" onClick={() => setEditing((v) => !v)}>
                <Icon name="edit" size={14} />
                {editing ? "Done editing" : "Edit"}
              </button>
              <button type="button" className="cv-btn-secondary" onClick={handleCopy} disabled={blocked} title={blocked ? PLACEHOLDER_HINT : undefined}>
                {copied ? "Copied ✓" : "Copy text"}
              </button>
              <button type="button" className="cv-btn-primary" onClick={handleDocx} disabled={blocked || exporting} title={blocked ? PLACEHOLDER_HINT : undefined}>
                <Icon name="download" size={14} />
                {exporting ? "Preparing…" : "Download .docx"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--ff-faint)", lineHeight: 1.5 }}>
              Read it once before sending — it is written from your CV, but you know the role better than any tool does.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};
