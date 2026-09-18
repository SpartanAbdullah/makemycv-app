"use client";

import { SUPPORT_URL } from "../../lib/config/support";

/**
 * DownloadSupportCard — the post-export support ask, inline.
 *
 * Replaces DownloadTipModal (deleted 2026-09-18). Same trigger, same
 * moment, far less cost to the user: this is an in-flow strip in the
 * builder's header stack, not a fixed overlay. It never covers the
 * Download button (which lives in the sticky TopBar *above* this slot),
 * never locks body scroll, and never has to be dismissed to keep working.
 *
 * Deliberately NOT bottom-anchored: the bottom band below `xl` is already
 * owned by the fixed Edit|Preview pill (bottom:20) and the Toaster
 * (bottom:96). A card there would collide with both.
 *
 * Frequency is the PARENT's business — this component has no localStorage,
 * no timers and no suppression. BuilderShell re-opens it on every
 * successful non-JSON export by design (2026-09-18 decision; supersedes
 * the 90-day + once-per-session suppression the modal carried).
 *
 * One link, not two. The old modal fired Ko-fi and PayPal directly; this
 * sends people to www.makemycv.ae/support, which presents both properly
 * via <TipJar variant="full">. That also keeps the mobile row to one
 * line and one control.
 *
 * It does NOT write `mmcv_tipped_at`. Clicking through to /support is not
 * proof of a tip, and that key also suppresses TipJarModal on the
 * resume-checker for 90 days — writing it here would silently disable an
 * unrelated surface.
 *
 * Tokens are the ff-accent trio, matching the Banner in
 * ImportFromReportBanner.tsx: info and success share one green, not two.
 */

type Props = {
  open: boolean;
  onDismiss: () => void;
};

export const DownloadSupportCard = ({ open, onDismiss }: Props) => {
  if (!open) return null;

  return (
    <div
      role="status"
      data-download-support-card
      className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ff-accent-ring)] bg-[var(--ff-accent-soft)] px-4 py-2.5 text-sm leading-snug text-[var(--ff-accent-dark)] sm:px-6"
    >
      {/* Copy length is load-bearing, not cosmetic. Measured in a production
          build: this wraps to two lines (59.3px total, inside the 64px budget)
          at 320, 360 and 375px. An earlier draft opened with "Downloaded." and
          spilled to three lines (78.6px) at 320 and 360 — both real Android
          widths. Re-measure before lengthening it. The success toast already
          confirms the download, so the prefix was redundant anyway. */}
      <p className="min-w-0">
        MakeMyCV is free and always will be — if it helped,{" "}
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          buy me a karak
        </a>
        <span aria-hidden="true"> →</span>
      </p>
      {/* 32px visual + .ff-hit-target's 8px bleed = 48px touch target. */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ff-hit-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
};

export default DownloadSupportCard;
