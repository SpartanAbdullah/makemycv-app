"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useJdMatch } from "../../hooks/useJdMatch";
import { useBulletRewrite } from "../../hooks/useBulletRewrite";
import { matchRequirementsToCv } from "../../lib/jdMatch/match";
import { applyPendingChanges, type PendingChange } from "../../lib/jdMatch/applyFix";
import { createId } from "../../lib/utils/id";
import { Icon } from "../builder/Icon";
import { Logo } from "../Logo";
import {
  JD_BAND_LABELS,
  JD_CATEGORY_LABELS,
  JD_MIN_TEXT,
  type JdCategory,
  type JdCategoryResult,
} from "../../lib/jdMatch/types";
import type { CvExperience } from "../../lib/types/cv";
import { buildHeatmap } from "../../lib/jdMatch/heatmap";
import { buildTailoredCv } from "../../lib/jdMatch/tailorCv";
import { downloadCV } from "../../hooks/useDownloadCV";
import { exportToDocx } from "../../lib/utils/docxExport";
import { JdCvPreview, type JdChange } from "./JdCvPreview";
import { JdHeatmap } from "./JdHeatmap";
import { JdCoach } from "./JdCoach";
import { JdTailor } from "./JdTailor";
import { ProcessSteps } from "../ui/ProcessSteps";

const BAND_COLOR: Record<string, string> = {
  strong: "var(--ff-accent)",
  good: "var(--ff-accent)",
  partial: "var(--ff-warn)",
  low: "var(--ff-red)",
};

// Which fix affordance each JD category gets on its MISSING chips: all non-cert
// buckets add as a skill; certifications add as a certification; hard skills and
// domain keywords (better evidenced in experience) ALSO offer a truthful weave.
const ADD_SKILL_CATEGORIES: JdCategory[] = ["hardSkills", "tools", "softSkills", "keywords"];
const WEAVE_CATEGORIES: JdCategory[] = ["hardSkills", "keywords"];
const canAddSkill = (c: JdCategory) => ADD_SKILL_CATEGORIES.includes(c);
const canAddCert = (c: JdCategory) => c === "certifications";
const canWeave = (c: JdCategory) => WEAVE_CATEGORIES.includes(c);

/**
 * JD Match — split view . Left: paste a JD, see the score + matched/missing
 * keywords, and apply one-click fixes. Right: the user's live full-A4 CV.
 *
 * Fixes are STAGED, not saved instantly: "Add" and "Weave" push a pending
 * change that is replayed onto the CV preview (highlighted) and reflected in the
 * score, but the store is only mutated on "Accept all" — so the user can review
 * with the eye toggle and "Discard all" to revert. Privacy is unchanged: the CV
 * never leaves the browser; only JD text and a single bullet+keyword+role are
 * ever sent.
 */
