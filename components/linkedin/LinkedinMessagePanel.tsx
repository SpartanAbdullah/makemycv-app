"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bindCvStorage, useCvStore } from "../../lib/store/cvStore";
import { useLinkedinMessage } from "../../hooks/useLinkedinMessage";
import {
  CONNECTION_NOTE_MAX_CHARS,
  LINKEDIN_MESSAGE_LIMITS,
  MESSAGE_WORDS,
  buildLinkedinCvExcerpt,
  buildLinkedinMessageRequest,
  jobTextIsUsable,
  linkedinExcerptIsUsable,
  type LinkedinMessageVariant,
} from "../../lib/linkedinMessage/payload";
import { countWords } from "../../lib/linkedinMessage/prompt";
import { countPlaceholders, hasPlaceholder } from "../../lib/ai/placeholders";
import { track } from "../../lib/analytics";
import { PLACEHOLDER_HINT, PlaceholderText } from "../ai/PlaceholderText";
import { Field } from "../forms/Field";
import { Icon } from "../builder/Icon";
import { Logo } from "../Logo";

/**
 * LinkedIn recruiter message (2026-10-31) — product #3 in CLAUDE.md, built
 * on the cover letter's architecture.
 *
 * Flow: paste the job ad or the recruiter's note (required) → pick a format
 * (60–90-word message, or a ≤200-character connection note) → one click → a
 * message written ONLY from a small excerpt of the CV → edit in place → copy.
 * Copy-only: there is no document to download.
 *
 * Privacy: the disclosure is on the page, above the button, in the same
 * words as lib/linkedinMessage/payload.ts (which decides the excerpt). Keep
 * the two in sync.
 *
 * Truthfulness: {{number}} placeholders come back highlighted and Copy stays
 * disabled until the user replaces every one. A refusal (the paste is not a
 * job / recruiter context) is shown as a plain decline, not an error.
 */

const SEED_KEY = "makemycv:linkedinMessageSeed";
type Seed = { v: 1; jobText?: string };

/** JD Match hands the pasted ad across in sessionStorage (tab-local, never the CV). */
export function stashLinkedinMessageSeed(seed: Omit<Seed, "v">) {
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
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--ff-line)",
  background: "var(--ff-card)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--ff-ink)",
  resize: "vertical",
};

const VARIANT_LABEL: Record<LinkedinMessageVariant, { title: string; hint: string }> = {
  message: { title: "Message", hint: `${MESSAGE_WORDS.min}–${MESSAGE_WORDS.max} words, for a direct message or InMail` },
  connection_note: { title: `Connection note (≤${CONNECTION_NOTE_MAX_CHARS} chars)`, hint: "LinkedIn cuts a connection note off at 200 characters" },
};

export const LinkedinMessagePanel = () => {
  const hydrated = useCvStore((s) => s.hydrated);

  useEffect(() => {
    bindCvStorage();
  }, []);

  // The form mounts only once the store is hydrated, so its initial state can
  // read the tab-local seed synchronously (no setState-in-effect, no SSR
  // mismatch: nothing below renders on the server).
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
      <PanelHeader />
      {hydrated ? <LinkedinMessageForm /> : null}
    </div>
  );
};

const PanelHeader = () => {
  const router = useRouter();
  return (
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
  );
};

