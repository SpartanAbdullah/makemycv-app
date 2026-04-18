// POST /api/resume-checker/parse
// multipart/form-data { file: PDF }  →  { reportId }

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { parseCvPdf } from "@/lib/resumeChecker/parse";
import { computeCheckerScore } from "@/lib/scoreEngine";
import { saveReport } from "@/lib/resumeChecker/storage";
import type { StoredReport } from "@/lib/resumeChecker/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  const requestId = nanoid(10);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data", requestId },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded. Attach a PDF under the 'file' field.", requestId },
      { status: 400 },
    );
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported.", requestId },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "The uploaded file is empty.", requestId },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 5MB.", requestId },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await parseCvPdf(buffer);
  } catch (err) {
    const e = err as { kind?: string; message?: string };
    if (e?.kind === "too-short") {
      return NextResponse.json(
        {
          error:
            "We couldn't read this PDF. If it's a scanned image, export a text-based version and try again.",
          requestId,
        },
        { status: 422 },
      );
    }
    if (e?.kind === "pdf-failed") {
      return NextResponse.json(
        {
          error:
            "This PDF looks corrupted or encrypted. Try re-saving it from the original source.",
          requestId,
        },
        { status: 422 },
      );
    }
    if (e?.kind === "claude-failed") {
      return NextResponse.json(
        {
          error:
            "Our parser had trouble with this CV. Please try again in a minute.",
          requestId,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "Unexpected error while parsing.", requestId },
      { status: 500 },
    );
  }

  const { cv, parseSignals, rawText } = result;
  const score = computeCheckerScore(cv, parseSignals);

  const reportId = nanoid(16);
  const createdAt = Date.now();
  const stored: StoredReport = {
    cv,
    parseSignals,
    score,
    createdAt,
    rawText, // server-only — never returned to client
  };

  try {
    await saveReport(reportId, stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage error";
    return NextResponse.json(
      { error: `Couldn't save the report: ${message}`, requestId },
      { status: 500 },
    );
  }

  return NextResponse.json({ reportId });
}
