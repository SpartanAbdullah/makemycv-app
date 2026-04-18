import type { Metadata } from "next";
import Link from "next/link";
import { getReport } from "@/lib/resumeChecker/storage";
import ScoreSidebar from "@/components/resume-checker/ScoreSidebar";
import CategoryCard from "@/components/resume-checker/CategoryCard";
import ShareButton from "@/components/resume-checker/ShareButton";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Your ATS Report | MakeMyCV",
  robots: { index: false, follow: false },
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFirstName(first: string, last: string, fallback: string): string {
  const f = first.trim();
  if (f) return f;
  const l = last.trim();
  if (l) return l.split(/\s+/)[0];
  return fallback;
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
      <main className="flex min-h-screen items-center bg-slate-50 px-6">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"
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
            className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Upload a new CV
          </Link>
        </div>
      </main>
    );
  }

  const { cv, score, createdAt } = stored;
  const firstName = getFirstName(cv.personal.firstName, cv.personal.lastName, "your");

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link
            href="/resume-checker"
            className="font-display text-base font-semibold text-slate-900"
          >
            MakeMyCV · ATS Checker
          </Link>
          <ShareButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="mb-8">
          <div className="text-sm text-slate-500">
            Generated {formatDate(createdAt)} · available for 24 hours
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Here&apos;s what we found in{" "}
            {firstName === "your" ? "your" : `${firstName}'s`} CV.
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Save this URL if you want to return — reports are anonymous and
            auto-delete in 24 hours.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ScoreSidebar score={score} reportId={reportId} />
          <div className="space-y-4">
            {score.categories.map((cat) => (
              <CategoryCard key={cat.category} category={cat} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
