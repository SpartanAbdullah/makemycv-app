"use client";

import { useEffect } from "react";

// Module-level count of active lock holders. Reference counting (rather than
// each modal saving/restoring the previous overflow value) makes overlapping
// and non-LIFO release safe: e.g. AIResultsModal open while the download tip
// fires — whichever closes first, the page stays locked until the LAST holder
// releases, and unlocks exactly then. A save/restore pair in that scenario
// can restore "hidden" as the "previous" value and deadlock the page.
let lockCount = 0;

/** Locks body scrolling while `active` is true. Safe to compose across
 *  multiple simultaneously-open modals. */
export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    if (++lockCount === 1) document.body.style.overflow = "hidden";
    return () => {
      if (--lockCount === 0) document.body.style.overflow = "";
    };
  }, [active]);
}
