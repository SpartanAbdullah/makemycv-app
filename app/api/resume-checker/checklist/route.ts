// GET /api/resume-checker/checklist — the checker's "what this checks" list
// as JSON, for the marketing site's drift check (Mission 8, 2026-10-31).
//
// Public, no inputs, no secrets: the same list app/resume-checker renders,
// built from lib/resumeChecker/checklist.ts (pinned to the score engine by
// checklist.test.ts). www.makemycv.ae runs scripts/check-checklist-contract.mjs
// in CI against this URL and fails when its hard-coded counts disagree.
//
// Cached for an hour in the browser and a day at the edge — the list changes
// only with a deploy, and a stale read costs nothing but a late CI warning.
// CORS is open so the check can also run from a browser console or a pasted
// fetch(); there is nothing here that is not already on the public page.

import { NextResponse } from "next/server";
import { buildChecklistContract } from "@/lib/resumeChecker/checklistContract";

export const runtime = "nodejs";

const HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  return NextResponse.json(buildChecklistContract(), { headers: HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}
