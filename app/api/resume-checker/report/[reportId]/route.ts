// GET /api/resume-checker/report/[reportId]
// Returns the report minus rawText. 404 when missing or expired.

import { NextResponse } from "next/server";
import { getReport } from "@/lib/resumeChecker/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await context.params;

  if (!reportId || reportId.length < 8) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const stored = await getReport(reportId);
  if (!stored) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Strip rawText before returning.
  const { cv, parseSignals, score, createdAt } = stored;
  return NextResponse.json({ cv, parseSignals, score, createdAt });
}