export const JdMatchPanel = () => {
  const router = useRouter();
  const cv = useCvStore((s) => s.data);
  const hydrated = useCvStore((s) => s.hydrated);
  const isPro = useCvStore((s) => s.isPro);
  const setData = useCvStore((s) => s.setData);
  const { run, requirements, isLoading, error, clear } = useJdMatch();
  const [jobText, setJobText] = useState("");
  // The exact JD text we analysed, snapshotted at analyse time, so the heatmap
  // highlights against the analysed text even if the user edits the box after.
  const [analyzedText, setAnalyzedText] = useState("");
  const [weave, setWeave] = useState<{ category: JdCategory; term: string } | null>(null);
  // The bullet weaver scrolls into view when opened (Coach / heatmap / chip).
  const weaverRef = useRef<HTMLDivElement | null>(null);
  // Per-job tailoring: focus the skills section on this job for the downloaded
  // copy (master CV untouched). keptSkills = irrelevant skills the user restored.
  const [focusSkills, setFocusSkills] = useState(false);
  const [keptSkills, setKeptSkills] = useState<Set<string>>(new Set());
  const [tailorDownloading, setTailorDownloading] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  // Brief "downloaded ✓" confirmation after a successful tailored export.
  const [tailorDone, setTailorDone] = useState(false);
  const tailorRef = useRef<HTMLDivElement | null>(null);
  // One-shot "scroll to this section once it has rendered" (robust on mobile
  // where the work column mounts only after the view switch).
  const [scrollIntent, setScrollIntent] = useState<null | "weaver" | "tailor">(null);
  // Staged fixes (committed only on Accept all). The working CV = base + these.
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showChanges, setShowChanges] = useState(true);
  // Most recent staged change — drives the confirmation note + the CV flash.
  const [lastChange, setLastChange] = useState<JdChange | null>(null);
  // Brief "saved to your CV" notice after Accept all.
  const [savedCount, setSavedCount] = useState<number | null>(null);
  // Split on desktop; a toggle swaps work / CV below. Starts false so SSR and
  // the first client render agree (no hydration mismatch), then upgrades.
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileView, setMobileView] = useState<"work" | "cv">("work");
  const [backPrompt, setBackPrompt] = useState(false);

  // Standalone page: hydrate the store ourselves (idempotent). See Phase A.
  useEffect(() => {
    bindCvStorage();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Scroll to a section once it has actually rendered. Re-runs as the relevant
  // state settles; clears the intent only once the target node exists, so the
  // scroll never fires against an unmounted ref (e.g. mobile view switch).
  useEffect(() => {
    if (!scrollIntent) return;
    const node = scrollIntent === "weaver" ? weaverRef.current : tailorRef.current;
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollIntent(null);
    }
  }, [scrollIntent, weave, focusSkills, mobileView]);

  // Working CV = base store CV + staged changes (pure replay). The preview and
  // the score both reflect this so fixes are visible before they are saved.
  const workingCv = useMemo(
    () => applyPendingChanges(cv, pendingChanges),
    [cv, pendingChanges],
  );

  // Exact texts to tint in the CV preview — each staged skill/cert term and
  // each rewritten bullet. Empty when changes are hidden.
  const highlights = useMemo(
    () =>
      showChanges
        ? pendingChanges.map((c) => (c.kind === "bullet" ? c.text : c.term))
        : [],
    [showChanges, pendingChanges],
  );

  const result = useMemo(
    () => (requirements ? matchRequirementsToCv(requirements, workingCv) : null),
    [requirements, workingCv],
  );

  // Heatmap of the analysed JD (terms located in the text). Recomputes with the
  // result, so spans flip green as fixes stage.
  const heatmap = useMemo(
    () => (result && analyzedText ? buildHeatmap(analyzedText, result.terms) : null),
    [result, analyzedText],
  );

  // Categories shown as chips BELOW the heatmap = only the terms NOT already
  // highlighted in the JD text (so every term appears exactly once).
  const unlocatedCategories = useMemo(() => {
    if (!result) return [];
    const located = heatmap?.located ?? new Set<string>();
    return result.categories
      .map((cat) => ({
        ...cat,
        matched: cat.matched.filter((t) => !located.has(t)),
        missing: cat.missing.filter((t) => !located.has(t)),
      }))
      .filter((c) => c.matched.length + c.missing.length > 0);
  }, [result, heatmap]);

  // The CV the eye-toggle is showing: staged (working) or the base "before".
  const sourceCv = showChanges ? workingCv : cv;

  // Per-job tailored copy (skills focused on the JD), built from whatever the
  // eye-toggle currently shows; the master CV in the store is untouched.
  const reqTerms = useMemo(() => result?.terms.map((t) => t.term) ?? [], [result]);
  const tailored = useMemo(
    () => (result ? buildTailoredCv(sourceCv, reqTerms, keptSkills) : null),
    [result, sourceCv, reqTerms, keptSkills],
  );

  // What the right-hand preview shows — and EXACTLY what a download exports, so
  // the file always matches what the user sees.
  const previewCv = focusSkills && tailored ? tailored.tailoredCv : sourceCv;

  // Only roles with a non-empty bullet are weave targets — we never rewrite an
  // empty bullet (that would be fabricating). Read from the working CV so a
  // weave operates on already-staged text.
  const weavableRoles = useMemo(
    () => workingCv.experience.filter((r) => r.bullets.some((b) => b.trim())),
    [workingCv],
  );

  const hasPending = pendingChanges.length > 0;
  // A human summary of what's staged, so "Accept all (N)" is never opaque —
  // e.g. after "Clear" removes the per-chip context (review finding).
  const pendingSummary = pendingChanges
    .map((c) =>
      c.kind === "bullet"
        ? "Rewrite a bullet"
        : c.kind === "cert"
          ? `Add certification “${c.term}”`
          : `Add skill “${c.term}”`,
    )
    .join("  ·  ");
  const tooShort = jobText.trim().length < JD_MIN_TEXT;
  const disabled = tooShort || isLoading || !hydrated;
  const fixable = isPro && hydrated;
  const hasGaps = result ? result.matchedCount < result.totalRequirements : false;
  const showWork = isDesktop || mobileView === "work";
  const showPreview = isDesktop || mobileView === "cv";

  const onAnalyze = () => {
    if (disabled) return;
    setWeave(null);
    setLastChange(null);
    setSavedCount(null);
    setMobileView("work");
    setFocusSkills(false);
    setKeptSkills(new Set());
    setTailorError(null);
    setAnalyzedText(jobText.trim());
    run(jobText.trim());
  };

  const handleAdd = (category: JdCategory, term: string) => {
    const isCert = category === "certifications";
    setSavedCount(null);
    setShowChanges(true); // a just-applied fix should always be visible
    setPendingChanges((prev) => [
      ...prev,
      isCert
        ? { id: createId(), kind: "cert", term }
        : { id: createId(), kind: "skill", term },
    ]);
    setLastChange({
      kind: isCert ? "cert" : "skill",
      text: term,
      label: isCert
        ? `Staged: added “${term}” to your Certifications`
        : `Staged: added “${term}” to your Skills`,
    });
  };

  // Open the bullet weaver AND bring it into view — the guided flow should never
  // leave the next action off-screen (founder feedback: no auto-scroll today).
  const openWeave = (category: JdCategory, term: string) => {
    setWeave({ category, term });
    setMobileView("work");
    setScrollIntent("weaver");
  };

  // Keep a hidden (irrelevant) skill on the tailored copy. Re-tailoring clears
  // any stale "downloaded ✓" confirmation.
  const keepSkill = (name: string) => {
    setTailorDone(false);
    setKeptSkills((prev) => new Set(prev).add(name));
  };
  const toggleFocus = (next: boolean) => {
    setTailorDone(false);
    setFocusSkills(next);
  };

  // Download the per-job copy (focused when the toggle is on) — NEVER mutates the
  // store, so the master CV keeps every skill. Pure data → exporter, like the
  // builder's own fallback export.
  const downloadTailored = async (kind: "pdf" | "docx") => {
    const data = previewCv; // export exactly what the preview shows
    setTailorError(null);
    setTailorDone(false);
    setTailorDownloading(true);
    try {
      if (kind === "docx") await exportToDocx(data);
      else await downloadCV(data, "pro", data.settings.templateId ?? "classic");
      setTailorDone(true);
    } catch {
      setTailorError("Download failed — please try again.");
    } finally {
      setTailorDownloading(false);
    }
  };

  // Jump to the download panel and turn focus on (Coach hand-off / done-state).
  const goToDownload = () => {
    setFocusSkills(true);
    setMobileView("work");
    setScrollIntent("tailor");
  };

  const handleApplyWeave = (
    experienceId: string,
    bulletIndex: number,
    text: string,
  ) => {
    const change: PendingChange = {
      id: createId(),
      kind: "bullet",
      experienceId,
      bulletIndex,
      text,
    };
    const role = workingCv.experience.find((e) => e.id === experienceId);
    const term = weave?.term;
    // Does the woven wording surface the keyword literally? (The matcher is
    // literal/alias-based; a paraphrase reads well but won't flip the chip.)
    const nextWorking = applyPendingChanges(cv, [...pendingChanges, change]);
    const stillMissing =
      !!term &&
      !!requirements &&
      matchRequirementsToCv(requirements, nextWorking).categories.some((c) =>
        c.missing.includes(term),
      );
    setSavedCount(null);
    setShowChanges(true); // a just-applied fix should always be visible
    setPendingChanges((prev) => [...prev, change]);
    setLastChange({
      kind: "bullet",
      text,
      label: `Staged: rewrote a bullet in “${role?.role?.trim() || "your experience"}”`,
      warning: stillMissing
        ? `Heads up — “${term}” reads as a close paraphrase here, not the exact keyword, so its chip stays a gap. Weave it again and pick the variant that uses “${term}” word-for-word if you want it to count toward the match.`
        : undefined,
    });
    setWeave(null);
  };

  const acceptAll = () => {
    if (!hasPending) return;
    const n = pendingChanges.length;
    setData(workingCv); // commit → autosaves → the builder/PDF reflect it
    setPendingChanges([]);
    setLastChange(null);
    setWeave(null);
    setSavedCount(n);
  };

  const discardAll = () => {
    setPendingChanges([]);
    setLastChange(null);
    setWeave(null);
    setSavedCount(null);
  };

  const goBack = () => {
    if (hasPending) setBackPrompt(true);
    else router.push("/builder");
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      {/* Top bar — brand + prominent Back (left), change controls (right) */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          rowGap: 8,
          padding: "10px 20px",
          flexShrink: 0,
          background: "var(--ff-card)",
          borderBottom: "1px solid var(--ff-line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Logo variant="horizontal" height={26} href={null} />
          <button
            type="button"
            onClick={goBack}
            className="cv-btn-secondary"
            style={{ padding: "9px 16px", fontWeight: 600 }}
          >
            <Icon name="chevron-left" size={14} />
            Back to the builder
          </button>
        </div>
        {fixable && (savedCount !== null ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ff-accent-dark)",
            }}
          >
            <Icon name="check" size={14} />
            {savedCount} change{savedCount > 1 ? "s" : ""} saved to your CV
          </span>
        ) : (
          <ChangeControls
            count={pendingChanges.length}
            summary={pendingSummary}
            showChanges={showChanges}
            onToggle={() => setShowChanges((v) => !v)}
            onAccept={acceptAll}
            onDiscard={discardAll}
          />
        ))}
      </header>

      {!isDesktop && <MobileViewToggle value={mobileView} onChange={setMobileView} />}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 24,
          width: "100%",
          maxWidth: 1760,
          margin: "0 auto",
          padding: isDesktop ? "18px 24px 22px" : "12px 16px 16px",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT — gap-closing work */}
        {showWork && (
          <div
            className="jd-work"
            style={
              isDesktop
                ? { flex: "0 1 560px", minWidth: 0, overflowY: "auto", overflowX: "hidden" }
                : { flex: 1, minWidth: 0, width: "100%", overflowY: "auto", overflowX: "hidden" }
            }
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
                maxWidth: 600,
                margin: "0 auto",
              }}
            >
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
                  Match your CV to a job
                </h1>
                <p style={{ fontSize: 14, color: "var(--ff-muted)", lineHeight: 1.55 }}>
                  Paste a job description and we&apos;ll find the gaps between it
                  and your CV. Apply one-click fixes and watch them appear on your
                  live CV on the right — they&apos;re <strong style={{ color: "var(--ff-ink-2)" }}>staged for review</strong>,
                  so nothing is saved until you <strong style={{ color: "var(--ff-ink-2)" }}>Accept all</strong>.
                  When the AI rewords a bullet to fit the job it won&apos;t invent
                  experience — if your wording can&apos;t honestly back the keyword,
                  it declines. Your CV stays in your browser; only the job text is
                  sent, and it&apos;s never stored.
                </p>
              </div>

              {/* Paste box */}
              <div>
                <textarea
                  className="cv-input"
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the full job description here…"
                  aria-label="Job description"
                  rows={7}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    minHeight: 130,
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
                    {isLoading ? (
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          border: "2px solid rgba(255,255,255,0.45)",
                          borderTopColor: "#fff",
                          borderRadius: "50%",
                          display: "inline-block",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                    ) : (
                      <Icon name="sparkle" size={13} />
                    )}
                    {isLoading ? "Reading the job…" : "Find my gaps"}
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

              {/* Analysing — surface progress in the results area, not just the
                  button, so the user knows work is happening here. */}
              {isLoading && (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    background: "var(--ff-card)",
                    border: "1px solid var(--ff-line)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--ff-ink)",
                      marginBottom: 12,
                    }}
                  >
                    Matching the job to your CV
                  </div>
                  <ProcessSteps
                    steps={[
                      "Reading the job",
                      "Pulling out the requirements",
                      "Matching against your CV",
                    ]}
                  />
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--ff-faint)",
                      lineHeight: 1.5,
                      margin: "16px 0 0",
                      paddingTop: 12,
                      borderTop: "1px solid var(--ff-line)",
                    }}
                  >
                    Only the job text is sent for this — your CV stays in your browser.
                  </p>
                </div>
              )}

              {/* Result */}
              {result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Score header (recomputes live as fixes are staged) */}
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
                      title="A private tailoring checklist — recruiters never see this score."
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
                        transition: "border-color 300ms",
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
                        You already cover {result.matchedCount} of {result.totalRequirements} — let&apos;s tailor the rest
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

                  {/* Eye toggle is hiding staged changes — the preview shows
                      the "before" CV while the score/chips reflect the staged
                      plan; say so to avoid the two panels looking inconsistent. */}
                  {!showChanges && hasPending && (
                    <p
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--ff-muted)",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      <Icon name="eye" size={12} />
                      Preview is showing your CV{" "}
                      <strong style={{ color: "var(--ff-ink-2)" }}>before</strong> these
                      fixes — your score already counts the staged changes. Use
                      “Show changes” to see them applied.
                    </p>
                  )}

                  {/* Guided coach — the next highest-impact fix, front and centre */}
                  {hydrated && isPro && result.totalRequirements > 0 && (
                    <JdCoach
                      key={analyzedText}
                      terms={result.terms}
                      fixable={fixable}
                      weaveDisabled={weavableRoles.length === 0}
                      onAdd={handleAdd}
                      onWeave={openWeave}
                      doneCta={
                        <button
                          type="button"
                          className="cv-btn-primary"
                          style={{ padding: "10px 16px" }}
                          onClick={goToDownload}
                        >
                          <Icon name="download" size={13} />
                          Download your tailored CV
                        </button>
                      }
                    />
                  )}

                  {/* JD heatmap — read the job with your matches highlighted */}
                  {heatmap && heatmap.located.size > 0 && (
                    <JdHeatmap
                      segments={heatmap.segments}
                      fixable={fixable}
                      weaveDisabled={weavableRoles.length === 0}
                      onAdd={handleAdd}
                      onWeave={openWeave}
                    />
                  )}

                  {hydrated && !isPro && hasGaps && <ProLockBanner />}

                  {/* Most recent staged fix (or the saved confirmation) */}
                  {savedCount !== null ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "var(--ff-accent-soft)",
                        border: "1px solid var(--ff-accent-ring)",
                      }}
                    >
                      <Icon name="check" size={14} color="var(--ff-accent-dark)" />
                      <p style={{ flex: 1, fontSize: 13, color: "var(--ff-accent-dark)", fontWeight: 600, margin: 0 }}>
                        Saved to your CV — these changes are now in your builder.
                      </p>
                    </div>
                  ) : (
                    lastChange && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "12px 14px",
                          borderRadius: 10,
                          background: "var(--ff-accent-soft)",
                          border: "1px solid var(--ff-accent-ring)",
                        }}
                      >
                        <span style={{ color: "var(--ff-accent-dark)", marginTop: 1, flexShrink: 0 }}>
                          <Icon name="check" size={14} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: "var(--ff-accent-dark)", fontWeight: 600, margin: 0 }}>
                            {lastChange.label}
                          </p>
                          {lastChange.warning && (
                            <p style={{ fontSize: 12, color: "var(--ff-muted)", lineHeight: 1.5, margin: "5px 0 0" }}>
                              {lastChange.warning}
                            </p>
                          )}
                        </div>
                        {!isDesktop && (
                          <button
                            type="button"
                            onClick={() => setMobileView("cv")}
                            style={{
                              flexShrink: 0,
                              background: "none",
                              border: "none",
                              color: "var(--ff-accent-dark)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              textDecoration: "underline",
                              whiteSpace: "nowrap",
                            }}
                          >
                            View in CV →
                          </button>
                        )}
                      </div>
                    )
                  )}

                  {/* Remaining terms not found verbatim in the JD text, as chips.
                      (Located terms live in the heatmap above — no duplication.) */}
                  {unlocatedCategories.length > 0 && (
                    <>
                      {heatmap && heatmap.located.size > 0 && (
                        <p
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--ff-faint)",
                            margin: "2px 0 -4px",
                          }}
                        >
                          Also detected (not worded the same in the JD)
                        </p>
                      )}
                      {unlocatedCategories.map((cat) => (
                        <CategoryBlock
                          key={cat.category}
                          cat={cat}
                          fixable={fixable}
                          weaveDisabled={weavableRoles.length === 0}
                          activeWeaveTerm={weave?.term ?? null}
                          onAdd={handleAdd}
                          onWeave={openWeave}
                        />
                      ))}
                    </>
                  )}

                  {/* Inline bullet weaver (truthful AI rewrite of one bullet) */}
                  {weave && fixable && weavableRoles.length > 0 && (
                    <div ref={weaverRef}>
                      <BulletWeaver
                        key={weave.term}
                        term={weave.term}
                        roles={weavableRoles}
                        onApply={handleApplyWeave}
                        onClose={() => setWeave(null)}
                      />
                    </div>
                  )}

                  {/* Tailor & download — focus the skills on this job, master kept */}
                  {hydrated && isPro && tailored && (
                    <div ref={tailorRef}>
                      <JdTailor
                        focused={focusSkills}
                        onToggleFocus={toggleFocus}
                        totalSkills={sourceCv.skills.length}
                        hiddenSkills={tailored.hiddenSkills}
                        onKeep={keepSkill}
                        onDownloadPdf={() => downloadTailored("pdf")}
                        onDownloadDocx={() => downloadTailored("docx")}
                        downloading={tailorDownloading}
                        done={tailorDone}
                        error={tailorError}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT — the live CV, stretched to fill, updating as fixes stage */}
        {showPreview && (
          <div
            className="jd-preview"
            style={
              isDesktop
                ? { flex: "1 1 0", minWidth: 0, minHeight: 0, display: "flex" }
                : { flex: 1, minWidth: 0, minHeight: 0, width: "100%", display: "flex" }
            }
          >
            <JdCvPreview
              data={previewCv}
              highlights={highlights}
              lastChange={showChanges ? lastChange : null}
              autoFocusOnMount={!isDesktop}
            />
          </div>
        )}
      </div>

      {backPrompt && (
        <BackConfirmDialog
          count={pendingChanges.length}
          onCancel={() => setBackPrompt(false)}
          onDiscard={() => {
            setPendingChanges([]);
            router.push("/builder");
          }}
          onAccept={() => {
            setData(workingCv);
            setPendingChanges([]);
            router.push("/builder");
          }}
        />
      )}
    </div>
  );
};

