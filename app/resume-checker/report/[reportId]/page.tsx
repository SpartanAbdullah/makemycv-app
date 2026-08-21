import type { Metadata } from "next";
import Link from "next/link";
import { getReport } from "@/lib/resumeChecker/storage";
import ScoreSidebar from "@/components/resume-checker/ScoreSidebar";
import CategoryCard from "@/components/resume-checker/CategoryCard";
import ShareButton from "@/components/resume-checker/ShareButton";
import FixInBuilderButton from "@/components/resume-checker/FixInBuilderButton";
import PostReportTipJar from "@/components/resume-checker/PostReportTipJar";
import { Logo } from "@/components/Logo";
import { SUPPORT_URL } from "@/lib/config/support";

export const runtime = "nodejs";

export const metadata: Metadata = {
  // Bare title: the layout's template appends the brand suffix. Hardcoding it
  // here rendered "Your ATS Report | MakeMyCV | MakeMyCV" (same doubling as
  // audit ENG-19 on /resume-checker).
  title: "Your ATS Report",
  robots: { index: false, follow: false },
};

function getFirstName(first: string, last: string, fallback: string): string {
  const f = first.trim();
  if (f) return f;
  const l = last.trim();
  if (l) return l.split(/\s+/)[0];
  return fallback;
}

function shortReportId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const stored = await getReport(reportId);

  if (!stored) {
    return (
      <main className="flex min-h-screen items-center bg-paper-2 px-6">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-paper p-8 text-center shadow-sm-soft">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 text-slate-500"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Report not found or expired
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Reports are stored for 24 hours. Upload your CV again to get a
            fresh one.
          </p>
          <Link
            href="/resume-checker"
            className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-cta transition hover:-translate-y-0.5 hover:brightness-[1.08] hover:shadow-cta-hover"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--ff-accent) 0%, var(--ff-accent-dark) 100%)",
            }}
          >
            Upload a new CV
          </Link>
        </div>
      </main>
    );
  }

  const { cv, score } = stored;
  const firstName = getFirstName(cv.personal.firstName, cv.personal.lastName, "your");

  return (
    <main className="min-h-screen bg-paper-2 pb-24 lg:pb-16">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <Logo variant="horizontal" height={32} href="/resume-checker" />
            <span className="hidden text-xs text-slate-500 sm:inline">· ATS Checker</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">
              Report <span className="font-mono text-slate-700">{shortReportId(reportId)}</span> · available 24h
            </span>
            <ShareButton />
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Here&apos;s what we{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #0e7c4a 0%, #10b981 50%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              found
            </span>{" "}
            in {firstName === "your" ? "your" : `${firstName}'s`} CV.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Save this URL if you want to return. Not linked to any account —
            anyone with this link can view it until it auto-deletes in 24
            hours.
          </p>
        </div>
      </section>

      {/* Main two-column */}
      <section className="mx-auto max-w-6xl px-6 pt-8">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ScoreSidebar score={score} reportId={reportId} />
          <div className="space-y-4">
            {score.categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
            {/* Sentinel for PostReportTipJar — the tip prompt waits until
                the reader actually reaches the end of the report. */}
            <div data-report-end aria-hidden />
          </div>
        </div>
      </section>

      {/* Footer — subtle support link, NOT a CTA */}
      <footer className="mx-auto max-w-6xl px-6 pt-10 pb-12 text-center text-xs text-slate-500">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-slate-700"
        >
          Built by Abdullah
        </a>
      </footer>

      {/* Mobile sticky Fix CTA (hidden on lg+ where sidebar is visible) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
        <FixInBuilderButton reportId={reportId} />
      </div>

      {/* Tip jar — opens when the reader reaches the end of the report (or
          after 45s dwell). Suppressed for 90 days after a tip or dismissal,
          and once per session. NOT a blocker. */}
      <PostReportTipJar />
    </main>
  );
}
