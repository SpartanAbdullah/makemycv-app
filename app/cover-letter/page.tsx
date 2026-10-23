import type { Metadata } from "next";
import { CoverLetterPanel } from "../../components/coverletter/CoverLetterPanel";

export const metadata: Metadata = {
  title: "Cover Letter — Written From Your CV",
  description:
    "A short UAE-style cover letter written only from what is already in your CV " +
    "and the job you are applying to. Free, no sign-up.",
  robots: { index: false, follow: false },
};

export default function CoverLetterPage() {
  // Same full-height shell as /jd-match; the panel renders its own top bar.
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "var(--ff-paper)",
        fontFamily: "var(--font-body)",
      }}
    >
      <CoverLetterPanel />
    </main>
  );
}
