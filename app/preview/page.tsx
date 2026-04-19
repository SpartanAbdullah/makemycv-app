import type { Metadata } from "next";
import { Suspense } from "react";
import { PreviewClient } from "./PreviewClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const PreviewFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
    Loading preview...
  </div>
);

export default function PreviewPage() {
  return (
    <Suspense fallback={<PreviewFallback />}>
      <PreviewClient />
    </Suspense>
  );
}
