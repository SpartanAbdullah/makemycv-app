// POST /api/resume-checker/import/[reportId]
// Returns the stored CvData so the builder's Zustand store can hydrate it.

import { NextResponse } from "next/server";
import { getReport } from "@/lib/resumeChecker/storage";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await context.params;

  if (!reportId || reportId.length < 8) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const stored = await getReport(reportId);
  if (!stored) {
    return NextResponse.json(
      { error: "Report not found or expired" },
      { status: 404 },
    );
  }

  // parseSignals travel alongside the CV so the Builder can produce a
  // score with parity to the Checker's report (the 10 conditional points
  // score out of 100 in both places instead of dropping out in builder mode).
  return NextResponse.json({
    cv: stored.cv,
    parseSignals: stored.parseSignals,
  });
}
