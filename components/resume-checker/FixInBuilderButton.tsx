"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FixInBuilderButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    router.push(`/builder?importedFrom=${reportId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="group flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-cta transition hover:-translate-y-0.5 hover:brightness-[1.08] hover:shadow-cta-hover disabled:translate-y-0 disabled:opacity-75"
      style={{
        backgroundImage: "linear-gradient(135deg, var(--ff-accent) 0%, var(--ff-accent-dark) 100%)",
      }}
    >
      {loading ? (
        "Opening builder…"
      ) : (
        <>
          Fix in Builder
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
            className="h-4 w-4 transition group-hover:translate-x-0.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </>
      )}
    </button>
  );
}
