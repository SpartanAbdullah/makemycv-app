import { Suspense } from "react";
import type { Metadata } from "next";
import { BuilderClient } from "./BuilderClient";

export const metadata: Metadata = {
  title: "Build Your CV — MakeMyCV",
  description:
    "Step-by-step CV builder for UAE jobs. " +
    "Add your experience, education, and skills. " +
    "Download as PDF instantly, no account needed.",
  robots: {
    index: false,
    follow: false,
  },
};

const BuilderFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
    Loading builder...
  </div>
);

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderFallback />}>
      <BuilderClient />
    </Suspense>
  );
}