/* ─── Header change controls: eye-toggle + Accept all + Discard all ──────── */
const ghostPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 999,
  border: "1px solid var(--ff-line)",
  background: "var(--ff-paper)",
  color: "var(--ff-ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const ChangeControls = ({
  count,
  summary,
  showChanges,
  onToggle,
  onAccept,
  onDiscard,
}: {
  count: number;
  summary: string;
  showChanges: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDiscard: () => void;
}) => {
  const has = count > 0;
  const dim = (on: boolean): React.CSSProperties => ({
    opacity: on ? 1 : 0.45,
    cursor: on ? "pointer" : "not-allowed",
  });
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!has}
        title="Show or hide your staged changes in the preview"
        style={{ ...ghostPill, ...dim(has) }}
      >
        <Icon name="eye" size={14} />
        {showChanges ? "Hide changes" : "Show changes"}
      </button>
      <button
        type="button"
        onClick={onAccept}
        disabled={!has}
        title={has ? `Save to your CV — ${summary}` : undefined}
        className="cv-btn-primary"
        style={{ padding: "9px 14px", ...dim(has) }}
      >
        <Icon name="check" size={14} />
        Accept all{has ? ` (${count})` : ""}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        disabled={!has}
        className="cv-btn-secondary"
        style={{ padding: "9px 14px", ...dim(has) }}
      >
        <Icon name="trash" size={14} />
        Discard all
      </button>
    </div>
  );
};

