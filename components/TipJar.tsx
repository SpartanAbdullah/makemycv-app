"use client";

import { KofiIcon } from "./KofiIcon";

/**
 * TipJar — Ko-fi-primary, PayPal-secondary tip surface.
 *
 * No amount picker, no emoji-by-amount feedback, no deep-linked amount
 * in the PayPal URL. Ko-fi's own page handles amount selection, and the
 * PayPal alternative is a bare `paypal.me/<handle>` so users without a
 * Ko-fi account can still pick whatever they want.
 *
 * `full` variant is the page-level component (used on the marketing
 * /support page if/when consumed). `compact` is the in-modal variant
 * used by TipJarModal (which is in turn used by PostReportTipJar after
 * the ATS check).
 *
 * Both variants share the same body; only the heading, the optional
 * "Tip Jar" pill, and the outer padding change.
 *
 * See DECISION_LOG.md 2026-05-31 (final tip surface) for the why.
 */

const KOFI_USERNAME =
  process.env.NEXT_PUBLIC_KOFI_USERNAME || "makemycv_ae";
const PAYPAL_HANDLE =
  process.env.NEXT_PUBLIC_PAYPAL_ME_HANDLE || "Abdullah2431";

const KOFI_URL = `https://ko-fi.com/${KOFI_USERNAME}`;
const PAYPAL_URL = `https://paypal.me/${PAYPAL_HANDLE}`;

interface TipJarProps {
  variant?: "full" | "compact";
  context?: string;
  onDismiss?: () => void;
}

function markTipped() {
  try {
    localStorage.setItem("mmcv_tipped_at", new Date().toISOString());
  } catch {
    /* private mode / quota — silent fail */
  }
}

export const TipJar = ({
  variant = "full",
  context,
  onDismiss,
}: TipJarProps) => {
  const isCompact = variant === "compact";

  const openTipUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    markTipped();
    if (onDismiss) {
      // 500ms is enough for the new tab to take focus before the host
      // modal collapses behind it — avoids a jarring blink.
      setTimeout(onDismiss, 500);
    }
  };

  return (
    <div
      data-context={context}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card-blue card-lift ${
        isCompact ? "p-6" : "p-6 md:p-8"
      }`}
    >
      {/* Accent bar (full variant only) */}
      {!isCompact && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background:
              "linear-gradient(90deg, var(--ff-accent) 0%, var(--ff-accent-dark) 50%, var(--ff-accent) 100%)",
          }}
        />
      )}

      <div className="flex items-baseline justify-between gap-3">
        <h3
          className={`font-display font-bold text-slate-900 ${
            /* 22px matches DownloadTipModal's picking-phase heading — the
               two tip surfaces share one shell spec (audit o4). */
            isCompact ? "text-[22px]" : "text-2xl md:text-3xl"
          }`}
        >
          {isCompact ? "Did this help?" : "Support a free tool"}
        </h3>
        {!isCompact && (
          <span className="rounded-full bg-[var(--ff-accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--ff-accent)]">
            Tip Jar
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-brand-muted">
        MakeMyCV is free for everyone — including people who can&apos;t pay
        right now. A small tip keeps it that way.
      </p>

      {/* Primary CTA — Ko-fi. Big, full-width, brand green. The icon + label
          are horizontally centred with a comfortable gap. */}
      <button
        type="button"
        onClick={() => openTipUrl(KOFI_URL)}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--ff-accent)] px-6 py-4 text-base font-bold text-white transition-colors hover:bg-[var(--ff-accent-dark)] active:bg-[var(--ff-accent-dark)]"
      >
        <KofiIcon size={22} />
        <span>Tip via Ko-fi</span>
      </button>

      {/* Secondary — PayPal. Bare paypal.me link, no deep-linked amount. */}
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => openTipUrl(PAYPAL_URL)}
          className="inline-flex items-center gap-1 text-sm text-slate-600 transition-colors hover:text-slate-900 hover:underline"
        >
          Prefer PayPal? Tip via PayPal instead{" "}
          <span aria-hidden="true">{"→"}</span>
        </button>
      </div>

      {/* Reassurance microcopy */}
      <p className="mt-5 text-sm leading-relaxed text-slate-500">
        Built by Abdullah, a solo developer in Dubai. Ko-fi accepts cards
        without a PayPal account; tips go directly to him.
      </p>
    </div>
  );
};

export default TipJar;
