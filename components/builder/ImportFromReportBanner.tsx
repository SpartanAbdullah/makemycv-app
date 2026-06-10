"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCvStore } from "@/lib/store/cvStore";
import type { CvData } from "@/lib/types/cv";
import type { ParseSignals } from "@/lib/resumeChecker/types";

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

function hasUserContent(data: CvData): boolean {
  const p = data.personal;
  if (p.firstName.trim() || p.lastName.trim() || p.email.trim() || p.phone.trim() || p.summary.trim()) {
    return true;
  }
  if (data.experience.some((e) => e.company.trim() || e.role.trim() || e.bullets.some((b) => b.trim()))) {
    return true;
  }
  if (data.education.some((e) => e.school.trim() || e.degree.trim())) {
    return true;
  }
  if (data.skills.length > 0 || data.languages.length > 0) return true;
  return false;
}

export default function ImportFromReportBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("importedFrom");
  const hydrated = useCvStore((s) => s.hydrated);
  const currentData = useCvStore((s) => s.data);
  const importCvVersion = useCvStore((s) => s.importCvVersion);
  const setParseSignals = useCvStore((s) => s.setParseSignals);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const hasRunRef = useRef(false);

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
        const hadContent = hasUserContent(currentData);
        if (hadContent) {
          setPhase({
            kind: "confirm",
            imported: payload.cv,
            importedSignals,
          });
        } else {
          importCvVersion(payload.cv, "replace");
          setParseSignals(importedSignals);
          setPhase({ kind: "imported", replaced: true });
          stripParam();
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (phase.kind === "confirm") {
    return (
      <Modal>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Replace your existing CV?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You already have a CV in the builder. The imported CV from your ATS
          report has different content.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: "imported", replaced: false });
              stripParam();
              router.refresh();
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Keep my existing CV
          </button>
          <button
            type="button"
            onClick={() => {
              importCvVersion(phase.imported, "replace");
              setParseSignals(phase.importedSignals);
              setPhase({ kind: "imported", replaced: true });
              stripParam();
            }}
            className="rounded-lg bg-[var(--ff-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--ff-accent-dark)]"
          >
            Replace with imported CV
          </button>
        </div>
      </Modal>
    );
  }

  if (phase.kind === "imported") {
    return (
      <Banner tone="success" dismissible onDismiss={() => setPhase({ kind: "idle" })}>
        {phase.replaced
          ? "Imported from your ATS report. Review and edit any section."
          : "Kept your existing CV. Nothing imported."}
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
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
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
          className="text-current opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}
