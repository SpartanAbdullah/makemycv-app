"use client";

import { useEffect, useState } from "react";
import { TipJarModal } from "../TipJarModal";

/**
 * Surfaces the tip jar a short moment after the user lands on a successful
 * ATS report — the report page IS the success state, so we trigger on mount.
 * TipJarModal handles 90-day suppression and once-per-session guard, so this
 * wrapper just sets `open=true` after a beat. Server-component-safe shell.
 */
export default function PostReportTipJar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <TipJarModal
      open={open}
      context="post-ats-check"
      onClose={() => setOpen(false)}
    />
  );
}