/* ─── Warn-before-leave dialog (staged changes not yet saved) ───────────── */
const BackConfirmDialog = ({
  count,
  onCancel,
  onDiscard,
  onAccept,
}: {
  count: number;
  onCancel: () => void;
  onDiscard: () => void;
  onAccept: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      // Trap Tab within the dialog (mirrors ExportGateDialog) so focus can't
      // reach the still-mounted background controls — honours aria-modal.
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onCancel]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(11,15,12,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Save your staged changes?"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--ff-card)",
          borderRadius: 16,
          border: "1px solid var(--ff-line)",
          boxShadow: "0 18px 48px rgba(11,15,12,0.22)",
          padding: 24,
          maxWidth: 440,
          width: "100%",
          outline: "none",
        }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ff-ink)", margin: 0 }}>
          Save your staged changes?
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--ff-muted)", lineHeight: 1.55, margin: "8px 0 20px" }}>
          You have {count} staged change{count > 1 ? "s" : ""} that aren&apos;t
          saved to your CV yet. Accept them before leaving, or discard them.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} className="cv-btn-secondary" style={{ padding: "9px 14px" }}>
            Cancel
          </button>
          <button type="button" onClick={onDiscard} className="cv-btn-secondary" style={{ padding: "9px 14px" }}>
            Discard &amp; leave
          </button>
          <button type="button" onClick={onAccept} className="cv-btn-primary" style={{ padding: "9px 14px" }}>
            <Icon name="check" size={13} />
            Accept &amp; leave
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Mobile work / CV toggle (below the desktop split breakpoint) ───────── */
const MobileViewToggle = ({
  value,
  onChange,
}: {
  value: "work" | "cv";
  onChange: (v: "work" | "cv") => void;
}) => (
  <div style={{ display: "flex", justifyContent: "center", padding: "10px 16px 0", flexShrink: 0 }}>
    <div
      role="tablist"
      aria-label="Switch between fixing gaps and your CV"
      style={{
        display: "inline-flex",
        padding: 4,
        gap: 2,
        background: "var(--ff-sunken)",
        border: "1px solid var(--ff-line)",
        borderRadius: 999,
      }}
    >
      {(["work", "cv"] as const).map((v) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 999,
              border: "none",
              background: active ? "var(--ff-card)" : "transparent",
              color: active ? "var(--ff-ink)" : "var(--ff-muted)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: active ? "0 1px 3px rgba(11,15,12,0.10)" : "none",
            }}
          >
            <Icon name={v === "work" ? "sparkle" : "eye"} size={13} />
            {v === "work" ? "Fix gaps" : "Your CV"}
          </button>
        );
      })}
    </div>
  </div>
);

