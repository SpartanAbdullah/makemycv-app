import type { Metadata } from "next";
import UploadDropzone from "@/components/resume-checker/UploadDropzone";
import ExampleReportPreview from "@/components/resume-checker/ExampleReportPreview";
import { Logo } from "@/components/Logo";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  appWebSiteSchema,
  breadcrumbListSchema,
  faqPageSchema,
  webApplicationSchema,
} from "@/lib/seo/schema";

export const metadata: Metadata = {
  // No "| MakeMyCV" here — the layout's title template appends it, and
  // including it twice produced "… | MakeMyCV | MakeMyCV" (audit ENG-19).
  title: "Free ATS Resume Checker for UAE Jobs",
  description:
    "ATS-check your CV in about 30 seconds. Free, no sign-up. We test the same things an ATS does: raw text extraction, section detection, and parse-blocking formatting.",
  alternates: { canonical: "https://app.makemycv.ae/resume-checker" },
  robots: { index: true, follow: true },
  // Page-level openGraph/twitter REPLACE the layout's objects wholesale, so
  // images/siteName/locale must be restated or WhatsApp/LinkedIn previews
  // lose their image on the one page built to be shared (audit ENG-19).
  openGraph: {
    title: "Free ATS Resume Checker for UAE Jobs",
    description:
      "Upload your CV, get a free ATS report in about 30 seconds. No sign-up. Built for the UAE job market.",
    url: "https://app.makemycv.ae/resume-checker",
    type: "website",
    siteName: "MakeMyCV",
    locale: "en_AE",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MakeMyCV - Free ATS Resume Checker for UAE Jobs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free ATS Resume Checker for UAE Jobs",
    description:
      "Upload your CV, get a free ATS report in about 30 seconds. No sign-up. Built for the UAE job market.",
    images: ["/og-image.png"],
    creator: "@makemycv",
  },
};

type Check = { title: string; description: string; icon: React.ReactNode };

const CHECKS: Check[] = [
  {
    title: "Content",
    description: "Summary depth, bullet quality, quantified impact.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
      </svg>
    ),
  },
  {
    title: "Section Structure",
    description: "Right sections, complete fields, recruiter-scannable.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    title: "ATS Essentials",
    description: "Parseable format, clean dates, no tables or images.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M9 15l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Design & Formatting",
    description: "Length, skills coverage, visual hierarchy.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 1010 10c0-1.3-1-2-2-2h-3a2 2 0 01-2-2 2 2 0 00-2-2H9a3 3 0 000-6z" />
      </svg>
    ),
  },
];

const STEPS: Array<{ n: string; title: string; description: string }> = [
  { n: "1", title: "Upload", description: "Drop your PDF. No account, no email." },
  { n: "2", title: "Parse", description: "We extract and score against ATS rules." },
  { n: "3", title: "Review", description: "Read every issue and fix with guidance." },
];

// `a` is the plain-text answer (also mirrored into the FAQPage JSON-LD);
// `aJsx` optionally overrides the on-page rendering so answers can carry
// links without putting markup into the structured data.
const FAQS: Array<{ q: string; a: string; aJsx?: React.ReactNode }> = [
  {
    q: "What formats do you support?",
    a: "Text-based PDF today — the format you get when you export from Word, Google Docs, or most builders. DOCX is on the v2 roadmap. Scanned image PDFs (from phone photos) aren't supported yet because there's no readable text to score.",
  },
  {
    q: "What happens to my CV?",
    a: "Your PDF never uploads — your browser extracts the text and sends only that. We use an AI service (Anthropic) to parse it into a report, store the report for 24 hours so you can revisit the URL, then it auto-deletes. No accounts, no email list, no tracking pixels.",
  },
  {
    q: "Is it really free?",
    a: "Yes — the report and the builder are both free, no sign-up, no payment. If MakeMyCV saves you time and you want to help cover hosting and AI costs, there's a tip jar — but it's entirely optional.",
    aJsx: (
      <>
        Yes &mdash; the report and{" "}
        <a href="/builder" className="underline underline-offset-2 text-brand-blue hover:text-brand-blue-dark">
          the builder
        </a>{" "}
        are both free, no sign-up, no payment. If MakeMyCV saves you time and
        you want to help cover hosting and AI costs, there&apos;s a tip jar
        &mdash; but it&apos;s entirely optional.
      </>
    ),
  },
  {
    q: "How accurate is the parser?",
    a: "Our checker runs the same steps an ATS runs: extract the raw text, detect the sections, and flag formatting that blocks parsing. If our extraction path can't read a section cleanly, an ATS likely can't either — which is the signal you actually want.",
  },
];

