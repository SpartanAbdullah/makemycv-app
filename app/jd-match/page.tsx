import type { Metadata } from "next";
import Link from "next/link";
import { JdMatchPanel } from "../../components/jdmatch/JdMatchPanel";
import { Logo } from "../../components/Logo";
import { Icon } from "../../components/builder/Icon";

export const metadata: Metadata = {
  title: "JD Match — Check Your CV Against a Job",
  description:
    "Paste a UAE job description and see how well your CV matches it: " +
    "your match score plus the keywords you cover and the ones you're missing. " +
    "Free, no sign-up, your CV stays in your browser.",
  robots: { index: false, follow: false },
};

export default function JdMatchPage() {
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
      {/* Top bar — brand + a clean way back to the builder (no browser back) */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 20px",
          height: 60,
          flexShrink: 0,
          background: "var(--ff-card)",
          borderBottom: "1px solid var(--ff-line)",
        }}
      >
        <Logo variant="horizontal" height={28} href="/builder" />
        <Link
          href="/builder"
          className="cv-btn-secondary"
          style={{ padding: "9px 16px", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          <Icon name="chevron-left" size={13} />
          Back to the builder
        </Link>
      </header>

      <JdMatchPanel />
    </main>
  );
}