/* ─── Locked-state CTA (renders only when isPro is false) ───────────────────
   isPro is force-true today, so this is dead at runtime; built for the
   returning paid tier. Honest, no fake urgency. */
const ProLockBanner = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 16px",
      borderRadius: 12,
      background: "var(--ff-sunken)",
      border: "1px dashed var(--ff-line-strong)",
    }}
  >
    <Icon name="lock" size={16} color="var(--ff-muted)" />
    <p style={{ fontSize: 13, color: "var(--ff-muted)", lineHeight: 1.55, margin: 0 }}>
      <strong style={{ color: "var(--ff-ink-2)" }}>One-click fixes are a Pro feature.</strong>{" "}
      With Pro you can add a missing skill to your CV in one tap, or weave a
      keyword into a bullet — without ever inventing experience. Pro is
      returning soon.
    </p>
  </div>
);

const miniBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid var(--ff-accent-ring)",
  background: "var(--ff-accent-soft)",
  color: "var(--ff-accent-dark)",
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/* ─── A missing term with its fix affordances ─────────────────────────────── */
const MissingFix = ({
  category,
  term,
  fixable,
  weaveDisabled,
  active,
  onAdd,
  onWeave,
}: {
  category: JdCategory;
  term: string;
  fixable: boolean;
  weaveDisabled: boolean;
  active: boolean;
  onAdd: (category: JdCategory, term: string) => void;
  onWeave: (category: JdCategory, term: string) => void;
}) => {
  const showAdd = fixable && (canAddSkill(category) || canAddCert(category));
  const showWeave = fixable && canWeave(category);
  const addTitle = canAddCert(category)
    ? `Add “${term}” to your certifications`
    : `Add “${term}” to your skills`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px 5px 11px",
        borderRadius: 999,
        fontSize: 12.5,
        fontFamily: "var(--font-body)",
        background: "var(--ff-card)",
        color: "var(--ff-ink-2)",
        border: active
          ? "1px solid var(--ff-accent)"
          : "1px dashed var(--ff-line-strong)",
      }}
    >
      <span>{term}</span>
      {!fixable ? (
        <Icon name="lock" size={11} color="var(--ff-faint)" />
      ) : (
        <span style={{ display: "inline-flex", gap: 4 }}>
          {showAdd && (
            <button type="button" title={addTitle} onClick={() => onAdd(category, term)} style={miniBtn}>
              <Icon name="plus" size={10} />
              Add
            </button>
          )}
          {showWeave && (
            <button
              type="button"
              title={weaveDisabled ? "Add an experience bullet first" : `Weave “${term}” into one of your bullets`}
              onClick={() => !weaveDisabled && onWeave(category, term)}
              disabled={weaveDisabled}
              style={{
                ...miniBtn,
                background: "transparent",
                opacity: weaveDisabled ? 0.5 : 1,
                cursor: weaveDisabled ? "not-allowed" : "pointer",
              }}
            >
              <Icon name="sparkle" size={10} />
              Weave
            </button>
          )}
        </span>
      )}
    </span>
  );
};

