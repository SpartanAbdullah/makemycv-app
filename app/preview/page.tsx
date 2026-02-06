export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PreviewClient } from "./PreviewClient";

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
