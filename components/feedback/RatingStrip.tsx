"use client";

import { useState } from "react";
import { track } from "../../lib/analytics";
import { RATING_LIMITS, type RatingSurface } from "../../lib/feedback/rating";
import { CONSENT_TEXT, type SubscribeSource } from "../../lib/feedback/subscribe";
import { notifyClientValues, useClientValue } from "../consent/useClientValue";

/**
 * RatingStrip (2026-10-24) — the one thing we ask for after a success moment.
 *
 * Tap a star (that's the whole ask). Then, optionally, add a line and tick
 * "you may quote me". Then, optionally, leave an email for tips. Each step is
 * independent and each can be ignored; nothing blocks, nothing nags:
 *   - a star is asked once per 30 days per browser (mmcv_rated_at),
 *   - the email block disappears once an address has been sent (mmcv_subscribed_at),
 *   - both blocks hide when their server side is switched off
 *     (NEXT_PUBLIC_FEEDBACK / NEXT_PUBLIC_EMAIL_SIGNUP), so a half-configured
 *     deploy shows nothing rather than a broken form.
 *
 * Analytics params are enums and counts only — never the quote, never the email.
 */

const RATED_KEY = "mmcv_rated_at";
const SUBSCRIBED_KEY = "mmcv_subscribed_at";
const RATE_AGAIN_DAYS = 30;

const FEEDBACK_ON = process.env.NEXT_PUBLIC_FEEDBACK === "1";
const EMAIL_ON = process.env.NEXT_PUBLIC_EMAIL_SIGNUP === "1";

const recent = (key: string, days: number) => {
  try {
    const v = window.localStorage.getItem(key);
    return !!v && Date.now() - Date.parse(v) < days * 86400000;
  } catch {
    return false;
  }
};
const mark = (key: string) => {
  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    /* private mode */
  }
};

type Props = {
  surface: RatingSurface;
  source: SubscribeSource;
  /** Inline on a tinted strip (builder header) or standalone card (report page). */
  variant?: "strip" | "card";
};

const btnBase: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer",
  border: "1px solid var(--ff-accent)",
  background: "var(--ff-accent)",
  color: "#fff",
};
const btnGhost: React.CSSProperties = { ...btnBase, background: "transparent", color: "var(--ff-accent-dark)" };
const input: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--ff-line)",
  background: "var(--ff-card)",
  color: "var(--ff-ink)",
  minWidth: 0,
};

