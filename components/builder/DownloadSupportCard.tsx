"use client";

import { useEffect } from "react";
import { SUPPORT_URL } from "../../lib/config/support";
import { HUMAN_REVIEW_URL } from "../../lib/config/humanReview";
import { track, trackOncePerSession } from "../../lib/analytics";
import { FOLLOW_PROFILES } from "../../lib/config/social";
import type { ExportAsk, ExportSentence } from "../../lib/exportAsks";
import { useCvStore } from "../../lib/store/cvStore";
import { RatingStrip } from "../feedback/RatingStrip";

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
 * One sentence and one row per export (2026-11-07). The parent picks the row
 * through `ask` (lib/exportAsks.ts), so a person is never handed the karak
 * line, a follow row, stars and an email form all at once.
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
  ask: ExportAsk;
  sentence: ExportSentence;
  onDismiss: () => void;
};

/* Same paths as the site's components/SocialIcons.tsx. Decorative: the link
   carries the aria-label. */
const GLYPHS: Record<(typeof FOLLOW_PROFILES)[number]["id"], React.ReactNode> = {
  linkedin: (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  ),
  instagram: (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/* Only ever rendered once the release gate is open. Same length budget as the
   karak line. `human_review_view` is the exposure count for the Day 30 gate. */
const ServiceLine = () => {
  useEffect(() => {
    trackOncePerSession("mmcv_hr_view_pe", "human_review_view", { surface: "post_export" });
  }, []);
  return (
    <p className="min-w-0">
      Want a person to read it too?{" "}
      <a
        href={`${HUMAN_REVIEW_URL}?from=pe`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-2 hover:opacity-80"
        onClick={() => track("cta_click", { cta_id: "human_review_post_export", cta_location: "post_export" })}
      >
        Human review from AED 79
      </a>
      <span aria-hidden="true"> →</span>
    </p>
  );
};

const FollowRow = () => (
  <div data-follow-row className="flex items-center gap-1">
    <span className="mr-1 font-medium">Follow us for UAE job tips</span>
    {FOLLOW_PROFILES.map(({ id, label, url }) => (
      <a
        key={id}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`MakeMyCV on ${label}`}
        onClick={() => track("cta_click", { cta_id: `social_${id}`, cta_location: "post_export" })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5"
      >
        {GLYPHS[id]}
      </a>
    ))}
  </div>
);

/* A small karak cup after the link text (2026-11-03). Same palette as the
   CSS cups on www/support (KarakPicker: gold body, foam top, gold handle);
   the steam takes the link colour. Decorative, so aria-hidden. */
const KarakCup = () => (
  <svg
    aria-hidden="true"
    width="16"
    height="16"
    viewBox="0 0 20 20"
    className="ml-1 inline-block align-[-3px]"
  >
    <path d="M7 2.5c-1 1 1 2 0 3.5M11 2.5c-1 1 1 2 0 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    <path d="M14 9.5h1.5a2.25 2.25 0 0 1 0 4.5H14" fill="none" stroke="#C49A48" strokeWidth="1.6" />
    <path d="M3.5 8h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill="#D4A95A" />
    <path d="M3.5 8h11v1.6h-11z" fill="#F6EFE0" />
  </svg>
);

export const DownloadSupportCard = ({ open, ask, sentence, onDismiss }: Props) => {
  // The address on the CV just downloaded, offered as the tips field's
  // starting value. It stays in the browser unless the person presses
  // "Send me tips" (see RatingStrip's prefillEmail).
  const cvEmail = useCvStore((s) => s.data.personal.email);
  if (!open) return null;

  return (
    <div
      role="status"
      data-download-support-card
      className="flex shrink-0 flex-col gap-2 border-b border-[var(--ff-accent-ring)] bg-[var(--ff-accent-soft)] px-4 py-2.5 text-sm leading-snug text-[var(--ff-accent-dark)] sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
      {/* Copy length is load-bearing, not cosmetic. Measured in a production
          build: this wraps to two lines (59.3px total, inside the 64px budget)
          at 320, 360 and 375px. An earlier draft opened with "Downloaded." and
          spilled to three lines (78.6px) at 320 and 360 — both real Android
          widths. Re-measure before lengthening it. The success toast already
          confirms the download, so the prefix was redundant anyway. */}
      {sentence === "service" ? (
        <ServiceLine />
      ) : (
      <p className="min-w-0">
        The builder stays free — if it helped,{" "}
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
          onClick={() => track("support_click", { surface: "post_export" })}
        >
          buy us a karak
          <KarakCup />
        </a>
        <span aria-hidden="true"> →</span>
      </p>
      )}
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
      {/* The one row for this export. The 64px budget above applies to the
          karak line only; this row pushes content down in-flow, it never
          covers anything. */}
      {ask === "follow" ? (
        <FollowRow />
      ) : (
        <RatingStrip surface="post_export" source="post_export" prefillEmail={cvEmail} only={ask} />
      )}
    </div>
  );
};

export default DownloadSupportCard;