const LinkedinMessageForm = () => {
  const router = useRouter();
  const cv = useCvStore((s) => s.data);
  const { isLoading, error, generate, clearError } = useLinkedinMessage();

  const [jobText, setJobText] = useState(() => readSeed()?.jobText ?? "");
  const [variant, setVariant] = useState<LinkedinMessageVariant>("message");
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<LinkedinMessageVariant>("message");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  // The route cut the draft at a sentence boundary to stay within 90 words (E5).
  const [trimmed, setTrimmed] = useState(false);

  const excerpt = useMemo(() => buildLinkedinCvExcerpt(cv), [cv]);
  const cvUsable = linkedinExcerptIsUsable(excerpt);
  const jobUsable = jobTextIsUsable(jobText);
  const canGenerate = cvUsable && jobUsable && !isLoading;

  const blocked = hasPlaceholder(message);
  const placeholderCount = useMemo(() => countPlaceholders(message), [message]);
  const chars = message.length;
  const words = useMemo(() => countWords(message), [message]);
  const overCap = messageVariant === "connection_note" && chars > CONNECTION_NOTE_MAX_CHARS;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    const req = buildLinkedinMessageRequest(cv, { jobText, variant });
    const out = await generate(req);
    if (out.ok) {
      setMessage(out.text);
      setMessageVariant(req.variant);
      setEditing(false);
      setTrimmed(out.outcome === "trimmed");
    }
    track("linkedin_message_requested", {
      variant: req.variant,
      outcome: out.ok ? out.outcome : out.code === "REFUSED" ? "refused" : out.code === "RATE_LIMITED" ? "rate_limited" : "error",
      placeholders: out.ok ? countPlaceholders(out.text) : 0,
    });
  };

  const handleCopy = async () => {
    if (blocked || !message.trim()) return;
    try {
      await navigator.clipboard.writeText(message.trim());
      setCopied(true);
      track("linkedin_message_copied", { variant: messageVariant, over_cap: overCap });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is still selectable in edit mode */
      setEditing(true);
    }
  };

  const excerptSummary = [
    excerpt.headline && "your headline",
    excerpt.latestRole &&
      `your latest role (${excerpt.latestRole.title || "untitled"}${
        excerpt.latestRole.bullets.length
          ? `, ${excerpt.latestRole.bullets.length} bullet${excerpt.latestRole.bullets.length === 1 ? "" : "s"}`
          : ""
      })`,
    excerpt.skills.length && `${excerpt.skills.length} skill${excerpt.skills.length === 1 ? "" : "s"}`,
    (excerpt.visaStatus || excerpt.availability) && "your visa / availability line",
  ].filter(Boolean) as string[];

  return (
    <div style={{ width: "100%", maxWidth: 820, margin: "0 auto", padding: "24px 16px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--ff-ink)", margin: 0 }}>
          LinkedIn message
        </h1>
        <p style={{ fontSize: 14, color: "var(--ff-muted)", marginTop: 6, lineHeight: 1.5 }}>
          A short, first-person message to the recruiter or hiring manager about one role, written only from what is
          already in your CV. Nothing is invented: where a figure would help, you get a{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{"{{number}}"}</code> to fill in yourself.
        </p>
      </div>

      {!cvUsable && (
        <div
          role="status"
          style={{ padding: 16, borderRadius: 14, background: "var(--ff-card)", border: "1px solid var(--ff-line)", display: "flex", flexDirection: "column", gap: 10 }}
        >
          <strong style={{ fontSize: 15, color: "var(--ff-ink)" }}>Your CV is empty on this device</strong>
          <span style={{ fontSize: 13, color: "var(--ff-muted)", lineHeight: 1.5 }}>
            The message is written from your CV — add at least a role, a headline or a few skills first.
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
        <Field
          label="Job ad or recruiter's message"
          required
          hint="Paste the role description, or the note the recruiter sent you. Used to see what they want — never as a source of facts about you."
        >
          <textarea
            value={jobText}
            onChange={(e) => {
              setJobText(e.target.value);
              if (error) clearError();
            }}
            maxLength={LINKEDIN_MESSAGE_LIMITS.jobTextChars}
            rows={7}
            placeholder="e.g. Hi, I'm hiring an Operations Manager for a logistics group in Jebel Ali…"
            style={inputStyle}
          />
        </Field>
        <div style={{ fontSize: 12, color: "var(--ff-faint)", marginTop: -8, textAlign: "right" }}>
          {jobText.length.toLocaleString()} / {LINKEDIN_MESSAGE_LIMITS.jobTextChars.toLocaleString()}
        </div>
        {jobText.trim().length > 0 && jobText.trim().length < LINKEDIN_MESSAGE_LIMITS.jobTextMinChars ? (
          <p role="status" style={{ fontSize: 12, color: "var(--ff-faint)", marginTop: -4 }}>
            Paste at least {LINKEDIN_MESSAGE_LIMITS.jobTextMinChars} characters of the ad or the message so there is something to reply to.
          </p>
        ) : null}

        {/* Format toggle — the two things LinkedIn lets you send a stranger. */}
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: "var(--ff-ink)", marginBottom: 6 }}>Format</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(VARIANT_LABEL) as LinkedinMessageVariant[]).map((v) => {
              const active = variant === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVariant(v)}
                  className={active ? "cv-btn-primary cv-btn--sm" : "cv-btn-secondary cv-btn--sm"}
                >
                  {VARIANT_LABEL[v].title}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 12, color: "var(--ff-muted)" }}>{VARIANT_LABEL[variant].hint}.</span>
        </fieldset>

        {/* Disclosure — the one place this feature sends CV text. Mirrors
            lib/linkedinMessage/payload.ts; the privacy policy on www repeats it. */}
        <div
          style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ff-muted)", padding: "10px 12px", borderRadius: 10, background: "var(--ff-paper)", border: "1px solid var(--ff-line)" }}
        >
          <strong style={{ color: "var(--ff-ink)" }}>What leaves your browser:</strong>{" "}
          {excerptSummary.length ? excerptSummary.join(", ") : "a small excerpt of your CV"} and the text you pasted above are sent to
          our server and on to Anthropic (Claude) to write the message, then discarded. Your name, contact details, photo,
          summary and the rest of your CV stay on this device.
        </div>

        {error && (
          <div
            role={error.code === "REFUSED" ? "status" : "alert"}
            style={{ fontSize: 13, color: error.code === "REFUSED" ? "var(--ff-ink)" : "var(--ff-red)", lineHeight: 1.5 }}
          >
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
          {isLoading ? "Writing…" : message ? "Write it again" : "Write my message"}
        </button>
      </form>

      {message && (
        <section aria-label="Your LinkedIn message" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {blocked && (
            <div role="status" style={{ fontSize: 13, color: "var(--ff-warn)", lineHeight: 1.5 }}>
              {placeholderCount} figure{placeholderCount === 1 ? "" : "s"} to fill in. {PLACEHOLDER_HINT}
            </div>
          )}
          {editing ? (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              aria-label="Edit your LinkedIn message"
              style={{ ...inputStyle, padding: 16, lineHeight: 1.6, fontSize: 15 }}
            />
          ) : (
            <div
              style={{ whiteSpace: "pre-wrap", padding: 20, borderRadius: 16, background: "var(--ff-card)", boxShadow: "var(--shadow-float)", fontSize: 15, lineHeight: 1.6, color: "var(--ff-ink)" }}
            >
              <PlaceholderText text={message} />
            </div>
          )}
          <div
            aria-live="polite"
            style={{ fontSize: 12.5, color: overCap ? "var(--ff-red)" : "var(--ff-muted)", lineHeight: 1.5 }}
          >
            {messageVariant === "connection_note"
              ? `${chars} / ${CONNECTION_NOTE_MAX_CHARS} characters${overCap ? " — LinkedIn will cut this off; trim it before sending" : ""}`
              : `${words} words · ${chars} characters${trimmed ? ` — shortened to ${MESSAGE_WORDS.max} words by dropping whole sentences; read it through before sending` : ""}`}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="button" className="cv-btn-secondary" onClick={() => setEditing((v) => !v)}>
              <Icon name="edit" size={14} />
              {editing ? "Done editing" : "Edit"}
            </button>
            <button type="button" className="cv-btn-primary" onClick={handleCopy} disabled={blocked} title={blocked ? PLACEHOLDER_HINT : undefined}>
              <Icon name="linkedin" size={14} />
              {copied ? "Copied ✓" : "Copy message"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--ff-faint)", lineHeight: 1.5 }}>
            Read it once before sending — it is written from your CV, but you know the role better than any tool does.
          </p>
        </section>
      )}
    </div>
  );
};
