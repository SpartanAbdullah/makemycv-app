import type { Metadata } from "next";
import UploadDropzone from "@/components/resume-checker/UploadDropzone";

export const metadata: Metadata = {
  title: "Free ATS Resume Checker for UAE Jobs | MakeMyCV",
  description:
    "ATS-check your CV in 30 seconds. Free. No sign-up. Tested against the same parsers used by DIFC firms, UAE banks, and government entities.",
  alternates: { canonical: "https://app.makemycv.ae/resume-checker" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Free ATS Resume Checker for UAE Jobs",
    description:
      "Upload your CV, get a free ATS report in 30 seconds. No sign-up. Built for the UAE job market.",
    url: "https://app.makemycv.ae/resume-checker",
    type: "website",
  },
};

const CHECKS = [
  {
    title: "Content",
    description:
      "Does your summary, bullets, and language land with recruiters?",
  },
  {
    title: "Section Structure",
    description:
      "Are Contact, Experience, Education, and Skills clearly labelled and complete?",
  },
  {
    title: "ATS Essentials",
    description:
      "Email, phone, parseable dates, no tables, no images — the basics a filter actually reads.",
  },
  {
    title: "Design & Formatting",
    description:
      "Right length, clean skills, consistent education layout, no keyword stuffing.",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is this really free?",
    a: "Yes. The report is free and doesn't require sign-up. If you later want to fix the issues in our builder and export a polished PDF, that's a one-time $5 charge. No subscriptions.",
  },
  {
    q: "What do you do with my CV?",
    a: "We store the parsed report for 24 hours so you can revisit the URL, then it's automatically deleted. No accounts, no email list, no tracking pixels on the report page.",
  },
  {
    q: "Will this work for scanned PDFs?",
    a: "Not yet. Image-only PDFs (usually from phone scans) don't contain text we can read. Export a text-based PDF from Word or Google Docs and try again.",
  },
  {
    q: "How is this different from other ATS checkers?",
    a: "Most 'free' checkers show you half the report and paywall the rest. Ours shows everything — scores, issues, recommended fixes, all of it. The only thing we charge for is the final polished CV, if you want us to rebuild it for you.",
  },
  {
    q: "Does it work for UAE CVs with a photo?",
    a: "Yes, and we'll tell you whether your photo's layout is hurting the ATS parse. Many GCC employers still expect a photo — we just flag when it's placed badly.",
  },
];

export default function ResumeCheckerPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-3xl px-6 pb-8 pt-16 sm:pt-24">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-indigo-700">
            Free · No sign-up
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            ATS-check your CV in 30 seconds.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
            Tested against the same ATS parsers used by DIFC firms, UAE banks,
            and government entities. No email required.
          </p>
        </div>

        <UploadDropzone />

        <p className="mt-6 text-center text-xs text-slate-500">
          Your CV is processed securely and deleted after 24 hours. No account,
          no mailing list.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-semibold text-slate-900">
          What we check
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h3 className="mb-2 font-display text-lg font-semibold text-slate-900">
                {c.title}
              </h3>
              <p className="text-sm text-slate-600">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-semibold text-slate-900">
          Questions we get
        </h2>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-slate-200 bg-white p-5 open:border-indigo-200"
            >
              <summary className="cursor-pointer list-none text-base font-medium text-slate-900 marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  <span>{f.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 text-slate-400 transition group-open:rotate-180"
                  >
                    ▾
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
