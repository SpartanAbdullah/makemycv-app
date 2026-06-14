import type { Metadata } from "next";
import { JdMatchPanel } from "../../components/jdmatch/JdMatchPanel";

export const metadata: Metadata = {
  title: "JD Match — Check Your CV Against a Job",
  description:
    "Paste a UAE job description and see how well your CV matches it: " +
    "your match score plus the keywords you cover and the ones you're missing. " +
    "Free, no sign-up, your CV stays in your browser.",
  robots: { index: false, follow: false },
};

export default function JdMatchPage() {
  // Full-height shell; JdMatchPanel renders its own top bar (brand + Back to
  // the builder + change controls) and the work / live-CV split below it.
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--ff-paper)",
        fontFamily: "var(--font-body)",
        overflow: "hidden",
      }}
    >
      <JdMatchPanel />
    </main>
  );
}
