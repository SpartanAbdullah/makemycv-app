"use client";

export default function DevResetAI() {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <button
      type="button"
      onClick={() => {
        localStorage.removeItem("makemycv_ai_bullets_used");
        localStorage.removeItem("makemycv_ai_skills_used");
        localStorage.removeItem("makemycv_ai_summary_used");
        window.location.reload();
      }}
      className="fixed bottom-6 right-6 z-[999] bg-gray-800 text-white text-xs px-3 py-2 rounded-lg opacity-50 hover:opacity-100 transition cursor-pointer"
    >
      {"\uD83D\uDD27"} Reset AI Counters
    </button>
  );
}
