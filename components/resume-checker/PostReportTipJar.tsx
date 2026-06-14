"use client";

import { useEffect, useState } from "react";
import { TipJarModal } from "../TipJarModal";

/**
 * Surfaces the tip jar AFTER the user has consumed the report, not on
 * arrival. The old version fired 1500ms after mount — before a single
 * category card was read, covering the whole report on mobile (audit
 * ENG-10). Now it opens when the reader reaches the end of the report
 * (an IntersectionObserver on the `[data-report-end]` sentinel rendered
 * by the report page) or after 45s of dwell, whichever comes first.
 * TipJarModal still owns the 90-day suppression and once-per-session
 * guard. Server-component-safe shell.
 */
export default function PostReportTipJar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let opened = false;
    const openOnce = () => {
      if (opened) return;
      opened = true;
      setOpen(true);
    };

    const dwell = window.setTimeout(openOnce, 45000);

    const sentinel = document.querySelector("[data-report-end]");
    let observer: IntersectionObserver | null = null;
    if (sentinel && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) openOnce();
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      observer.observe(sentinel);
    }

    return () => {
      window.clearTimeout(dwell);
      observer?.disconnect();
    };
  }, []);

  return (
    <TipJarModal
      open={open}
      context="post-ats-check"
      onClose={() => setOpen(false)}
    />
  );
}
