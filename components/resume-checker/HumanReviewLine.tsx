"use client";

import { useEffect, useRef } from "react";
import { track, trackOncePerSession } from "../../lib/analytics";
import { HUMAN_REVIEW_ON, HUMAN_REVIEW_URL } from "../../lib/config/humanReview";

/**
 * One line under the report mentioning the paid review, in a peer's tone.
 * Renders nothing until the release gate opens. `human_review_view` is the
 * exposure count for the Day 30 gate.
 *
 * The event fires when the line scrolls into view, not on mount (2026-11-23).
 * The line sits under the whole report, so counting on mount also counted
 * everyone who left before reaching it, which inflates the exposure figure the
 * stop rule is read against ("0-1 sales from about 800 exposures"). Checker
 * exposures recorded from 21 to 23 Nov 2026 are page loads, not views.
 */
export default function HumanReviewLine() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!HUMAN_REVIEW_ON) return;
    const el = ref.current;
    if (!el) return;
    const fire = () =>
      trackOncePerSession("mmcv_hr_view_ck", "human_review_view", { surface: "post_checker" });
    // No observer support: count nothing rather than count a page load as a view.
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fire();
          observer.disconnect();
        }
      },
      // Half the line on screen: a sliver at the bottom edge is not a view.
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!HUMAN_REVIEW_ON) return null;

  return (
    <section ref={ref} aria-label="Human CV review" className="mx-auto max-w-6xl px-6 pt-8">
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
