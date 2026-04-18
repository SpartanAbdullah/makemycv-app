// POST /api/resume-checker/parse
// application/json { rawText: string, fileName?: string }  →  { reportId }
//
// PDF text is extracted client-side (see components/resume-checker/UploadDropzone
// and lib/importers/pdfAdapter.extractPdfTextInBrowser). This route only sees
// plain text, so it stays lightweight and avoids server-side pdfjs which is
// brittle under Next.js Turbopack.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { parseCvText } from "@/lib/resumeChecker/parse";
import { computeScore } from "@/lib/scoreEngine";
import { saveReport } from "@/lib/resumeChecker/storage";
import type { StoredReport } from "@/lib/resumeChecker/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 100_000;
const MIN_TEXT_LENGTH = 200;

export async function POST(request: Request) {
  const requestId = nanoid(10);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", requestId },
      { status: 400 },
    );
  }

  const rawText =
    body && typeof body === "object" && "rawText" in body
      ? (body as { rawText: unknown }).rawText
      : undefined;

  if (typeof rawText !== "string" || rawText.length === 0) {
    return NextResponse.json(
      { error: "No text provided", requestId },
      { status: 400 },
    );
  }

  if (rawText.length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error:
          "CV text is too short. If your PDF is a scanned image, export a text-based version.",
        requestId,
      },
      { status: 422 },
    );
  }

  if (rawText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `CV text is too long. Maximum is ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
        requestId,
      },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await parseCvText(rawText);
  } catch (err) {
    const e = err as { kind?: string; message?: string };
    if (e?.kind === "too-short") {
      return NextResponse.json(
        {
          error:
            "We couldn't read enough text from this CV. Try a different PDF.",
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

  const { cv, parseSignals, rawText: storedRawText } = result;
  const score = computeScore(cv, { mode: "checker", parseSignals });

  const reportId = nanoid(16);
  const createdAt = Date.now();
  const stored: StoredReport = {
    cv,
    parseSignals,
    score,
    createdAt,
    rawText: storedRawText, // server-only — never returned to client
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
