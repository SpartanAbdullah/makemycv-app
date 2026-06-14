import type { Metadata } from "next";
import Link from "next/link";

/* 404 page (audit 2026-06-12, gap #2). Server component — no client JS
 * needed. Funnels lost visitors back to the two product surfaces. */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--surface-page)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: "var(--surface-card)",
          borderColor: "var(--border-soft)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <p
          className="text-sm font-semibold tracking-wide"
          style={{ color: "var(--brand-primary)", fontFamily: "var(--font-mono)" }}
        >
          404
        </p>
        <h1
          className="mt-2 text-xl font-semibold"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          The link may be old or mistyped. Your CV — if you started one — is
          still saved in this browser.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/builder"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--brand-primary)" }}
          >
            Open the CV builder
          </Link>
          <Link
            href="/resume-checker"
            className="rounded-full border px-5 py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--border-medium)", color: "var(--text-body)" }}
          >
            Check my CV (free)
          </Link>
        </div>
      </div>
    </main>
  );
}