const Chip = ({ label }: { label: string }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 12.5,
      fontFamily: "var(--font-body)",
      background: "var(--ff-accent-soft)",
      color: "var(--ff-accent-dark)",
      border: "1px solid var(--ff-accent-ring)",
    }}
  >
    <Icon name="check" size={11} />
    {label}
  </span>
);

const CategoryBlock = ({
  cat,
  fixable,
  weaveDisabled,
  activeWeaveTerm,
  onAdd,
  onWeave,
}: {
  cat: JdCategoryResult;
  fixable: boolean;
  weaveDisabled: boolean;
  activeWeaveTerm: string | null;
  onAdd: (category: JdCategory, term: string) => void;
  onWeave: (category: JdCategory, term: string) => void;
}) => {
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
          <MissingFix
            key={`m-${t}`}
            category={cat.category}
            term={t}
            fixable={fixable}
            weaveDisabled={weaveDisabled}
            active={activeWeaveTerm === t}
            onAdd={onAdd}
            onWeave={onWeave}
          />
        ))}
        {cat.matched.map((t) => (
          <Chip key={`y-${t}`} label={t} />
        ))}
      </div>
    </div>
  );
};

/* ─── Inline bullet weaver ──────────────────────────────────────────────────
   Pick a role + an existing non-empty bullet, ask the server for a truthful
   rewrite that surfaces the keyword (only { bullet, keyword, roleTitle } is
   sent), review, and stage it. An empty result is an honest refusal. */
