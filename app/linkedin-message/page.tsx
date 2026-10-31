import type { Metadata } from "next";
import { LinkedinMessagePanel } from "../../components/linkedin/LinkedinMessagePanel";

export const metadata: Metadata = {
  title: "LinkedIn Message — Written From Your CV",
  description:
    "A short first-person message to a recruiter or hiring manager about one role, written only from what is " +
    "already in your CV and the job text you paste. Free, no sign-up.",
  robots: { index: false, follow: false },
};

export default function LinkedinMessagePage() {
  // Same full-height shell as /cover-letter; the panel renders its own top bar.
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
      <LinkedinMessagePanel />
    </main>
  );
}
