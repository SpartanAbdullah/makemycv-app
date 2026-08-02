"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useCvStore } from "@/lib/store/cvStore";
import { mapCvToParsed } from "@/lib/importers/fieldMapper";
import type { CvData } from "@/lib/types/cv";
import type { ParseSignals } from "@/lib/resumeChecker/types";

// Same dynamic split as BuilderShell — the review screen loads only when an
// import is actually in flight.
const MappingReview = dynamic(
  () => import("../import/MappingReview").then((m) => m.MappingReview),
  { ssr: false },
);

type Phase =
  | { kind: "idle" }
  | { kind: "fetching" }
  | {
      kind: "confirm";
      imported: CvData;
      importedSignals: ParseSignals | null;
    }
  | { kind: "imported"; replaced: boolean }
  | { kind: "error"; message: string };

export default function ImportFromReportBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("importedFrom");
  const hydrated = useCvStore((s) => s.hydrated);
  const importCvVersion = useCvStore((s) => s.importCvVersion);
  const setParseSignals = useCvStore((s) => s.setParseSignals);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const hasRunRef = useRef(false);

  // ParsedDocument view of the imported CV for MappingReview (audit UX-8).
  const parsedForReview = useMemo(
    () => (phase.kind === "confirm" ? mapCvToParsed(phase.imported) : null),
    [phase],
  );

  // Strip the query param once we've taken action.
  const stripParam = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("importedFrom");
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    if (!reportId || hasRunRef.current || !hydrated) return;
    hasRunRef.current = true;

    let cancelled = false;
    const run = async () => {
      setPhase({ kind: "fetching" });
      try {
        const res = await fetch(`/api/resume-checker/import/${reportId}`, {
          method: "POST",
        });
        if (!res.ok) {
          if (cancelled) return;
          setPhase({
            kind: "error",
            message:
              res.status === 404
                ? "This report expired. Reports are kept for 24 hours."
                : "Couldn't import the report. Try uploading the CV again.",
          });
          stripParam();
          return;
        }
        const payload = (await res.json()) as {
          cv?: CvData;
          parseSignals?: ParseSignals;
        };
        if (!payload.cv) {
          if (cancelled) return;
          setPhase({ kind: "error", message: "Report returned no CV data." });
          stripParam();
          return;
        }
        if (cancelled) return;

        const importedSignals: ParseSignals | null =
          payload.parseSignals ?? null;
        // ALWAYS review (audit UX-8): the AI parser misassigns fields just
        // like the heuristic one (it falls back to the same textParser), so
        // its output goes through the same MappingReview screen instead of
        // landing in the store unreviewed.
        setPhase({
          kind: "confirm",
          imported: payload.cv,
          importedSignals,
        });
      } catch {
        if (cancelled) return;
        setPhase({
          kind: "error",
          message: "Network error while importing the report.",
        });
        stripParam();
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // Intentionally only depends on reportId + hydrated — currentData snapshot taken once.
  }, [reportId, hydrated]);

  if (phase.kind === "idle" && !reportId) return null;

  if (phase.kind === "fetching") {
    return (
      <Banner tone="info">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ff-accent-ring)] border-t-[var(--ff-accent)]" />
          Importing your CV from the ATS report…
        </span>
      </Banner>
    );
  }

  if (phase.kind === "confirm" && parsedForReview) {
    // The AI-parsed CV flows through the SAME field-review screen as the
    // heuristic import — per-field edit, role↔company swaps, Replace/Merge
    // choice — instead of the old blind Replace/Keep modal (audit UX-8).
    return (
      <MappingReview
        source="ATS report"
        parsed={parsedForReview}
        onConfirm={(partial, mode) => {
          importCvVersion(partial, mode);
          setParseSignals(phase.importedSignals);
          setPhase({ kind: "imported", replaced: mode === "replace" });
          stripParam();
        }}
        onCancel={() => {
          setPhase({ kind: "imported", replaced: false });
          stripParam();
        }}
      />
    );
  }

  if (phase.kind === "imported") {
    return (
      <Banner tone="success" dismissible onDismiss={() => setPhase({ kind: "idle" })}>
        {phase.replaced ? (
          <span>
            Imported from your ATS report. Reports can&apos;t carry visa
            status, notice period or nationality —{" "}
            <button
              type="button"
              onClick={() => router.push("/builder?step=uaeEssentials")}
              className="font-semibold underline underline-offset-2"
            >
              add them now →
            </button>
          </span>
        ) : (
          "Kept your existing CV. Nothing imported."
        )}
      </Banner>
    );
  }

  if (phase.kind === "error") {
    return (
      <Banner tone="error" dismissible onDismiss={() => setPhase({ kind: "idle" })}>
        {phase.message}
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  children,
  dismissible,
  onDismiss,
}: {
  tone: "info" | "success" | "error";
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}) {
  // Success shares the ff-accent tokens with info — one green, not two.
  // The states never coexist and stay distinguished by spinner vs
  // dismissible content.
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-[var(--ff-accent-ring)] bg-[var(--ff-accent-soft)] text-[var(--ff-accent-dark)]";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center justify-between gap-3 border ${toneClass} px-4 py-2.5 text-sm`}
    >
      <div>{children}</div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-my-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-current opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// (The old blind Replace/Keep Modal was removed in the 2026-06 wave-3 work —
// the confirm phase now renders MappingReview instead.)
