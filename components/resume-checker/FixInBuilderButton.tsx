"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FixInBuilderButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    // We don't fetch import here — the builder does it on mount via the query param.
    // Keeping the click client-side just gives us a loading state for the navigation.
    setLoading(true);
    router.push(`/builder?importedFrom=${reportId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-70"
    >
      {loading ? "Opening builder…" : "Fix in Builder — $5 →"}
    </button>
  );
}
