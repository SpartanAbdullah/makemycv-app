import { Suspense } from "react";
import { BuilderClient } from "./BuilderClient";

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
