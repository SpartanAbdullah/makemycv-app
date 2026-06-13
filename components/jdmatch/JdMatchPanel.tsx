"use client";

import { useEffect, useState } from "react";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useJdMatch } from "../../hooks/useJdMatch";
import { Icon } from "../builder/Icon";
import {
  JD_BAND_LABELS,
  JD_CATEGORY_LABELS,
  JD_MIN_TEXT,
  type JdCategoryResult,
} from "../../lib/jdMatch/types";

const BAND_COLOR: Record<string, string> = {
  strong: "var(--ff-accent)",
  good: "var(--ff-accent)",
  partial: "var(--ff-warn)",
  low: "var(--ff-red)",
};

/**
 * JD Match — free diagnosis panel (Phase A).
 * Paste a job description, get a match score + matched/missing keywords by
 * category. CV never leaves the browser; only the JD text is sent to extract.
 */
export const JdMatchPanel = () => {
  const cv = useCvStore((s) => s.data);
  const hydrated = useCvStore((s) => s.hydrated);
  const { run, result, isLoading, error, clear } = useJdMatch();
  const [jobText, setJobText] = useState("");

  // The CV store only auto-binds inside the builder shell (BuilderShell calls
  // bindCvStorage on mount). This is a standalone page, so on a direct visit
  // or a refresh nothing would hydrate the store — the panel would stay stuck
  // on "Loading your saved CV…" and match against an empty CV. bindCvStorage
  // is idempotent, so calling it here is safe whether the user arrived via
  // client-side nav from the builder (already bound) or landed here directly.
  useEffect(() => {
    bindCvStorage();
  }, []);

  const tooShort = jobText.trim().length < JD_MIN_TEXT;
  // Block analysis until the CV is loaded, otherwise the matcher would run
  // against the empty default CV and report everything as missing.
  const disabled = tooShort || isLoading || !hydrated;

  const onAnalyze = () => {
    if (disabled) return;
    run(jobText.trim(), cv);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 700,
            color: "var(--ff-ink)",
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          JD Match
        </h1>
        <p style={{ fontSize: 14, color: "var(--ff-muted)", lineHeight: 1.55, maxWidth: 560 }}>
          Paste a job description and see how well your CV matches it — the
          score, the keywords you already cover, and the ones you&apos;re
          missing. Your CV stays in your browser; only the job text is sent to
          analyse it, and it&apos;s never stored.
        </p>
      </div>

      {/* Paste box */}
      <div>
        <textarea
          className="cv-input"
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          placeholder="Paste the full job description here…"
          rows={9}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 160,
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--ff-faint)", fontFamily: "var(--font-mono)" }}>
            {jobText.trim().length} chars
            {tooShort && jobText.length > 0 ? " · paste a bit more" : ""}
          </span>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={disabled}
            className="cv-btn-primary"
            style={{
              padding: "11px 20px",
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Icon name="sparkle" size={13} />
            {isLoading ? "Analysing…" : "Check match"}
          </button>
        </div>
        {!hydrated && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--ff-faint)" }}>
            Loading your saved CV…
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#FBEFED",
            border: "1px solid #F2D2CE",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--ff-red)", fontWeight: 500 }}>
            {error.message}
          </p>
          {error.code === "RATE_LIMITED" && error.supportUrl ? (
            <a
              href={error.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ff-accent-dark)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Support MakeMyCV
            </a>
          ) : (
            <button
              type="button"
              onClick={onAnalyze}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ff-ink)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Score header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: 18,
              background: "var(--ff-card)",
              border: "1px solid var(--ff-line)",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                border: `3px solid ${BAND_COLOR[result.band]}`,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 24,
                color: "var(--ff-ink)",
              }}
            >
              {result.score}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 600,
                  color: BAND_COLOR[result.band],
                }}
              >
                {JD_BAND_LABELS[result.band]}
              </div>
              <div style={{ fontSize: 13, color: "var(--ff-muted)", marginTop: 2 }}>
                {result.matchedCount} of {result.totalRequirements} requirements covered
                {result.jobTitle ? ` · ${result.jobTitle}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={clear}
              style={{
                marginLeft: "auto",
                alignSelf: "flex-start",
                background: "none",
                border: "none",
                color: "var(--ff-muted)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear
            </button>
          </div>

          {/* Categories */}
          {result.categories.map((cat) => (
            <CategoryBlock key={cat.category} cat={cat} />
          ))}

          {/* Phase B teaser — not functional yet (Pro). */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--ff-sunken)",
              border: "1px dashed var(--ff-line-strong)",
              fontSize: 13,
              color: "var(--ff-muted)",
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "var(--ff-ink-2)" }}>Coming with Pro:</strong>{" "}
            one-click fixes that add missing skills and rewrite your bullets to
            include the keywords above — without leaving this page.
          </div>
        </div>
      )}
    </div>
  );
};

const Chip = ({ label, matched }: { label: string; matched: boolean }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 12.5,
      fontFamily: "var(--font-body)",
      background: matched ? "var(--ff-accent-soft)" : "var(--ff-card)",
      color: matched ? "var(--ff-accent-dark)" : "var(--ff-ink-2)",
      border: matched
        ? "1px solid var(--ff-accent-ring)"
        : "1px dashed var(--ff-line-strong)",
    }}
  >
    <Icon name={matched ? "check" : "plus"} size={11} />
    {label}
  </span>
);

const CategoryBlock = ({ cat }: { cat: JdCategoryResult }) => {
  const total = cat.matched.length + cat.missing.length;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ff-muted)",
          }}
        >
          {JD_CATEGORY_LABELS[cat.category]}
        </span>
        <span style={{ fontSize: 11, color: "var(--ff-faint)", fontFamily: "var(--font-mono)" }}>
          {cat.matched.length}/{total}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cat.missing.map((t) => (
          <Chip key={`m-${t}`} label={t} matched={false} />
        ))}
        {cat.matched.map((t) => (
          <Chip key={`y-${t}`} label={t} matched />
        ))}
      </div>
    </div>
  );
};