const fieldLabelText: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ff-muted)",
};

const longestNonEmpty = (bullets: string[]): number => {
  let best = -1;
  let bestLen = -1;
  bullets.forEach((b, i) => {
    if (b.trim() && b.length > bestLen) {
      best = i;
      bestLen = b.length;
    }
  });
  return best === -1 ? 0 : best;
};

const BulletWeaver = ({
  term,
  roles,
  onApply,
  onClose,
}: {
  term: string;
  roles: CvExperience[];
  onApply: (experienceId: string, bulletIndex: number, text: string) => void;
  onClose: () => void;
}) => {
  const { rewrite, variants, isLoading, error, clear } = useBulletRewrite();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const [bulletIndex, setBulletIndex] = useState(() =>
    longestNonEmpty(roles[0]?.bullets ?? []),
  );

  useEffect(() => {
    if (role) setBulletIndex(longestNonEmpty(role.bullets));
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const bulletOptions = role
    ? role.bullets.map((text, index) => ({ text, index })).filter((o) => o.text.trim())
    : [];
  const selectedBullet = role?.bullets[bulletIndex] ?? "";

  const onGenerate = () => {
    if (!selectedBullet.trim() || isLoading) return;
    rewrite(selectedBullet, term, role?.role ?? "");
  };

  const refused = variants !== null && variants.length === 0 && !isLoading && !error;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        borderRadius: 12,
        background: "var(--ff-sunken)",
        border: "1px solid var(--ff-line-strong)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ff-ink)",
            }}
          >
            <Icon name="sparkle" size={13} />
            Weave “{term}” into a bullet
          </div>
          <div style={{ fontSize: 12, color: "var(--ff-muted)", marginTop: 3, lineHeight: 1.5, maxWidth: 460 }}>
            We only re-word what your bullet already says — if “{term}” can&apos;t
            be added truthfully, we&apos;ll tell you instead of inventing it.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--ff-muted)",
            fontSize: 12,
            cursor: "pointer",
            textDecoration: "underline",
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      </div>

      {roles.length > 1 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabelText}>Role</span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              padding: "9px 10px",
              borderRadius: 8,
              border: "1px solid var(--ff-line)",
              background: "var(--ff-card)",
              color: "var(--ff-ink)",
            }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {(r.role || "Untitled role") + (r.company ? ` · ${r.company}` : "")}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={fieldLabelText}>Which bullet to improve?</span>
        {bulletOptions.map((opt) => {
          const selected = opt.index === bulletIndex;
          return (
            <button
              key={opt.index}
              type="button"
              onClick={() => {
                setBulletIndex(opt.index);
                clear();
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                textAlign: "left",
                padding: "9px 11px",
                borderRadius: 9,
                background: "var(--ff-card)",
                border: selected ? "1px solid var(--ff-accent)" : "1px solid var(--ff-line)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <span style={{ marginTop: 1, flexShrink: 0, color: selected ? "var(--ff-accent)" : "var(--ff-faint)" }}>
                <Icon name={selected ? "check" : "plus"} size={11} />
              </span>
              <span style={{ fontSize: 13, color: "var(--ff-ink-2)", lineHeight: 1.45 }}>{opt.text}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isLoading || !selectedBullet.trim()}
        className="cv-btn-primary"
        style={{
          alignSelf: "flex-start",
          padding: "10px 16px",
          opacity: isLoading || !selectedBullet.trim() ? 0.6 : 1,
          cursor: isLoading || !selectedBullet.trim() ? "not-allowed" : "pointer",
        }}
      >
        <Icon name="sparkle" size={12} />
        {isLoading ? "Rewriting…" : variants !== null ? "Suggest again" : "Suggest a rewrite"}
      </button>

      {error && (
        <div style={{ padding: "10px 12px", borderRadius: 9, background: "#FBEFED", border: "1px solid #F2D2CE" }}>
          <p style={{ fontSize: 12.5, color: "var(--ff-red)", fontWeight: 500, margin: 0 }}>{error.message}</p>
          {error.code === "RATE_LIMITED" && error.supportUrl && (
            <a
              href={error.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--ff-accent-dark)", textDecoration: "underline" }}
            >
              Support MakeMyCV
            </a>
          )}
        </div>
      )}

      {refused && (
        <p style={{ fontSize: 12.5, color: "var(--ff-muted)", lineHeight: 1.55, margin: 0 }}>
          We couldn&apos;t add “{term}” to this bullet without inventing
          something that isn&apos;t there. Try a different bullet, or add it as a
          skill instead.
        </p>
      )}

      {variants && variants.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={fieldLabelText}>Pick a rewrite to stage</span>
          {variants.map((v, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--ff-card)",
                border: "1px solid var(--ff-line)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13, color: "var(--ff-ink-2)", lineHeight: 1.5 }}>{v}</span>
              <button
                type="button"
                onClick={() => role && onApply(role.id, bulletIndex, v)}
                className="cv-btn-primary"
                style={{ padding: "8px 14px", flexShrink: 0 }}
              >
                Use this
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