export const RatingStrip = ({ surface, source, variant = "strip" }: Props) => {
  // Browser-only reads, false on the server and the first paint.
  const showStars = useClientValue(() => FEEDBACK_ON && !recent(RATED_KEY, RATE_AGAIN_DAYS), false);
  const showEmail = useClientValue(() => EMAIL_ON && !recent(SUBSCRIBED_KEY, 3650), false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [ticket, setTicket] = useState<{ id: string; token: string } | null>(null);
  const [phase, setPhase] = useState<"idle" | "sending" | "thanks" | "quote" | "quoted" | "failed">("idle");
  const [quote, setQuote] = useState("");
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [emailPhase, setEmailPhase] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  // Once a block has been answered its client value flips to false (so the
  // NEXT visit stays quiet); keep it mounted now so the thanks line shows.
  const starsVisible = showStars || phase !== "idle";
  const emailVisible = showEmail || emailPhase !== "idle";
  if (!starsVisible && !emailVisible) return null;

  const rate = async (n: number) => {
    if (phase !== "idle") return;
    setStars(n);
    setPhase("sending");
    try {
      const res = await fetch("/api/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stars: n, surface }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; token?: string } | null;
      if (res.ok && data?.id && data.token) {
        setTicket({ id: data.id, token: data.token });
        mark(RATED_KEY);
        track("rating_submit", { stars: n, surface });
        setPhase("thanks");
      } else {
        setPhase("failed");
      }
    } catch {
      setPhase("failed");
    }
  };

  const sendQuote = async () => {
    if (!ticket || !quote.trim()) return;
    try {
      const res = await fetch("/api/rating", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...ticket, quote: quote.trim(), quoteConsent: consent, displayName: name, displayRole: role }),
      });
      track("rating_quote", { surface, consent });
      setPhase(res.ok ? "quoted" : "failed");
    } catch {
      setPhase("failed");
    }
  };

  const subscribe = async () => {
    if (emailPhase === "sending" || !email.trim()) return;
    setEmailPhase("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (res.ok) {
        mark(SUBSCRIBED_KEY);
        track("email_subscribe", { source });
        setEmailPhase("sent");
        // Other strips on the page (none today) would hide their email block too;
        // this one keeps rendering its "check your inbox" line via emailPhase.
        notifyClientValues();
      } else {
        setEmailPhase("failed");
      }
    } catch {
      setEmailPhase("failed");
    }
  };

  const wrap: React.CSSProperties =
    variant === "card"
      ? { padding: 18, borderRadius: 16, background: "var(--ff-card)", border: "1px solid var(--ff-line)", display: "flex", flexDirection: "column", gap: 12 }
      : { display: "flex", flexDirection: "column", gap: 10 };

  return (
    <div data-rating-strip style={wrap}>
      {starsVisible && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {phase === "idle" || phase === "sending" ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ff-ink)" }}>How was MakeMyCV today?</span>
              <div role="group" aria-label="Rate MakeMyCV from 1 to 5 stars" style={{ display: "inline-flex", gap: 2 }} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    disabled={phase === "sending"}
                    onClick={() => void rate(n)}
                    onMouseEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    style={{
                      width: 36,
                      height: 36,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 24,
                      lineHeight: 1,
                      color: n <= (hover || stars) ? "#C49A48" : "var(--ff-faint)",
                      padding: 0,
                    }}
                  >
                    {n <= (hover || stars) ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </>
          ) : phase === "failed" ? (
            <span style={{ fontSize: 13, color: "var(--ff-muted)" }}>Couldn’t save that right now — no harm done.</span>
          ) : phase === "quoted" ? (
            <span style={{ fontSize: 14, color: "var(--ff-ink)" }}>Thank you — that helps more than you know.</span>
          ) : phase === "quote" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuote();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 560 }}
            >
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ff-ink)" }}>
                One line about your experience
                <textarea
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  maxLength={RATING_LIMITS.quote}
                  rows={2}
                  required
                  style={{ ...input, display: "block", width: "100%", marginTop: 4, resize: "vertical" }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--ff-muted)" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span>You may quote me on makemycv.ae. I’ll review it first — and you can add a first name and role if you like.</span>
              </label>
              {consent && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={RATING_LIMITS.displayName} placeholder="First name (optional)" style={{ ...input, flex: 1 }} />
                  <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={RATING_LIMITS.displayRole} placeholder="Role, e.g. Nurse (optional)" style={{ ...input, flex: 1 }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={btnBase}>Send</button>
                <button type="button" style={btnGhost} onClick={() => setPhase("thanks")}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <span style={{ fontSize: 14, color: "var(--ff-ink)" }}>Thanks for the {stars}-star rating!</span>
              {ticket && (
                <button type="button" style={btnGhost} onClick={() => setPhase("quote")}>
                  Add a line (optional)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {emailVisible && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {emailPhase === "sent" ? (
            <span style={{ fontSize: 13, color: "var(--ff-ink)" }}>Check your inbox — one tap to confirm, and you’re in.</span>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void subscribe();
              }}
              style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
            >
              <label htmlFor={`sub-${source}`} style={{ fontSize: 13, color: "var(--ff-muted)", flexBasis: "100%" }}>
                {CONSENT_TEXT}
              </label>
              <input
                id={`sub-${source}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ ...input, flex: "1 1 220px" }}
              />
              <button type="submit" disabled={emailPhase === "sending"} style={btnBase}>
                {emailPhase === "sending" ? "Sending…" : "Send me tips"}
              </button>
              {emailPhase === "failed" && <span style={{ fontSize: 12, color: "var(--ff-muted)" }}>Didn’t go through — try again later.</span>}
            </form>
          )}
        </div>
      )}
    </div>
  );
};