export default function ResumeCheckerPage() {
  return (
    <main className="min-h-screen bg-paper-2">
      {/* JSON-LD — emitted server-side so crawlers and AI fetchers see schema
          in the initial HTML. WebApplication describes the tool itself;
          FAQPage mirrors the visible <details> Q/As below; BreadcrumbList
          gives the page its position in the site graph. */}
      <JsonLd data={appWebSiteSchema()} />
      <JsonLd data={webApplicationSchema()} />
      <JsonLd
        data={faqPageSchema(FAQS.map((f) => ({ q: f.q, a: f.a })))}
      />
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", item: "https://app.makemycv.ae/" },
          { name: "ATS Resume Checker" },
        ])}
      />

      {/* HERO */}
      <section
        className="relative overflow-hidden pb-32 pt-20 md:pb-40 md:pt-24"
        style={{
          background:
            "linear-gradient(180deg, var(--brand-ink) 0%, var(--brand-deep) 55%, var(--brand-ink) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 35%, rgba(37,99,235,0.22), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="mb-8 flex justify-center">
            <Logo variant="white" height={32} href="/" />
          </div>
          <div className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
            Free · No sign-up · UAE-focused
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            ATS-check your CV in about 30 seconds.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/70 sm:text-lg">
            We read your CV the way ATS software does &mdash; raw text
            extraction and section detection &mdash; and flag exactly what
            breaks. No email required.
          </p>
          {/* Answer-first definition paragraph — sits directly under the hero
              so an AI engine can extract a self-contained "what is this?" /
              "what does it do?" answer from the first ~80 words. No fabricated
              stats; describes the mechanism, not a number. */}
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
            An ATS (Applicant Tracking System) is the software UAE employers
            use to filter CVs before a recruiter sees them. If the parser
            can&apos;t read your file cleanly, the application stops there.
            This free checker reads your CV the same way an ATS does &mdash;
            raw text extraction and section detection &mdash; and flags
            exactly what breaks it, in about 30 seconds, no sign-up.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-xs text-white/50">
            Your CV is processed securely and deleted after 24 hours.
          </p>
        </div>
      </section>

      {/* SPLIT-SCREEN CONVERSION */}
      <section className="relative -mt-24 pb-20 md:-mt-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:gap-8 lg:grid-cols-2 lg:items-start">
            <div>
              <UploadDropzone />
            </div>
            <div>
              <ExampleReportPreview />
              <p className="mt-3 text-center text-xs text-slate-500">
                Here&apos;s what you&apos;ll see in about 30 seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE CHECK */}
      <section className="border-t border-line bg-paper py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-3xl font-bold text-slate-900">
            What we check
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-600">
            Four categories, same rubric, every CV.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CHECKS.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-line bg-paper p-5 shadow-sm-soft transition hover:shadow-md-soft"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                  {c.icon}
                </div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {c.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-paper-2 py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white shadow-sm-soft">
                  {s.n}
                </div>
                <div>
                  <div className="font-display text-sm font-semibold text-slate-900">
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-600">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-paper py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center font-display text-3xl font-bold text-slate-900">
            Questions we get
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-line bg-paper p-5 shadow-sm-soft open:border-brand-blue/40"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-medium text-slate-900 marker:hidden">
                  <span>{f.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 text-slate-400 transition group-open:rotate-180"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.aJsx ?? f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section
        className="relative overflow-hidden py-20 text-center"
        style={{
          background:
            "linear-gradient(180deg, var(--brand-ink) 0%, var(--brand-deep) 55%, var(--brand-ink) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 40% 45% at 50% 50%, rgba(37,99,235,0.20), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Ready to see how your CV scores?
          </h2>
          <a
            href="#resume-checker-dropzone"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-6 py-3.5 text-sm font-semibold text-white shadow-cta-blue transition hover:-translate-y-0.5 hover:bg-brand-blue-dark hover:shadow-cta-blue-hover"
            style={{ backgroundImage: "linear-gradient(135deg, var(--brand-blue) 0%, var(--brand-blue-dark) 100%)" }}
          >
            Upload your CV
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
          <p className="mt-4 text-xs text-white/60">
            Free. No account. Takes about 30 seconds.
          </p>
          <p className="mt-3 text-sm text-white/70">
            No CV yet?{" "}
            <a
              href="/builder"
              className="font-semibold text-white underline underline-offset-2 hover:text-white/90"
            >
              Build one free &rarr;
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
