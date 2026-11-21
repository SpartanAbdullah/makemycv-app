"use client";

import { useEffect } from "react";
import { track, trackOncePerSession } from "../../lib/analytics";
import { HUMAN_REVIEW_ON, HUMAN_REVIEW_URL } from "../../lib/config/humanReview";

/**
 * One line under the report mentioning the paid review, in a peer's tone.
 * Renders nothing until the release gate opens. `human_review_view` is the
 * exposure count for the Day 30 gate.
 */
export default function HumanReviewLine() {
  useEffect(() => {
    if (HUMAN_REVIEW_ON) trackOncePerSession("mmcv_hr_view_ck", "human_review_view", { surface: "post_checker" });
  }, []);

  if (!HUMAN_REVIEW_ON) return null;

  return (
    <section aria-label="Human CV review" className="mx-auto max-w-6xl px-6 pt-8">
      <p className="text-sm leading-relaxed text-slate-600">
        This check reads format, not story. For a person&apos;s notes on what to cut, move and add,
        there&apos;s a{" "}
        <a
          href={`${HUMAN_REVIEW_URL}?from=ck`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("cta_click", { cta_id: "human_review_post_checker", cta_location: "post_checker" })}
          className="font-semibold underline underline-offset-2 hover:text-slate-900"
        >
          human review from AED 79
        </a>
        <span aria-hidden="true"> →</span>
      </p>
    </section>
  );
}
